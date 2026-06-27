#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..", "..");
const baseUrl = (process.env.LM_STUDIO_BASE_URL || "http://127.0.0.1:1234").replace(/\/+$/, "");
const chatModel = process.env.LM_STUDIO_CHAT_MODEL || "qwen/qwen3.6-35b-a3b";
const embeddingModel = process.env.LM_STUDIO_EMBEDDING_MODEL || "text-embedding-qwen3-embedding-0.6b";
const outDir = __dirname;
const keepModelsLoaded = process.env.LM_STUDIO_KEEP_MODELS_LOADED === "1";

const cases = [
  {
    id: "rag-supported-citation",
    label: "Supported answer with exact citation",
    expectedDecision: "answer",
    expectedCitations: ["rag-a"],
    expectedTerms: ["citation", "support", "context precision"],
    question: "Which evaluation signals should a production RAG service track before shipping a new retriever?",
    contexts: [
      {
        id: "rag-a",
        role: "support",
        title: "RAG release checklist",
        text:
          "A production RAG release should track answer correctness, citation support, context precision, refusal behavior, and latency. Citation support checks whether every material claim is grounded in retrieved passages.",
      },
      {
        id: "rag-b",
        role: "distractor",
        title: "Embedding cost note",
        text:
          "Embedding cost depends on corpus size, embedding dimensionality, and refresh frequency. Batch jobs should record index build ids and model names.",
      },
    ],
  },
  {
    id: "unsupported-policy",
    label: "No supporting policy",
    expectedDecision: "abstain",
    expectedCitations: [],
    expectedTerms: ["not specified", "insufficient", "context"],
    question: "What is the company's refund window for annual enterprise contracts?",
    contexts: [
      {
        id: "billing-a",
        role: "distractor",
        title: "Invoice metadata",
        text:
          "Invoices include the workspace id, billing contact, purchase order number, and payment status. The document does not define refund windows.",
      },
      {
        id: "billing-b",
        role: "distractor",
        title: "Support handoff",
        text:
          "Enterprise billing questions should be routed to finance when a contract amendment or tax exemption is involved.",
      },
    ],
  },
  {
    id: "conflict-needs-review",
    label: "Conflicting retrieved context",
    expectedDecision: "abstain",
    expectedCitations: ["sec-a", "sec-b"],
    expectedTerms: ["conflict", "review", "inconsistent"],
    question: "Can the support agent automatically rotate a production API key?",
    contexts: [
      {
        id: "sec-a",
        role: "support",
        title: "Legacy runbook",
        text:
          "The legacy support runbook says support agents may rotate production API keys automatically after verifying the account owner by email.",
      },
      {
        id: "sec-b",
        role: "support",
        title: "Current security policy",
        text:
          "The current security policy says production API key rotation requires human security approval and must not be completed by an autonomous support agent.",
      },
    ],
  },
  {
    id: "tool-risk-supported",
    label: "Tool-use risk classification",
    expectedDecision: "answer",
    expectedCitations: ["tool-a", "tool-b"],
    expectedTerms: ["allowlist", "idempotency", "approval"],
    question: "What controls should be added before an agent can call write-capable tools?",
    contexts: [
      {
        id: "tool-a",
        role: "support",
        title: "Agent tool policy",
        text:
          "Write-capable tools require tool allowlists, schema validation, dry-run mode where possible, idempotency keys, and approval boundaries for irreversible operations.",
      },
      {
        id: "tool-b",
        role: "support",
        title: "Incident review",
        text:
          "The last agent incident involved a repeated write call without an idempotency key. The remediation added trace ids, approval checks, and per-tool rate limits.",
      },
    ],
  },
  {
    id: "recency-trap",
    label: "Recency trap with older distractor",
    expectedDecision: "answer",
    expectedCitations: ["deploy-b"],
    expectedTerms: ["canary", "rollback", "error budget"],
    question: "What deployment gate replaced manual release approval?",
    contexts: [
      {
        id: "deploy-a",
        role: "distractor",
        title: "2024 release note",
        text:
          "In 2024 every AI workflow release required manual approval from the platform lead before rollout.",
      },
      {
        id: "deploy-b",
        role: "support",
        title: "2026 release note",
        text:
          "In 2026 manual approval was replaced by an automated canary gate. The gate checks retrieval quality, p95 latency, and error budget burn, then triggers rollback on failure.",
      },
    ],
  },
  {
    id: "numeric-extraction",
    label: "Numeric extraction under distractor pressure",
    expectedDecision: "answer",
    expectedCitations: ["eval-a"],
    expectedTerms: ["0.82", "0.76", "recall"],
    question: "What recall@5 threshold blocks a retriever release, and what was last week's value?",
    contexts: [
      {
        id: "eval-a",
        role: "support",
        title: "Retriever scorecard",
        text:
          "The retriever release gate blocks deployment when recall@5 is below 0.82. Last week's offline score was 0.76, so the index refresh did not ship.",
      },
      {
        id: "eval-b",
        role: "distractor",
        title: "Latency scorecard",
        text:
          "The latency release gate blocks deployment when p95 answer time exceeds 1.8 seconds. Last week's p95 was 1.4 seconds.",
      },
    ],
  },
  {
    id: "unsupported-benchmark-claim",
    label: "Benchmark claim not in context",
    expectedDecision: "abstain",
    expectedCitations: [],
    expectedTerms: ["not specified", "insufficient", "benchmark"],
    question: "Did the new reranker beat the public BEIR leaderboard?",
    contexts: [
      {
        id: "rank-a",
        role: "distractor",
        title: "Internal reranker result",
        text:
          "The new reranker improved internal citation support from 81% to 88% on a private support-ticket evaluation set.",
      },
      {
        id: "rank-b",
        role: "distractor",
        title: "Evaluation caveat",
        text:
          "The internal evaluation set is not comparable to public retrieval leaderboards because it uses private tickets and product-specific answer criteria.",
      },
    ],
  },
  {
    id: "multi-hop-supported",
    label: "Multi-hop answer across two passages",
    expectedDecision: "answer",
    expectedCitations: ["obs-a", "obs-b"],
    expectedTerms: ["trace", "span", "quality"],
    question: "How should agent traces connect latency debugging with answer-quality review?",
    contexts: [
      {
        id: "obs-a",
        role: "support",
        title: "Trace structure",
        text:
          "Each agent run stores spans for planning, retrieval, tool calls, model calls, and final response assembly. Every span records duration and status.",
      },
      {
        id: "obs-b",
        role: "support",
        title: "Quality attachment",
        text:
          "The response span should attach evaluator scores for groundedness, citation support, and policy compliance so latency and quality can be reviewed together.",
      },
    ],
  },
];

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function postJson(endpoint, body, timeoutMs = 120000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    const latencyMs = performance.now() - started;
    if (!response.ok) {
      throw new Error(`${endpoint} returned ${response.status}: ${text.slice(0, 400)}`);
    }
    return { payload: JSON.parse(text), latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}

async function getJson(endpoint, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, { signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${endpoint} returned ${response.status}: ${text.slice(0, 400)}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function listModels() {
  const payload = await getJson("/api/v1/models");
  const models = Array.isArray(payload?.models) ? payload.models : Array.isArray(payload?.data) ? payload.data : [];
  if (!models.length) {
    throw new Error("LM Studio returned no models. Start the local server and make sure models are installed.");
  }
  return models;
}

function loadedInstances(models) {
  return models.flatMap((model) =>
    (model.loaded_instances || []).map((instance) => ({
      model: model.key || model.id,
      type: model.type,
      instanceId: instance.id || instance.instance_id || model.key || model.id,
    })),
  );
}

async function unloadInstance(instanceId) {
  console.log(`unloading ${instanceId}`);
  await postJson("/api/v1/models/unload", { instance_id: instanceId }, 120000);
}

async function loadModel(model, options = {}) {
  console.log(`loading ${model}`);
  await postJson(
    "/api/v1/models/load",
    {
      model,
      ...options,
      echo_load_config: true,
    },
    600000,
  );
}

async function unloadAllModels() {
  const models = await listModels();
  for (const instance of loadedInstances(models)) {
    await unloadInstance(instance.instanceId);
  }
}

async function ensureOnlyModelLoaded(model, options = {}) {
  const before = await listModels();
  for (const instance of loadedInstances(before)) {
    if (instance.instanceId !== model && instance.model !== model) {
      await unloadInstance(instance.instanceId);
    }
  }

  const afterUnload = await listModels();
  const alreadyLoaded = loadedInstances(afterUnload).some((instance) => instance.instanceId === model || instance.model === model);
  if (!alreadyLoaded) {
    await loadModel(model, options);
  }

  const afterLoad = await listModels();
  const remaining = loadedInstances(afterLoad);
  const unexpected = remaining.filter((instance) => instance.instanceId !== model && instance.model !== model);
  if (unexpected.length) {
    throw new Error(`Unexpected loaded models remain: ${unexpected.map((instance) => instance.instanceId).join(", ")}`);
  }
  console.log(`loaded model set: ${remaining.map((instance) => instance.instanceId).join(", ") || "none"}`);
}

function extractJsonObject(value) {
  const trimmed = String(value || "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Model response did not contain a JSON object: ${trimmed.slice(0, 200)}`);
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function embed(text) {
  const { payload, latencyMs } = await postJson("/v1/embeddings", {
    model: embeddingModel,
    input: text,
  });
  const vector = payload?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || !vector.length) {
    throw new Error(`Embedding response missing vector for ${embeddingModel}`);
  }
  return { vector, latencyMs };
}

async function callJudge(caseItem) {
  const contextText = caseItem.contexts
    .map((context) => `[${context.id}] ${context.title}\n${context.text}`)
    .join("\n\n");
  const schema = {
    case_id: caseItem.id,
    decision: "answer|abstain",
    answer: "string",
    citations: ["context ids used"],
    confidence: "number between 0 and 1",
    support_notes: "one sentence explaining the grounding decision",
  };
  const messages = [
    {
      role: "system",
      content:
        "You are a strict grounding evaluator. Use only the supplied context. Return one compact JSON object matching the schema. If the context is missing, ambiguous, or conflicting, set decision to abstain. Do not invent policy, benchmark, or numeric facts.",
    },
    {
      role: "user",
      content: `Schema:\n${JSON.stringify(schema)}\n\nQuestion:\n${caseItem.question}\n\nContext:\n${contextText}`,
    },
  ];
  const { payload, latencyMs } = await postJson("/api/v1/chat", {
    model: chatModel,
    system_prompt: messages[0].content,
    input: messages[1].content,
    temperature: 0,
    max_output_tokens: 1200,
    reasoning: "off",
    store: false,
  });
  const messageOutputs = Array.isArray(payload?.output) ? payload.output.filter((item) => item.type === "message") : [];
  const content = messageOutputs.map((item) => item.content || "").join("\n");
  const parsed = extractJsonObject(content);
  return {
    rawContent: content,
    reasoningTokens: payload?.stats?.reasoning_output_tokens || 0,
    totalTokens: (payload?.stats?.input_tokens || 0) + (payload?.stats?.total_output_tokens || 0),
    latencyMs,
    finishReason: "stop",
    parsed,
  };
}

function scoreCase(caseItem, modelRun, semantic) {
  const parsed = modelRun.parsed;
  const validDecision = parsed.decision === "answer" || parsed.decision === "abstain";
  const decisionCorrect = validDecision && parsed.decision === caseItem.expectedDecision;
  const cited = Array.isArray(parsed.citations) ? parsed.citations : [];
  const knownIds = new Set(caseItem.contexts.map((context) => context.id));
  const citationsKnown = cited.every((id) => knownIds.has(id));
  const expectedCitationSet = new Set(caseItem.expectedCitations);
  const citationRecall = expectedCitationSet.size
    ? [...expectedCitationSet].filter((id) => cited.includes(id)).length / expectedCitationSet.size
    : parsed.decision === "abstain"
      ? 1
      : 0;
  const answerText = `${parsed.answer || ""} ${parsed.support_notes || ""}`.toLowerCase();
  const termRecall = caseItem.expectedTerms.filter((term) => answerText.includes(term.toLowerCase())).length / caseItem.expectedTerms.length;
  const unsupportedAnswer = caseItem.expectedDecision === "abstain" && parsed.decision === "answer";
  const hallucinationRisk = unsupportedAnswer ? 1 : 0;
  const score =
    (decisionCorrect ? 0.4 : 0) +
    (citationsKnown ? 0.15 : 0) +
    citationRecall * 0.25 +
    termRecall * 0.15 +
    (hallucinationRisk ? 0 : 0.05);
  return {
    id: caseItem.id,
    label: caseItem.label,
    expectedDecision: caseItem.expectedDecision,
    actualDecision: parsed.decision,
    decisionCorrect,
    citations: cited,
    citationsKnown,
    citationRecall: round(citationRecall),
    termRecall: round(termRecall),
    hallucinationRisk,
    score: round(score),
    semanticMargin: semantic.semanticMargin,
    maxSupportSimilarity: semantic.maxSupportSimilarity,
    maxDistractorSimilarity: semantic.maxDistractorSimilarity,
    latencyMs: round(modelRun.latencyMs, 1),
    totalTokens: modelRun.totalTokens,
    reasoningTokens: modelRun.reasoningTokens,
    finishReason: modelRun.finishReason,
    answer: parsed.answer,
    supportNotes: parsed.support_notes,
  };
}

async function semanticStats(caseItem) {
  const query = await embed(caseItem.question);
  const rows = [];
  for (const context of caseItem.contexts) {
    const contextEmbedding = await embed(`${context.title}\n${context.text}`);
    rows.push({
      id: context.id,
      role: context.role,
      similarity: cosine(query.vector, contextEmbedding.vector),
      embeddingLatencyMs: contextEmbedding.latencyMs,
    });
  }
  const support = rows.filter((row) => row.role === "support").map((row) => row.similarity);
  const distractor = rows.filter((row) => row.role === "distractor").map((row) => row.similarity);
  const maxSupport = support.length ? Math.max(...support) : null;
  const maxDistractor = distractor.length ? Math.max(...distractor) : null;
  return {
    queryEmbeddingLatencyMs: round(query.latencyMs, 1),
    contextRows: rows.map((row) => ({
      ...row,
      similarity: round(row.similarity),
      embeddingLatencyMs: round(row.embeddingLatencyMs, 1),
    })),
    maxSupportSimilarity: maxSupport === null ? null : round(maxSupport),
    maxDistractorSimilarity: maxDistractor === null ? null : round(maxDistractor),
    semanticMargin: maxSupport === null || maxDistractor === null ? null : round(maxSupport - maxDistractor),
  };
}

function aggregate(scored) {
  const average = (values) => round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const answerable = scored.filter((row) => row.expectedDecision === "answer");
  const abstain = scored.filter((row) => row.expectedDecision === "abstain");
  return {
    caseCount: scored.length,
    decisionAccuracy: average(scored.map((row) => (row.decisionCorrect ? 1 : 0))),
    answerableAccuracy: average(answerable.map((row) => (row.decisionCorrect ? 1 : 0))),
    abstentionAccuracy: average(abstain.map((row) => (row.decisionCorrect ? 1 : 0))),
    meanCitationRecall: average(scored.map((row) => row.citationRecall)),
    hallucinationRateOnUnsupported: average(abstain.map((row) => row.hallucinationRisk)),
    meanScore: average(scored.map((row) => row.score)),
    meanLatencyMs: average(scored.map((row) => row.latencyMs)),
    meanReasoningTokens: average(scored.map((row) => row.reasoningTokens)),
  };
}

function chartSvg(metrics) {
  const bars = [
    ["decision accuracy", metrics.decisionAccuracy],
    ["abstention accuracy", metrics.abstentionAccuracy],
    ["citation recall", metrics.meanCitationRecall],
    ["mean score", metrics.meanScore],
    ["unsupported hallucination", metrics.hallucinationRateOnUnsupported],
  ];
  const width = 1600;
  const height = 900;
  const plotX = 150;
  const plotY = 270;
  const plotW = 1180;
  const plotH = 420;
  const gap = 42;
  const barW = (plotW - gap * (bars.length - 1)) / bars.length;
  const colors = ["#0f766e", "#2563eb", "#7c3aed", "#d97706", "#dc2626"];
  const barMarkup = bars
    .map(([label, value], index) => {
      const h = Math.max(4, value * plotH);
      const x = plotX + index * (barW + gap);
      const y = plotY + plotH - h;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="14" fill="${colors[index]}"/>
      <text x="${x + barW / 2}" y="${y - 18}" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="800" fill="#fdfaf0">${round(value, 2)}</text>
      <text x="${x + barW / 2}" y="${plotY + plotH + 42}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#24342f">${label}</text>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">LLM context boundary evaluation results</title>
  <desc id="desc">Bar chart showing decision accuracy, abstention accuracy, citation recall, mean score, and unsupported hallucination rate.</desc>
  <rect width="${width}" height="${height}" fill="#f7f3ea"/>
  <rect x="80" y="74" width="1440" height="752" rx="28" fill="#10241f"/>
  <text x="150" y="158" fill="#f5d46c" font-family="Arial, sans-serif" font-size="54" font-weight="900">LLM Context Boundary Evaluation</text>
  <text x="150" y="214" fill="#d7e7dc" font-family="Arial, sans-serif" font-size="27">Local Qwen3.6 35B judged supported, unsupported, conflicting, and distractor-heavy questions.</text>
  <rect x="${plotX - 34}" y="${plotY - 34}" width="${plotW + 68}" height="${plotH + 105}" rx="22" fill="#fffaf0"/>
  ${barMarkup}
  <text x="150" y="780" fill="#d7e7dc" font-family="Arial, sans-serif" font-size="25">Lower unsupported hallucination is better. All values are computed from ${metrics.caseCount} local evaluation cases.</text>
</svg>
`;
}

function reportMarkdown(results) {
  const metrics = results.metrics;
  const rows = results.scoredCases
    .map(
      (row) =>
        `| ${row.id} | ${row.expectedDecision} | ${row.actualDecision} | ${row.decisionCorrect ? "yes" : "no"} | ${row.citationRecall} | ${row.hallucinationRisk} | ${row.latencyMs} |`,
    )
    .join("\n");
  return `# LLM Context Boundary Evaluation

This project evaluates whether a locally served LLM can hold a strict context boundary under realistic RAG failure modes: missing support, conflicting passages, stale distractors, numeric extraction, and multi-hop synthesis.

## Model Setup

- Chat model: \`${results.models.chatModel}\`
- Embedding model: \`${results.models.embeddingModel}\`
- LM Studio base URL: \`${results.models.baseUrl}\`
- Cases: ${metrics.caseCount}

## Aggregate Results

- Decision accuracy: ${metrics.decisionAccuracy}
- Answerable-case accuracy: ${metrics.answerableAccuracy}
- Abstention accuracy: ${metrics.abstentionAccuracy}
- Mean citation recall: ${metrics.meanCitationRecall}
- Unsupported hallucination rate: ${metrics.hallucinationRateOnUnsupported}
- Mean latency: ${metrics.meanLatencyMs} ms
- Mean reasoning tokens: ${metrics.meanReasoningTokens}

## Case Results

| Case | Expected | Actual | Correct | Citation recall | Unsupported hallucination | Latency ms |
| --- | --- | --- | --- | --- | --- | --- |
${rows}

## Interpretation

The benchmark is intentionally small but not synthetic filler: each case represents a concrete production failure class. The useful signal is not the average alone; it is the per-case trace showing where the model answers, abstains, or cites the wrong context. Engineers can extend the dataset with their own incident-derived cases and keep this as a regression suite for model, prompt, retrieval, and policy changes.
`;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const runs = [];

  try {
    await unloadAllModels();
    await ensureOnlyModelLoaded(embeddingModel, { context_length: 2048 });

    const semantics = new Map();
    for (const caseItem of cases) {
      console.log(`embedding ${caseItem.id}`);
      semantics.set(caseItem.id, await semanticStats(caseItem));
    }

    await unloadAllModels();
    await ensureOnlyModelLoaded(chatModel, { context_length: 8192 });

    for (const caseItem of cases) {
      console.log(`judging ${caseItem.id}`);
      const semantic = semantics.get(caseItem.id);
      const modelRun = await callJudge(caseItem);
    runs.push({
      case: caseItem,
      semantic,
      modelRun,
      score: scoreCase(caseItem, modelRun, semantic),
    });
    }

    const scoredCases = runs.map((run) => run.score);
    const metrics = aggregate(scoredCases);
    const results = {
      generatedAt: new Date().toISOString(),
      models: { baseUrl, chatModel, embeddingModel, keepModelsLoaded },
      metrics,
      scoredCases,
      runs,
    };

    await fs.writeFile(path.join(outDir, "dataset.json"), `${JSON.stringify(cases, null, 2)}\n`);
    await fs.writeFile(path.join(outDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
    await fs.writeFile(path.join(outDir, "output.txt"), `${JSON.stringify(metrics, null, 2)}\n`);
    await fs.writeFile(path.join(outDir, "chart.svg"), chartSvg(metrics));
    await fs.writeFile(path.join(outDir, "README.md"), reportMarkdown(results));
    console.log(JSON.stringify(metrics, null, 2));
  } finally {
    if (!keepModelsLoaded) {
      await unloadAllModels().catch((error) => {
        console.error(`cleanup unload failed: ${error.message}`);
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
