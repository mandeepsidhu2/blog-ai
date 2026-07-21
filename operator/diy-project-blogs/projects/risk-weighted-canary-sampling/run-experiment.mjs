import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url), 'utf8'));

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function choose(draw, probabilities) {
  let cumulative = 0;
  for (const [name, probability] of Object.entries(probabilities)) {
    cumulative += probability;
    if (draw < cumulative) return name;
  }
  return Object.keys(probabilities).at(-1);
}

function logChoose(n, k) {
  let value = 0;
  for (let i = 1; i <= k; i++) value += Math.log(n - k + i) - Math.log(i);
  return value;
}

function oneSidedSignP(candidateOnly, baselineOnly) {
  const discordant = candidateOnly + baselineOnly;
  if (!discordant || candidateOnly <= baselineOnly) return 1;
  let probability = 0;
  for (let k = candidateOnly; k <= discordant; k++) {
    probability += Math.exp(logChoose(discordant, k) - discordant * Math.log(2));
  }
  return Math.min(1, probability);
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const fraction = index - low;
  return sorted[low] + (sorted[Math.min(low + 1, sorted.length - 1)] - sorted[low]) * fraction;
}

function bootstrapMeanCI(values, random, samples) {
  const means = [];
  for (let b = 0; b < samples; b++) {
    let total = 0;
    for (let i = 0; i < values.length; i++) total += values[Math.floor(random() * values.length)];
    means.push(total / values.length);
  }
  return [quantile(means, 0.025), quantile(means, 0.975)];
}

const rows = [];
for (const [scenarioName, scenario] of Object.entries(config.scenarios)) {
  for (const [policyName, sampleShares] of Object.entries(config.policies)) {
    for (let repeat = 0; repeat < config.repeats; repeat++) {
      const random = mulberry32(config.seed + repeat * 97 + scenarioName.length * 100003 + policyName.length * 1000003);
      const counts = Object.fromEntries(Object.keys(config.populationShares).map(name => [name, {n: 0, candidateOnly: 0, baselineOnly: 0}]));
      let naiveDelta = 0;
      let weightedDelta = 0;
      let weightSum = 0;
      let weightSquareSum = 0;
      for (let i = 0; i < config.sampleBudget; i++) {
        const stratum = choose(random(), sampleShares);
        const spec = scenario[stratum];
        const outcome = random();
        const candidateOnly = outcome < spec.candidateOnlyFailure ? 1 : 0;
        const baselineOnly = outcome >= spec.candidateOnlyFailure && outcome < spec.candidateOnlyFailure + spec.baselineOnlyFailure ? 1 : 0;
        const delta = candidateOnly - baselineOnly;
        const weight = config.populationShares[stratum] / sampleShares[stratum];
        counts[stratum].n++;
        counts[stratum].candidateOnly += candidateOnly;
        counts[stratum].baselineOnly += baselineOnly;
        naiveDelta += delta;
        weightedDelta += weight * delta;
        weightSum += weight;
        weightSquareSum += weight * weight;
      }
      const critical = counts.critical;
      rows.push({
        scenario: scenarioName,
        policy: policyName,
        repeat,
        criticalN: critical.n,
        criticalCandidateOnly: critical.candidateOnly,
        criticalBaselineOnly: critical.baselineOnly,
        criticalP: oneSidedSignP(critical.candidateOnly, critical.baselineOnly),
        criticalDetected: oneSidedSignP(critical.candidateOnly, critical.baselineOnly) < 0.05 ? 1 : 0,
        naiveDelta: naiveDelta / config.sampleBudget,
        weightedDelta: weightedDelta / weightSum,
        effectiveN: weightSum * weightSum / weightSquareSum
      });
    }
  }
}

const expected = {};
for (const [scenarioName, scenario] of Object.entries(config.scenarios)) {
  expected[scenarioName] = Object.entries(config.populationShares).reduce((sum, [stratum, share]) => {
    const spec = scenario[stratum];
    return sum + share * (spec.candidateOnlyFailure - spec.baselineOnlyFailure);
  }, 0);
}

const bootstrapRandom = mulberry32(config.seed ^ 0xA5A5A5A5);
const aggregates = [];
for (const scenario of Object.keys(config.scenarios)) {
  for (const policy of Object.keys(config.policies)) {
    const group = rows.filter(row => row.scenario === scenario && row.policy === policy);
    const detection = group.map(row => row.criticalDetected);
    const weighted = group.map(row => row.weightedDelta);
    const naive = group.map(row => row.naiveDelta);
    const criticalN = group.map(row => row.criticalN);
    const effectiveN = group.map(row => row.effectiveN);
    const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
    aggregates.push({
      scenario,
      policy,
      repeats: group.length,
      expectedPopulationDelta: expected[scenario],
      criticalDetectionPower: mean(detection),
      criticalDetectionPowerCI: bootstrapMeanCI(detection, bootstrapRandom, config.bootstrapSamples),
      meanCriticalN: mean(criticalN),
      weightedDeltaMean: mean(weighted),
      weightedBias: mean(weighted) - expected[scenario],
      weightedMeanCI: bootstrapMeanCI(weighted, bootstrapRandom, config.bootstrapSamples),
      naiveDeltaMean: mean(naive),
      naiveBias: mean(naive) - expected[scenario],
      effectiveNMean: mean(effectiveN)
    });
  }
}

const csvHeader = Object.keys(rows[0]);
const csv = [csvHeader.join(','), ...rows.map(row => csvHeader.map(key => row[key]).join(','))].join('\n') + '\n';
fs.writeFileSync(new URL('./repeat-results.csv', import.meta.url), csv);
fs.writeFileSync(new URL('./aggregate-results.json', import.meta.url), JSON.stringify({config, expected, aggregates}, null, 2) + '\n');
fs.writeFileSync(new URL('./statistical-analysis.json', import.meta.url), JSON.stringify({
  estimand: 'population-weighted candidate-only minus baseline-only discordance',
  criticalTest: 'one-sided exact sign test on matched critical-stratum discordances at alpha=0.05',
  intervals: `nonparametric bootstrap of ${config.bootstrapSamples} repeat-level means`,
  multiplicity: 'three policies and four scenarios are reported descriptively; no family-wise confirmatory claim is made',
  confirmatoryScenario: 'heterogeneous',
  controls: ['homogeneous', 'misranked', 'null']
}, null, 2) + '\n');

const focal = aggregates.filter(row => row.scenario === 'heterogeneous');
const summary = [
  `repeats_per_cell=${config.repeats}`,
  `sample_budget=${config.sampleBudget}`,
  ...focal.flatMap(row => [
    `${row.policy}_critical_detection=${row.criticalDetectionPower.toFixed(4)} [${row.criticalDetectionPowerCI.map(x => x.toFixed(4)).join(', ')}]`,
    `${row.policy}_mean_critical_n=${row.meanCriticalN.toFixed(2)}`,
    `${row.policy}_weighted_bias=${row.weightedBias.toFixed(6)}`,
    `${row.policy}_naive_bias=${row.naiveBias.toFixed(6)}`,
    `${row.policy}_effective_n=${row.effectiveNMean.toFixed(1)}`
  ])
].join('\n') + '\n';
fs.writeFileSync(new URL('./focal-summary.txt', import.meta.url), summary);
console.log(summary);
