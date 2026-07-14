import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));

function mulberry32(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(config.seed);
const uniform = (halfWidth) => (random() * 2 - 1) * halfWidth;
const bernoulli = (probability) => (random() < probability ? 1 : 0);
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

function percentile(sorted, probability) {
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower] + fraction * (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]);
}

function simulateDataset(repositoryCount, heterogeneityHalfWidth) {
  const repositories = [];
  for (let repository = 0; repository < repositoryCount; repository += 1) {
    const difficulty = uniform(config.repositoryDifficultyHalfWidth);
    const treatmentShift = uniform(heterogeneityHalfWidth);
    const rows = [];
    for (let task = 0; task < config.tasksPerRepository; task += 1) {
      const probabilityA = config.baseSuccessProbability + difficulty;
      const probabilityB = probabilityA + config.trueTreatmentEffect + treatmentShift;
      rows.push(bernoulli(probabilityB) - bernoulli(probabilityA));
    }
    repositories.push(rows);
  }
  return repositories;
}

function intervals(repositories) {
  const taskDeltas = repositories.flat();
  const estimate = mean(taskDeltas);
  const variance = taskDeltas.reduce((sum, value) => sum + (value - estimate) ** 2, 0) / (taskDeltas.length - 1);
  const standardError = Math.sqrt(variance / taskDeltas.length);
  const naive = [estimate - 1.96 * standardError, estimate + 1.96 * standardError];
  const taskBootstrap = [];
  const clusterBootstrap = [];

  for (let repeat = 0; repeat < config.bootstrapRepeats; repeat += 1) {
    let taskSum = 0;
    for (let index = 0; index < taskDeltas.length; index += 1) {
      taskSum += taskDeltas[Math.floor(random() * taskDeltas.length)];
    }
    taskBootstrap.push(taskSum / taskDeltas.length);

    let clusterSum = 0;
    for (let index = 0; index < repositories.length; index += 1) {
      const sampled = repositories[Math.floor(random() * repositories.length)];
      clusterSum += sampled.reduce((sum, value) => sum + value, 0);
    }
    clusterBootstrap.push(clusterSum / taskDeltas.length);
  }

  taskBootstrap.sort((a, b) => a - b);
  clusterBootstrap.sort((a, b) => a - b);
  return {
    estimate,
    naive,
    taskBootstrap: [percentile(taskBootstrap, 0.025), percentile(taskBootstrap, 0.975)],
    clusterBootstrap: [percentile(clusterBootstrap, 0.025), percentile(clusterBootstrap, 0.975)]
  };
}

function evaluateScenario({ label, repositoryCount, heterogeneityHalfWidth }) {
  const methods = ["naive", "taskBootstrap", "clusterBootstrap"];
  const accumulators = Object.fromEntries(methods.map((method) => [method, { covered: 0, widths: [] }]));
  const replicateRecords = [];

  for (let repeat = 0; repeat < config.monteCarloRepeats; repeat += 1) {
    const result = intervals(simulateDataset(repositoryCount, heterogeneityHalfWidth));
    const record = { repeat: repeat + 1, estimate: result.estimate };
    for (const method of methods) {
      const interval = result[method];
      const covered = interval[0] <= config.trueTreatmentEffect && interval[1] >= config.trueTreatmentEffect;
      accumulators[method].covered += Number(covered);
      accumulators[method].widths.push(interval[1] - interval[0]);
      record[method] = { low: interval[0], high: interval[1], covered };
    }
    replicateRecords.push(record);
  }

  return {
    label,
    repositoryCount,
    taskCount: repositoryCount * config.tasksPerRepository,
    heterogeneityHalfWidth,
    methods: Object.fromEntries(methods.map((method) => {
      const coverage = accumulators[method].covered / config.monteCarloRepeats;
      return [method, {
        coverage,
        coverageMonteCarloSE: Math.sqrt(coverage * (1 - coverage) / config.monteCarloRepeats),
        meanIntervalWidth: mean(accumulators[method].widths),
        absoluteCoverageError: Math.abs(coverage - config.confidenceLevel)
      }];
    })),
    replicates: replicateRecords
  };
}

const scenarios = [
  ...config.heterogeneityHalfWidths.map((heterogeneityHalfWidth) => ({
    label: `heterogeneity-${heterogeneityHalfWidth}`,
    repositoryCount: config.primaryRepositoryCount,
    heterogeneityHalfWidth
  })),
  ...config.clusterCountAblation
    .filter((repositoryCount) => repositoryCount !== config.primaryRepositoryCount)
    .map((repositoryCount) => ({
      label: `clusters-${repositoryCount}`,
      repositoryCount,
      heterogeneityHalfWidth: Math.max(...config.heterogeneityHalfWidths)
    }))
];

const results = {
  generatedAt: new Date().toISOString(),
  estimand: "Mean paired success-rate difference, agent B minus agent A",
  trueTreatmentEffect: config.trueTreatmentEffect,
  dataGeneratingProcess: "Repository difficulty is shared by both agents; repository-level treatment heterogeneity induces dependence among paired task deltas.",
  scenarios: scenarios.map(evaluateScenario)
};

fs.writeFileSync(path.join(root, "raw-results.json"), `${JSON.stringify(results, null, 2)}\n`);
const summary = {
  ...results,
  scenarios: results.scenarios.map(({ replicates, ...scenario }) => scenario)
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(summary, null, 2)}\n`);

const lines = [
  "clustered agent benchmark uncertainty simulation",
  `repeats=${config.monteCarloRepeats} bootstrap_repeats=${config.bootstrapRepeats} true_effect=${config.trueTreatmentEffect.toFixed(3)}`,
  "label repos tasks heterogeneity method coverage mcse width abs_error"
];
for (const scenario of summary.scenarios) {
  for (const [method, metrics] of Object.entries(scenario.methods)) {
    lines.push([
      scenario.label,
      scenario.repositoryCount,
      scenario.taskCount,
      scenario.heterogeneityHalfWidth.toFixed(2),
      method,
      metrics.coverage.toFixed(3),
      metrics.coverageMonteCarloSE.toFixed(3),
      metrics.meanIntervalWidth.toFixed(3),
      metrics.absoluteCoverageError.toFixed(3)
    ].join(" "));
  }
}
fs.writeFileSync(path.join(root, "output.txt"), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
