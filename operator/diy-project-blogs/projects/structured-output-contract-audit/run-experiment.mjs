import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chooseFields(draw, scenario) {
  if (scenario.fixedFields) return scenario.fixedFields;
  let cursor = draw;
  for (const cell of config.schemaMix) {
    cursor -= cell.weight;
    if (cursor <= 0) return cell.fields;
  }
  return config.schemaMix.at(-1).fields;
}

const policies = ["field-average", "whole-call", "joint-long-schema"];
const rows = [];
for (const [scenarioName, scenario] of Object.entries(config.scenarios)) {
  for (let repeat = 0; repeat < config.repeats; repeat++) {
    const random = rng(config.seed + repeat * 7919 + scenarioName.length * 104729);
    let fields = 0;
    let correctFields = 0;
    let exactCalls = 0;
    let longCalls = 0;
    let longExact = 0;
    let criticalCalls = 0;
    let criticalCorrect = 0;
    const byLength = new Map();

    for (let call = 0; call < config.callsPerRepeat; call++) {
      const fieldCount = chooseFields(random(), scenario);
      const shocked = random() < scenario.callShock;
      let exact = true;
      let criticalOkay = true;
      let cell = byLength.get(fieldCount);
      if (!cell) {
        cell = {calls: 0, exact: 0};
        byLength.set(fieldCount, cell);
      }
      cell.calls++;
      for (let field = 0; field < fieldCount; field++) {
        const errorProbability = shocked
          ? scenario.shockFieldError
          : scenario.fieldError;
        const okay = random() >= errorProbability;
        fields++;
        if (okay) correctFields++;
        else exact = false;
        if (field < 2) {
          criticalCalls++;
          if (okay) criticalCorrect++;
          else criticalOkay = false;
        }
      }
      if (exact) {
        exactCalls++;
        cell.exact++;
      }
      if (fieldCount >= 16) {
        longCalls++;
        if (exact) longExact++;
      }
    }

    const fieldAccuracy = correctFields / fields;
    const wholeAccuracy = exactCalls / config.callsPerRepeat;
    const longAccuracy = longCalls ? longExact / longCalls : wholeAccuracy;
    const criticalAccuracy = criticalCorrect / criticalCalls;
    const metrics = {fieldAccuracy, wholeAccuracy, longAccuracy, criticalAccuracy};
    const approvals = {
      "field-average": fieldAccuracy >= config.fieldGate,
      "whole-call": wholeAccuracy >= config.wholeCallGate,
      "joint-long-schema":
        wholeAccuracy >= config.wholeCallGate &&
        longAccuracy >= config.longSchemaGate
    };
    for (const policy of policies) {
      rows.push({
        scenario: scenarioName,
        repeat,
        policy,
        ...metrics,
        approved: approvals[policy] ? 1 : 0,
        falseApproval:
          approvals[policy] && wholeAccuracy < config.wholeCallGate ? 1 : 0
      });
    }
  }
}

const grouped = {};
for (const row of rows) {
  const key = `${row.scenario}|${row.policy}`;
  (grouped[key] ??= []).push(row);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quantile(values, probability) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * probability)];
}

function bootstrap(values, seed) {
  const random = rng(seed);
  const draws = [];
  for (let sample = 0; sample < config.bootstrapSamples; sample++) {
    let total = 0;
    for (let index = 0; index < values.length; index++) {
      total += values[Math.floor(random() * values.length)];
    }
    draws.push(total / values.length);
  }
  return {
    low: quantile(draws, 0.025),
    high: quantile(draws, 0.975)
  };
}

const aggregate = [];
for (const [key, group] of Object.entries(grouped)) {
  const [scenario, policy] = key.split("|");
  const record = {scenario, policy, repeats: group.length};
  for (const metric of [
    "fieldAccuracy",
    "wholeAccuracy",
    "longAccuracy",
    "criticalAccuracy",
    "approved",
    "falseApproval"
  ]) {
    record[metric] = mean(group.map((row) => row[metric]));
  }
  aggregate.push(record);
}

const focal = rows.filter(
  (row) => row.scenario === "mixed-correlated" && row.policy === "field-average"
);
const gaps = focal.map((row) => row.fieldAccuracy - row.wholeAccuracy);
const gapInterval = bootstrap(gaps, config.seed ^ 0xa5a5a5a5);
const statistics = {
  focalScenario: "mixed-correlated",
  pairedGap: {
    metric: "fieldAccuracy - wholeAccuracy",
    mean: mean(gaps),
    confidenceInterval95: [gapInterval.low, gapInterval.high],
    repeats: focal.length,
    bootstrapSamples: config.bootstrapSamples
  },
  approvalIntervals: {}
};
for (const policy of policies) {
  const values = rows
    .filter((row) => row.scenario === "mixed-correlated" && row.policy === policy)
    .map((row) => row.approved);
  statistics.approvalIntervals[policy] = {
    mean: mean(values),
    confidenceInterval95: Object.values(
      bootstrap(values, config.seed + policy.length * 65537)
    )
  };
}

const csvHeader = Object.keys(rows[0]);
const csv = [
  csvHeader.join(","),
  ...rows.map((row) => csvHeader.map((key) => row[key]).join(","))
].join("\n");
fs.writeFileSync(path.join(root, "repeat-results.csv"), `${csv}\n`);
fs.writeFileSync(
  path.join(root, "aggregate-results.json"),
  `${JSON.stringify(aggregate, null, 2)}\n`
);
fs.writeFileSync(
  path.join(root, "statistical-analysis.json"),
  `${JSON.stringify(statistics, null, 2)}\n`
);

const focus = aggregate.filter((row) => row.scenario === "mixed-correlated");
const lines = [
  "Structured-output contract audit",
  `repeats=${config.repeats} calls_per_repeat=${config.callsPerRepeat}`,
  ...focus.map(
    (row) =>
      `${row.policy}: field=${(100 * row.fieldAccuracy).toFixed(3)}% ` +
      `whole=${(100 * row.wholeAccuracy).toFixed(3)}% ` +
      `long=${(100 * row.longAccuracy).toFixed(3)}% ` +
      `approve=${(100 * row.approved).toFixed(2)}% ` +
      `false_approve=${(100 * row.falseApproval).toFixed(2)}%`
  ),
  `paired_gap=${(100 * statistics.pairedGap.mean).toFixed(3)}pp ` +
    `ci95=[${(100 * gapInterval.low).toFixed(3)},${(100 * gapInterval.high).toFixed(3)}]pp`
];
fs.writeFileSync(path.join(root, "output.txt"), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
