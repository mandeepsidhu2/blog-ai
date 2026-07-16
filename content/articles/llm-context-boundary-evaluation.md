---
title: Build a Local RAG Context-Boundary Regression Harness
description: Run an eight-case local Qwen regression suite for grounded answers, abstention, citation completeness, retrieval pressure, and RAG failure analysis.
topic: Evaluation
level: Advanced
date: 2026-06-27
readingTime: 39
tags: llm-evaluation, rag, local-models, grounding, embeddings, lm-studio
image: /content/v1/assets/llm-context-boundary-evaluation.svg
imageAlt: Case-level matrix for eight local RAG context-boundary tests showing decisions, citation recall, latency, and uncertainty limits
evidenceMode: experiment
---

Local models are useful only if we measure the boundary between what the context supports and what the model is willing to invent. This tutorial builds a small regression harness for that boundary. It is not a benchmark and it cannot certify a model from eight hand-reviewed cases. Its job is narrower: expose concrete grounding failures that engineers can rerun before changing a retriever, prompt, model, chunking strategy, or agent policy.

The recorded run uses LM Studio on a local M-series laptop. It runs Qwen embeddings to measure semantic pressure from support and distractor passages, then unloads the embedding model and runs Qwen3.6 35B for strict grounded judgment. That sequencing matters. On a 64 GB machine, keeping multiple large models loaded can create unstable behavior, slow responses, or empty final generations. The project treats model memory hygiene as part of the experiment, not as an afterthought.

## Research Context

