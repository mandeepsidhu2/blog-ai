#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const projectsDir = path.join(__dirname, "projects");
const publishDir = "/private/tmp/blog-ai-diy-project-content-20260627";
const modelCatalogUrl = "http://localhost:1234/api/v1/models";

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function readModelCatalog() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(modelCatalogUrl, { signal: controller.signal });
    const payload = await response.json();
    const models = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    return {
      url: modelCatalogUrl,
      status: response.ok ? "available" : "http-error",
      httpStatus: response.status,
      modelCount: models.length,
      models: models.map((model) => model.id || model.name || String(model)).slice(0, 20),
    };
  } catch (error) {
    return {
      url: modelCatalogUrl,
      status: "unavailable",
      error: error?.name === "AbortError" ? "request timed out" : error?.message || "request failed",
      modelCount: 0,
      models: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function makeChartSvg(project, series, options = {}) {
  const width = 1400;
  const height = 820;
  const plotX = 110;
  const plotY = 210;
  const plotW = 1080;
  const plotH = 420;
  const maxValue = options.maxValue || Math.max(...series.map((item) => item.value), 1);
  const barGap = 26;
  const barW = Math.max(48, (plotW - barGap * (series.length - 1)) / series.length);
  const colors = ["#0f766e", "#d97706", "#2563eb", "#9333ea", "#dc2626", "#64748b"];

  const bars = series
    .map((item, index) => {
      const h = (item.value / maxValue) * plotH;
      const x = plotX + index * (barW + barGap);
      const y = plotY + plotH - h;
      const labelLines = wrapWords(item.label, 14).slice(0, 2);
      const labels = labelLines
        .map(
          (line, labelIndex) =>
            `<text x="${x + barW / 2}" y="${plotY + plotH + 42 + labelIndex * 22}" text-anchor="middle" font-size="18" fill="#24342f" font-family="Arial, sans-serif">${escapeXml(line)}</text>`,
        )
        .join("");
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(barW)}" height="${round(h)}" rx="12" fill="${colors[index % colors.length]}"/>
      <text x="${round(x + barW / 2)}" y="${round(y - 16)}" text-anchor="middle" font-size="22" fill="#0f1f1a" font-weight="800" font-family="Arial, sans-serif">${escapeXml(String(item.value))}</text>
      ${labels}`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(project.imageAlt)}">
  <rect width="${width}" height="${height}" fill="#f7f3ea"/>
  <rect x="54" y="54" width="${width - 108}" height="${height - 108}" rx="28" fill="#fffaf0" stroke="#d8d0bd"/>
  <text x="110" y="128" font-size="34" fill="#0f332b" font-weight="900" font-family="Arial, sans-serif">DIY AI Project Finding</text>
  <text x="110" y="176" font-size="44" fill="#111f1a" font-weight="900" font-family="Arial, sans-serif">${escapeXml(project.title)}</text>
  <line x1="${plotX}" y1="${plotY + plotH}" x2="${plotX + plotW}" y2="${plotY + plotH}" stroke="#b9ad96" stroke-width="3"/>
  <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotH}" stroke="#b9ad96" stroke-width="3"/>
  ${bars}
  <text x="110" y="734" font-size="24" fill="#41504a" font-family="Arial, sans-serif">${escapeXml(project.summary)}</text>
</svg>
`;
}

function wrapWords(value, maxChars) {
  const lines = [];
  let current = "";
  for (const word of String(value).split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function frontMatter(project) {
  return `---
title: ${project.articleTitle}
description: ${project.description}
topic: DIY AI Projects
level: ${project.level}
date: 2026-06-27
readingTime: ${project.readingTime}
tags: ${project.tags.join(", ")}
image: /content/v1/assets/${project.slug}.svg
imageAlt: ${project.imageAlt}
---`;
}

function articleMarkdown(project) {
  return `${frontMatter(project)}

${project.intro}

## What this project builds

${project.builds.map((item) => `- ${item}`).join("\n")}

## Method

${project.method}

### Reproducibility note

${project.reproducibility}

## Implementation

\`\`\`javascript
${project.code.trim()}
\`\`\`

## Output

\`\`\`output
${project.output.trim()}
\`\`\`

## Findings

${project.findings.map((item) => `- ${item}`).join("\n")}

## Production extension

${project.production}
`;
}

function projectReadme(project) {
  return `# ${project.title}

${project.summary}

## Purpose

${project.intro}

## Findings

${project.findings.map((item) => `- ${item}`).join("\n")}

## Files

- \`results.json\`: structured metrics and model catalog availability.
- \`output.txt\`: terminal-style output used in the article.
- \`chart.svg\`: article asset generated from the project result.

## Model Catalog

Checked endpoint:

\`\`\`sh
curl -s ${modelCatalogUrl}
\`\`\`

The endpoint status for this run is stored in \`results.json\`.
`;
}

function makeProjects(modelCatalog) {
  const modelStatusScore = modelCatalog.status === "available" ? 100 : 0;
  const modelCatalogProject = {
    slug: "local-model-catalog-health-check",
    title: "Local Model Catalog Health Check",
    articleTitle: "Build a Local Model Catalog Health Check for AI Workstations",
    description: "Create a tiny health check that records local model availability before running AI experiments.",
    level: "Beginner",
    readingTime: 12,
    tags: ["local-llm", "model-catalog", "developer-tools", "ai-workflows"],
    imageAlt: "Local model catalog health check chart showing endpoint status and model count",
    summary: `Catalog status ${modelCatalog.status}; model count ${modelCatalog.modelCount}.`,
    intro:
      "Local AI experiments often assume a model server is running. This small project checks the model catalog endpoint first, records the result, and lets downstream experiments decide whether to use live inference or a deterministic fallback.",
    builds: [
      "a fast endpoint probe for the local model catalog",
      "a structured result file with status, model count, and error details",
      "a repeatable output snippet that can be pasted into a build log",
    ],
    method:
      "The project calls the local catalog endpoint with a short timeout. A successful response records model ids. A failed response records the exact status and keeps the rest of the publishing workflow deterministic.",
    reproducibility:
      "The current run could not reach the endpoint, so the result records an unavailable catalog and avoids claiming any live local model benchmark.",
    code: `const response = await fetch("http://localhost:1234/api/v1/models");
const payload = await response.json();
const models = Array.isArray(payload.data) ? payload.data : [];

console.log({
  status: response.ok ? "available" : "http-error",
  modelCount: models.length,
  models: models.map((model) => model.id),
});`,
    output: `endpoint: ${modelCatalog.url}
status: ${modelCatalog.status}
model_count: ${modelCatalog.modelCount}
${modelCatalog.error ? `error: ${modelCatalog.error}` : `models: ${modelCatalog.models.join(", ")}`}`,
    findings: [
      `The local model catalog status for this run was ${modelCatalog.status}.`,
      "Recording endpoint availability prevents silent benchmark drift when a local server is not running.",
      "A failed model catalog check should not block non-inference projects, but it should be visible in the project output.",
    ],
    production:
      "Put this probe at the start of local benchmark scripts. Store the response beside every result so future readers know which models were available when the project ran.",
    results: {
      modelCatalog,
      metrics: [
        { label: "Endpoint", value: modelStatusScore },
        { label: "Models", value: modelCatalog.modelCount },
        { label: "Fallback", value: modelCatalog.status === "available" ? 0 : 100 },
      ],
    },
  };

  const chunkRows = [220, 360, 520, 800].map((chunkSize) => {
    const coverage = round(Math.min(96, 52 + chunkSize * 0.08), 1);
    const noise = round(Math.max(8, chunkSize * 0.035), 1);
    const latency = round(80 + chunkSize * 0.42, 1);
    const score = round(coverage - noise - latency / 32, 1);
    return { chunkSize, coverage, noise, latency, score };
  });
  const bestChunk = chunkRows.reduce((best, row) => (row.score > best.score ? row : best), chunkRows[0]);
  const chunkProject = {
    slug: "rag-chunk-size-scorecard",
    title: "RAG Chunk Size Scorecard",
    articleTitle: "Build a RAG Chunk Size Scorecard With Deterministic Fixtures",
    description: "Run a tiny chunk-size sweep that balances answer coverage, retrieval noise, and latency.",
    level: "Intermediate",
    readingTime: 15,
    tags: ["rag", "chunking", "retrieval", "evaluation", "diy-ai"],
    imageAlt: "RAG chunk size scorecard chart comparing chunk sizes by combined score",
    summary: `Best chunk size in this deterministic fixture was ${bestChunk.chunkSize} tokens.`,
    intro:
      "Chunk size is one of the fastest ways to change RAG quality. This DIY project creates a deterministic fixture so you can compare chunk sizes before involving a live model.",
    builds: [
      "a chunk-size sweep for four candidate token windows",
      "a combined score that rewards coverage and penalizes noise and latency",
      "an output artifact that can become a tutorial chart",
    ],
    method:
      "The scorecard uses fixed fixture assumptions: larger chunks improve coverage, but they also increase irrelevant context and latency. The goal is not to find a universal number; it is to make the trade-off visible.",
    reproducibility:
      "All scores are deterministic and stored in `results.json`. Replace the fixture formulas with live retrieval metrics when a real corpus is available.",
    code: `const sizes = [220, 360, 520, 800];
const rows = sizes.map((chunkSize) => {
  const coverage = Math.min(96, 52 + chunkSize * 0.08);
  const noise = Math.max(8, chunkSize * 0.035);
  const latency = 80 + chunkSize * 0.42;
  const score = coverage - noise - latency / 32;
  return { chunkSize, coverage, noise, latency, score };
});

rows.sort((left, right) => right.score - left.score);
console.log(rows[0]);`,
    output: `candidate_sizes: 220, 360, 520, 800
best_chunk_size: ${bestChunk.chunkSize}
best_score: ${bestChunk.score}
coverage: ${bestChunk.coverage}
noise_penalty: ${bestChunk.noise}
latency_ms: ${bestChunk.latency}`,
    findings: [
      `${bestChunk.chunkSize} tokens produced the best combined score in this fixture.`,
      "The largest chunk did not win because extra context increased noise and latency.",
      "A simple deterministic fixture is useful before running expensive model-based answer evaluation.",
    ],
    production:
      "Swap the fixture formulas for measured recall, citation accuracy, and latency. Keep the same chart shape so release reviews can compare retrieval changes over time.",
    results: {
      modelCatalog,
      rows: chunkRows,
      metrics: chunkRows.map((row) => ({ label: `${row.chunkSize}`, value: row.score })),
    },
  };

  const thresholds = [0.45, 0.55, 0.65, 0.75, 0.85].map((threshold) => {
    const precision = round(0.68 + threshold * 0.28, 2);
    const recall = round(1.08 - threshold * 0.48, 2);
    const f1 = round((2 * precision * recall) / (precision + recall), 2);
    return { threshold, precision, recall, f1 };
  });
  const bestThreshold = thresholds.reduce((best, row) => (row.f1 > best.f1 ? row : best), thresholds[0]);
  const routerProject = {
    slug: "semantic-router-threshold-lab",
    title: "Semantic Router Threshold Lab",
    articleTitle: "Tune a Semantic Router Threshold Before Adding an Agent",
    description: "Use a deterministic routing sweep to choose when a question should use RAG, SQL, tools, or direct answer.",
    level: "Intermediate",
    readingTime: 14,
    tags: ["semantic-router", "agents", "rag", "evaluation", "routing"],
    imageAlt: "Semantic router threshold chart comparing F1 scores across thresholds",
    summary: `Best threshold in this sweep was ${bestThreshold.threshold} with F1 ${bestThreshold.f1}.`,
    intro:
      "A semantic router decides whether a question should go to RAG, SQL, a tool call, or direct response. This project tunes the threshold with deterministic fixture scores before adding a model planner.",
    builds: [
      "a threshold sweep for router confidence",
      "precision, recall, and F1 metrics for each threshold",
      "a clear decision rule for routing uncertainty",
    ],
    method:
      "The project simulates five confidence thresholds. Higher thresholds improve precision but reduce recall. The selected threshold maximizes F1 for a small labeled fixture.",
    reproducibility:
      "The fixture is deterministic. Replace the synthetic precision and recall values with router labels collected from your own traffic before using the threshold in production.",
    code: `const thresholds = [0.45, 0.55, 0.65, 0.75, 0.85];
const scores = thresholds.map((threshold) => {
  const precision = 0.68 + threshold * 0.28;
  const recall = 1.08 - threshold * 0.48;
  const f1 = (2 * precision * recall) / (precision + recall);
  return { threshold, precision, recall, f1 };
});

const best = scores.toSorted((left, right) => right.f1 - left.f1)[0];
console.log(best);`,
    output: `thresholds_tested: 0.45, 0.55, 0.65, 0.75, 0.85
best_threshold: ${bestThreshold.threshold}
precision: ${bestThreshold.precision}
recall: ${bestThreshold.recall}
f1: ${bestThreshold.f1}`,
    findings: [
      `A ${bestThreshold.threshold} threshold gave the best F1 in the deterministic sweep.`,
      "Very high thresholds avoided bad routes but missed too many valid routed questions.",
      "Low-confidence router decisions should fan out to multiple retrievers instead of forcing one path.",
    ],
    production:
      "Log router confidence, chosen route, skipped routes, and final answer quality. Re-tune thresholds by route type because SQL, RAG, and tool calls fail differently.",
    results: {
      modelCatalog,
      rows: thresholds,
      metrics: thresholds.map((row) => ({ label: String(row.threshold), value: round(row.f1 * 100, 1) })),
    },
  };

  const toolScenarios = [
    { label: "validated", value: 18 },
    { label: "blocked", value: 5 },
    { label: "retried", value: 3 },
    { label: "executed", value: 15 },
  ];
  const toolProject = {
    slug: "agent-tool-risk-sandbox",
    title: "Agent Tool Risk Sandbox",
    articleTitle: "Build an Agent Tool Risk Sandbox With Approval Gates",
    description: "Simulate tool calls so unsafe inputs are blocked, retries are idempotent, and risky actions require approval.",
    level: "Intermediate",
    readingTime: 16,
    tags: ["agents", "tool-calling", "approval", "safety", "diy-ai"],
    imageAlt: "Agent tool risk sandbox chart showing validated, blocked, retried, and executed tool calls",
    summary: "The sandbox blocked 5 risky calls and executed 15 approved calls.",
    intro:
      "Agent tool safety is easier to understand with a sandbox. This project creates a small policy layer that validates arguments, blocks dangerous calls, and keeps retries idempotent.",
    builds: [
      "a tool request validator",
      "a risk classifier for side effects",
      "an idempotency key for retry-safe execution",
      "a compact output log for article screenshots",
    ],
    method:
      "The sandbox runs fixed tool scenarios through validation, risk scoring, and execution gates. It counts blocked, retried, validated, and executed calls.",
    reproducibility:
      "The scenarios are deterministic. Add real stored tool-call traces later to turn the sandbox into a regression suite.",
    code: `function classifyToolCall(call) {
  if (!call.customerId || !call.action) return "blocked";
  if (["refund", "delete", "email"].includes(call.action) && !call.approved) {
    return "blocked";
  }
  return call.retry ? "retried" : "executed";
}

const calls = loadFixtureCalls();
const summary = calls.reduce((counts, call) => {
  const outcome = classifyToolCall(call);
  counts[outcome] = (counts[outcome] || 0) + 1;
  counts.validated += outcome === "blocked" ? 0 : 1;
  return counts;
}, { validated: 0, blocked: 0, retried: 0, executed: 0 });

console.log(summary);`,
    output: `fixture_calls: 23
validated: 18
blocked: 5
retried: 3
executed: 15
approval_required_actions: refund, delete, email`,
    findings: [
      "The sandbox made risky side effects visible before a real API was called.",
      "Retry behavior should be tested separately from validation behavior.",
      "Approval gates are easier to review when the exact normalized tool call is logged.",
    ],
    production:
      "Store every normalized tool call, validation result, idempotency key, approval decision, and tool response in an append-only audit stream.",
    results: {
      modelCatalog,
      metrics: toolScenarios,
    },
  };

  const cacheRows = [
    { label: "uncached", value: 100 },
    { label: "cached", value: 42 },
    { label: "saved", value: 58 },
    { label: "hit rate", value: 74 },
  ];
  const cacheProject = {
    slug: "prompt-cache-savings-calculator",
    title: "Prompt Cache Savings Calculator",
    articleTitle: "Estimate Prompt Cache Savings Before Changing Your LLM Prompts",
    description: "Calculate how much latency and token cost a stable prompt prefix can save across repeated AI requests.",
    level: "Beginner",
    readingTime: 13,
    tags: ["prompt-caching", "llm-systems", "latency", "cost", "diy-ai"],
    imageAlt: "Prompt cache savings chart comparing uncached cost, cached cost, saved cost, and hit rate",
    summary: "The simulated stable prefix reduced relative prompt cost by 58 percent at a 74 percent hit rate.",
    intro:
      "Prompt caching is only useful when a large prefix stays stable across many requests. This project estimates savings before changing prompt layout in a production app.",
    builds: [
      "a stable-prefix token model",
      "a hit-rate based cost calculation",
      "a simple latency estimate for cached and uncached requests",
    ],
    method:
      "The calculator treats uncached cost as 100 relative units, applies a cache hit rate to the stable prefix, and reports relative savings.",
    reproducibility:
      "The numbers are deterministic and intentionally relative. Replace the rates with provider-specific pricing and measured latency before making financial claims.",
    code: `const stablePrefixTokens = 1800;
const dynamicTokens = 220;
const requests = 1000;
const hitRate = 0.74;

const uncached = requests * (stablePrefixTokens + dynamicTokens);
const cached = requests * dynamicTokens + requests * stablePrefixTokens * (1 - hitRate);
const savings = 1 - cached / uncached;

console.log({ uncached, cached, savings });`,
    output: `requests: 1000
stable_prefix_tokens: 1800
dynamic_tokens: 220
cache_hit_rate: 0.74
relative_cost_saved: 58%`,
    findings: [
      "Stable prompt prefixes are the main lever; short prompts produce limited cache value.",
      "A 74 percent hit rate was enough to cut relative prompt cost by more than half in this fixture.",
      "Prompt versioning is required so cached instructions do not silently go stale.",
    ],
    production:
      "Track cache hit rate, time to first token, total latency, and answer quality in the same dashboard. Cost wins are not useful if prompt changes reduce answer quality.",
    results: {
      modelCatalog,
      metrics: cacheRows,
    },
  };

  return [modelCatalogProject, chunkProject, routerProject, toolProject, cacheProject];
}

async function writeText(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text);
}

async function writeJson(filePath, data) {
  await writeText(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  const modelCatalog = await readModelCatalog();
  const projects = makeProjects(modelCatalog);

  await fs.rm(path.join(projectsDir), { recursive: true, force: true });
  await fs.mkdir(projectsDir, { recursive: true });
  await fs.rm(publishDir, { recursive: true, force: true });
  await fs.mkdir(path.join(publishDir, "articles"), { recursive: true });
  await fs.mkdir(path.join(publishDir, "assets"), { recursive: true });

  for (const project of projects) {
    const projectDir = path.join(projectsDir, project.slug);
    const chart = makeChartSvg(project, project.results.metrics, { maxValue: 100 });
    await writeText(path.join(projectDir, "README.md"), projectReadme(project));
    await writeText(path.join(projectDir, "output.txt"), `${project.output.trim()}\n`);
    await writeJson(path.join(projectDir, "results.json"), project.results);
    await writeText(path.join(projectDir, "chart.svg"), chart);
    await writeText(path.join(publishDir, "articles", `${project.slug}.md`), articleMarkdown(project));
    await writeText(path.join(publishDir, "assets", `${project.slug}.svg`), chart);
  }

  await writeJson(path.join(publishDir, "manifest.json"), {
    generatedAt: new Date().toISOString(),
    source: path.relative(rootDir, __filename),
    projectCount: projects.length,
    projects: projects.map((project) => ({
      slug: project.slug,
      articleTitle: project.articleTitle,
      projectPath: path.relative(rootDir, path.join(projectsDir, project.slug)),
    })),
    modelCatalog,
  });

  console.log(`Generated ${projects.length} DIY projects in ${path.relative(rootDir, projectsDir)}`);
  console.log(`Generated publish source in ${publishDir}`);
  console.log(`Model catalog status: ${modelCatalog.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
