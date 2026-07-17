import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function normal(rng) {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? p : 1 - p;
}

function mcnemarP(wins, losses) {
  const discordant = wins + losses;
  if (discordant === 0) return 1;
  const z = Math.abs(wins - losses) / Math.sqrt(discordant);
  return Math.min(1, 2 * (1 - normalCdf(z)));
}

function wilson(k, n) {
  const z = 1.959964;
  const p = k / n;
  const den = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / den;
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return [center - half, center + half];
}

function simulateTrial(seed, maxTasks, lookEvery, effect, method) {
  const rng = mulberry32(seed);
  const looks = Math.floor(maxTasks / lookEvery);
  const threshold = method === 'bonferroni_peeking' ? config.alpha / looks : config.alpha;
  let wins = 0;
  let losses = 0;
  for (let task = 1; task <= maxTasks; task++) {
    const difficulty = normal(rng) * 0.9;
    const pBase = 1 / (1 + Math.exp(-(-0.2 + difficulty)));
    const pTreat = 1 / (1 + Math.exp(-(-0.2 + difficulty + effect)));
    const shared = rng() < config.pairCorrelation;
    const uBase = rng();
    const uTreat = shared ? uBase : rng();
    const base = uBase < pBase;
    const treat = uTreat < pTreat;
    if (treat && !base) wins++;
    if (base && !treat) losses++;
    const atLook = task % lookEvery === 0;
    const eligible = method === 'fixed_horizon' ? task === maxTasks : atLook;
    if (eligible && mcnemarP(wins, losses) < threshold) {
      return { significant: true, tasks: task, direction: Math.sign(wins - losses), wins, losses };
    }
  }
  return { significant: false, tasks: maxTasks, direction: 0, wins, losses };
}

const rows = [];
const trials = [];
for (const maxTasks of config.maxTasks) {
  for (const lookEvery of config.lookEvery) {
    if (lookEvery > maxTasks) continue;
    for (const effect of config.logOddsEffects) {
      for (const method of config.methods) {
        let positives = 0;
        let correctDirection = 0;
        const stopTasks = [];
        for (let repeat = 0; repeat < config.seedCount; repeat++) {
          const methodId = config.methods.indexOf(method) + 1;
          const effectId = config.logOddsEffects.indexOf(effect) + 1;
          const seed = (((maxTasks * 1009 + lookEvery * 917 + effectId * 101 + methodId * 17) ^ repeat) >>> 0);
          const result = simulateTrial(seed, maxTasks, lookEvery, effect, method);
          if (result.significant) {
            positives++;
            if (result.direction > 0) correctDirection++;
          }
          stopTasks.push(result.tasks);
          if (maxTasks === 400 && lookEvery === 25 && [0, 0.2].includes(effect)) {
            trials.push({ repeat, effect, method, ...result });
          }
        }
        stopTasks.sort((a, b) => a - b);
        const ci = wilson(positives, config.seedCount);
        rows.push({
          maxTasks, lookEvery, looks: Math.floor(maxTasks / lookEvery), effectLogOdds: effect, method,
          significantRuns: positives, rate: positives / config.seedCount,
          ci95Low: ci[0], ci95High: ci[1],
          correctDirectionRate: correctDirection / config.seedCount,
          medianTasks: stopTasks[Math.floor(stopTasks.length / 2)]
        });
      }
    }
  }
}

const focal = rows.filter(r => r.maxTasks === 400 && r.lookEvery === 25);
const result = {
  generatedAt: new Date().toISOString(),
  config,
  interpretation: 'Monte Carlo operating characteristics for paired binary evaluations; rates are simulation estimates, not claims about any deployed model.',
  focal,
  rows
};
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts', 'aggregate-results.json'), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(root, 'artifacts', 'focal-trials.csv'), [
  'repeat,effect_log_odds,method,significant,tasks,direction,wins,losses',
  ...trials.map(r => [r.repeat, r.effect, r.method, r.significant, r.tasks, r.direction, r.wins, r.losses].join(','))
].join('\n') + '\n');

const pct = x => `${(100 * x).toFixed(2)}%`;
console.log('Focal design: maxTasks=400, lookEvery=25, 20,000 repeats');
for (const row of focal) {
  console.log(`${row.effectLogOdds.toFixed(1)}\t${row.method}\t${pct(row.rate)}\t[${pct(row.ci95Low)}, ${pct(row.ci95High)}]\tmedian_n=${row.medianTasks}`);
}