RAG evaluation is not one scalar. [RAGAs](https://aclanthology.org/2024.eacl-demo.16/) separates retrieval quality, faithful use of retrieved passages, and answer quality. [RAGChecker](https://arxiv.org/abs/2408.08067) similarly diagnoses retrieval and generation modules rather than collapsing both into a final-answer score. This harness follows that decomposition in a deliberately smaller form: embedding margins describe retrieval pressure, while decision correctness, citation validity, citation recall, and term coverage describe generation behavior.

Citation quality also needs its own failure surface. [ALCE](https://aclanthology.org/2023.emnlp-main.398/) evaluates citation correctness and completeness independently from answer fluency and correctness. The 2026 [RAGVUE](https://aclanthology.org/2026.eacl-demo.35/) work makes the same methodological point more broadly: aggregate metrics can hide whether a failure came from retrieval, reasoning, grounding, or judge calibration. The local suite therefore preserves every case result and raw response instead of treating the mean score as the conclusion.

## Research Question

The central question is whether a local LLM can preserve a context boundary across cases that look like real production failures:

- a supported RAG answer with an exact citation.
- a question with no supporting policy.
- conflicting retrieved passages where the model should abstain.
- write-capable agent tool controls.
- a stale passage competing with a newer deployment policy.
- numeric extraction under distractor pressure.
- a benchmark claim that is not in context.
- a multi-hop answer that requires two passages.

These cases are intentionally small enough to inspect by hand but varied enough to catch common failure modes. A production team would extend the dataset with incident reviews, support tickets, retrieval misses, and policy exceptions. The important constraint is that every case has an expected decision, expected citations, and terms that should appear in the grounded answer or abstention rationale.

## Model Hygiene

The harness explicitly controls LM Studio model state through the native model-management API. It starts by unloading all currently loaded models. Then it loads only the embedding model for semantic measurements. After embeddings are complete, it unloads that model, loads only the chat model, runs the judgment phase, and finally unloads the chat model.

This is the discipline that made the local run stable:

```javascript
await unloadAllModels();
await ensureOnlyModelLoaded(embeddingModel, { context_length: 2048 });

for (const caseItem of cases) {
  semantics.set(caseItem.id, await semanticStats(caseItem));
}

await unloadAllModels();
await ensureOnlyModelLoaded(chatModel, { context_length: 8192 });

for (const caseItem of cases) {
  const modelRun = await callJudge(caseItem);
  runs.push(scoreCase(caseItem, modelRun, semantics.get(caseItem.id)));
}
```

This is not cosmetic. The earlier lightweight experiments relied on whatever was already loaded in LM Studio. That is not reproducible. A local regression run should declare the model state it needs and clean up after itself. Otherwise the next run inherits hidden memory pressure, stale loaded instances, or a manually loaded model from another task.

## Dataset Design

Each evaluation case is a compact scenario with a question, two context passages, an expected decision, expected citations, and expected terms. A case can be answerable, unsupported, conflicting, or distractor-heavy. The dataset is deliberately written in plain JSON so that it can be reviewed in code review and expanded without a framework.

```javascript
{
  id: "numeric-extraction",
  expectedDecision: "answer",
  expectedCitations: ["eval-a"],
  expectedTerms: ["0.82", "0.76", "recall"],
  question: "What recall@5 threshold blocks a retriever release, and what was last week's value?",
  contexts: [
    {
      id: "eval-a",
      role: "support",
      title: "Retriever scorecard",
      text: "The retriever release gate blocks deployment when recall@5 is below 0.82. Last week's offline score was 0.76, so the index refresh did not ship."
    },
    {
      id: "eval-b",
      role: "distractor",
      title: "Latency scorecard",
      text: "The latency release gate blocks deployment when p95 answer time exceeds 1.8 seconds. Last week's p95 was 1.4 seconds."
    }
  ]
}
```

The case above tests whether the model can extract the right metric while ignoring a plausible distractor. The distractor is not random noise. It has a release gate, a threshold, and a recent value. That is the kind of context collision a RAG system sees when documents share operational vocabulary.

## Semantic Pressure

Before asking the model to answer, the harness embeds the question and each context passage. It computes cosine similarity and records the margin between the strongest support passage and the strongest distractor. This does not decide whether the model is correct. It explains how hard the retrieval setting is.

```javascript
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

const query = await embed(caseItem.question);
const contextEmbedding = await embed(`${context.title}\n${context.text}`);
const similarity = cosine(query.vector, contextEmbedding.vector);
```

In the run, the supported citation case had a semantic margin of `0.236`, while the numeric extraction case had a margin of `0.276`. The recency case was harder, with a margin of `0.061`, because both passages describe release approval. Those margins help explain why a model might cite both passages, over-trust the older passage, or answer correctly while still needing a stricter citation policy.

## Judgment Prompt

The chat model receives a strict grounding instruction. It must return one JSON object with a decision, answer, citations, confidence, and support notes. Unsupported, ambiguous, or conflicting context should produce `abstain`.

```javascript
const schema = {
  case_id: caseItem.id,
  decision: "answer|abstain",
  answer: "string",
  citations: ["context ids used"],
  confidence: "number between 0 and 1",
  support_notes: "one sentence explaining the grounding decision",
};

const systemPrompt =
  "You are a strict grounding evaluator. Use only the supplied context. " +
  "Return one compact JSON object matching the schema. If the context is missing, " +
  "ambiguous, or conflicting, set decision to abstain. Do not invent policy, " +
  "benchmark, or numeric facts.";
```

The important detail is that the output schema is not just for downstream parsing. It is also an evaluation contract. A free-form answer can hide uncertainty. A structured answer makes the model commit to whether it answered, which passages it cited, and how it justified the grounding decision.

## Scoring

The score combines five signals:

- decision correctness.
- whether cited ids exist in the supplied context.
- citation recall against expected citations.
- recall of required answer terms.
- unsupported hallucination risk.

```javascript
const score =
  (decisionCorrect ? 0.4 : 0) +
  (citationsKnown ? 0.15 : 0) +
  citationRecall * 0.25 +
  termRecall * 0.15 +
  (hallucinationRisk ? 0 : 0.05);
```

This weighting is intentionally transparent. Decision correctness dominates because answering when the model should abstain is a release blocker. Citation recall comes next because a correct answer without the right support is not acceptable for production RAG. Term recall is smaller because it is a proxy for content coverage, not a substitute for human review.

The weighting should be treated as a policy decision, not a universal formula. A medical, legal, or security workflow would likely assign even more weight to abstention and citation completeness. A low-risk internal summarizer might tolerate a lower citation recall while still blocking unsupported answers. The key is to document the weighting before running the suite so teams cannot move the goalposts after seeing a favorable or unfavorable model result.

## Results

The recorded run completed eight cases with explicit model loading and cleanup. These are descriptive results from one prompt and one execution per case, not population estimates:

```output
caseCount: 8
decisionAccuracy: 1.000
answerableAccuracy: 1.000
abstentionAccuracy: 1.000
meanCitationRecall: 0.813
hallucinationRateOnUnsupported: 0.000
meanScore: 0.872
meanLatencyMs: 1017.775
meanReasoningTokens: 0
```

The model abstained on the three cases labeled unsupported or conflicting. That is the desired behavior on this fixture, but `3/3` is too small to establish a dependable abstention rate. The result earns a larger regression run; it does not earn a production claim.

The weaker result is citation recall. The tool-risk case answered correctly but missed the expected citations. The multi-hop observability case cited only one of two expected passages. That is a useful failure. It shows that answer correctness and citation completeness are not the same metric. A team shipping a grounded assistant should evaluate both.

The case-level evidence makes the gap visible:

| Case | Expected / actual route | Citation recall | Latency | Observed failure |
| --- | --- | ---: | ---: | --- |
| Supported RAG answer | answer / answer | 1.00 | 1267.9 ms | none observed |
| Unsupported policy | abstain / abstain | 1.00 | 750.4 ms | no repeated-run evidence |
| Conflicting policy | abstain / abstain | 1.00 | 989.2 ms | no repeated-run evidence |
| Tool-risk controls | answer / answer | 0.00 | 1097.8 ms | emitted malformed citation id |
| Recency trap | answer / answer | 1.00 | 978.7 ms | semantic margin only 0.061 |
| Numeric extraction | answer / answer | 1.00 | 1095.6 ms | none observed |
| Unsupported benchmark claim | abstain / abstain | 1.00 | 852.5 ms | no repeated-run evidence |
| Multi-hop support | answer / answer | 0.50 | 1110.1 ms | omitted one required passage |

## Evidence Boundary And Uncertainty

Perfect observed decision accuracy is the easiest number here to misuse. With `8/8` correct decisions, a two-sided 95% Wilson interval is approximately `0.676` to `1.000`. The corresponding intervals are approximately `0.566` to `1.000` for the five answerable cases and `0.439` to `1.000` for the three abstention cases. Those ranges are wide because the sample is small. Reporting only `1.000` would imply more certainty than the run contains.

The mean citation recall of `0.813` should not receive a conventional confidence interval from these eight rows. The cases are intentionally heterogeneous, there was one run per case, and the two citation failures have different mechanisms. The useful evidence is diagnostic: one response formatted a supplied id incorrectly, while one multi-hop response omitted a necessary source. A larger experiment should stratify those failure modes and repeat each case across sampling seeds or deterministic replicas.

Three further boundaries matter:

- The prompt, model build, and decoding configuration were not varied, so the run cannot separate model behavior from prompt behavior.
- Latency comes from one local machine and one model-loading regime; it is useful for regression on that machine, not for serving-capacity estimates.
- `meanReasoningTokens: 0` means the endpoint reported no reasoning-token count. It is not evidence that the model performed no internal reasoning.

The next defensible experiment is a matrix rather than a larger pile of unrelated questions: at least 30 cases per failure class, repeated across prompt versions and model routes, with answer correctness, citation precision, citation recall, abstention calibration, and latency reported separately. Freeze the cases before comparing routes, and reserve incident-derived cases as a held-out regression set.

## Case-Level Findings

The answerable cases all received the correct decision. The supported RAG case and numeric extraction case also achieved full citation recall. The recency trap answered from the newer 2026 release note, not the older 2024 manual approval note. That is the behavior we want from a retriever and model pair when stale and current passages share terms.

The conflict case correctly abstained. This is important because the older passage permitted automatic API key rotation while the current security policy prohibited it. A model that averages those passages into a compromise answer would be unsafe. The correct behavior is to surface the conflict and require review.

The benchmark claim case also abstained. The context mentioned an internal reranker result but explicitly said it was not comparable to public leaderboards. The model did not turn that internal improvement into an unsupported BEIR claim. This is exactly the kind of boundary that protects research and marketing content from accidental overstatement.

## Failure Analysis

The citation gaps are the main issue. In the tool-risk case, the answer included the right controls but did not cite both supporting passages. In the multi-hop case, the model connected trace spans to quality review but cited only one of the two passages required for complete support. This suggests that the prompt should distinguish between answer support and citation completeness.

There are two practical fixes:

- require citations for every material clause in the answer.
- score citation precision and recall separately, then block release on either one.

The suite is also small. Eight cases are enough to debug the harness, not enough to certify a product. A production suite should include dozens or hundreds of cases per route, with cases sampled from real incidents and reviewed by domain owners. The value of this first project is the methodology: controlled context, explicit expected behavior, model hygiene, and per-case artifacts that make failures inspectable.

## Production Readiness

To use this in a real RAG or agent release pipeline, treat the evaluation as a gate:

- run it after model, prompt, retriever, chunking, or policy changes.
- record the model ids, context length, prompt version, dataset version, and loaded model sequence.
- require zero unsupported hallucinations for high-risk routes.
- set separate thresholds for decision accuracy, citation recall, and latency.
- preserve the raw model JSON so failures can be reviewed without rerunning the model.
- add adversarial cases from production incidents, not only happy-path examples.

The model loading discipline should stay in the harness. A local server with limited RAM is a shared resource. If the harness leaves large models loaded, the next experiment starts with hidden state. Explicit unload/load phases make the run reproducible and keep the workstation usable.

## Reproducibility

The experiment produces a compact artifact set:

- `dataset.json` contains every case and expected behavior.
- `results.json` contains raw run details, semantic margins, parsed model outputs, and scores.
- `output.txt` contains aggregate metrics.
- `chart.svg` visualizes the headline metrics.

The default configuration is:

```output
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
LM_STUDIO_CHAT_MODEL=qwen/qwen3.6-35b-a3b
LM_STUDIO_EMBEDDING_MODEL=text-embedding-qwen3-embedding-0.6b
LM_STUDIO_KEEP_MODELS_LOADED=0
```

This is intentionally local-first. The result should be reproducible on the same machine when LM Studio exposes the same models. If the model API cannot load or unload models, the project should stop instead of publishing a guessed result.
