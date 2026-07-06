---
title: Measure Multimodal Retrieval Routing for RAG
description: Build a retrieval-routing harness that compares text-only, unified, and modality-routed policies on recall, modality precision, context size, and safety.
topic: Multimodal RAG
level: Advanced
date: 2026-07-05
readingTime: 34
tags: multimodal-rag, retrieval, embeddings, evals, vector-search, grounding, observability
image: /content/v1/assets/measure-multimodal-retrieval-routing.svg
imageAlt: Bar chart comparing pass rate, recall, and modality precision for text-only, unified, and modality-routed retrieval policies
evidenceMode: experiment
---

Multimodal RAG needs a retrieval test before it needs a larger context window. When a product starts retrieving screenshots, tables, videos, audio transcripts, diagrams, and code snippets alongside text chunks, the failure mode is no longer just "the wrong paragraph came back." The system can retrieve the right topic in the wrong modality, expose a restricted artifact, lose the exact citation locator, or send too much mixed context to the answer model.

This tutorial builds a compact retrieval-routing harness for that problem. The harness compares three policies across fourteen mixed-modality queries. The first policy indexes only text-like artifacts. The second policy uses one unified retrieval pool without modality filters. The third policy routes by required modality and sensitivity before ranking. The measured question is straightforward: which policy retrieves the expected evidence, preserves modality precision, keeps sensitive artifacts out of unauthorized contexts, and avoids unnecessary context bloat?

The result is useful because it is not a model leaderboard. It is a release-test shape. On this benchmark, text-only indexing passed 14.3% of tasks and retrieved five sensitivity violations. Unified untyped retrieval reached 78.6% pass rate, but it carried four context items per query and weak modality precision. Modality-routed retrieval reached 100% pass rate, 100% recall, 100% modality precision, zero sensitivity violations, and the smallest context size. That does not prove every multimodal RAG system should use the same constants. It proves the release decision should be measured at the retrieval-policy layer.

## Research Question

The question is: can a modality-routed retrieval policy beat both a text-only baseline and a unified untyped baseline on quality and safety metrics?

The text-only baseline represents teams that still treat screenshots, charts, video, and audio as secondary artifacts. It indexes text, tables, and code, but it cannot retrieve image or video evidence when the query requires it.

The unified untyped baseline represents the simplest unified embedding deployment. It ranks every asset in one pool and returns the top candidates. That can recover mixed evidence, but it does not know whether the user asked for a screenshot, a table, a video interval, or a public-only source.

The modality-routed policy adds an explicit gate. It filters to required modalities, respects allowed sensitivity, boosts domain match, and returns fewer context items when the query needs only one modality. The goal is not to build the most sophisticated retriever. The goal is to create a falsifiable release check that catches common multimodal failures.

## Dataset Design

The dataset contains twelve evidence assets and fourteen queries. Assets include text pages, screenshots, tables, videos, audio transcript evidence, and code snippets. Each asset has an id, modality, domain, sensitivity label, caption, and tags.

```json
{
  "id": "architecture-diagram-image",
  "modality": "image",
  "domain": "architecture",
  "sensitivity": "internal",
  "caption": "Diagram shows ingestion, modality adapters, vector index, reranker, citation checker, and answer composer.",
  "tags": ["diagram", "architecture", "ingestion", "adapter", "vector", "reranker", "citation", "composer"]
}
```

Queries declare the domain, required modalities, allowed sensitivity, and expected evidence ids. That makes the benchmark inspectable. A query that asks for a dashboard screenshot should not pass because the retriever found a text policy about dashboards. A query that allows only public evidence should not retrieve restricted customer audio.

```json
{
  "id": "ops-health-evidence",
  "text": "Gather operational evidence about retrieval latency, failed citations, failures, and rollback.",
  "domain": "operations",
  "requiredModalities": ["image", "table"],
  "allowedSensitivity": "internal",
  "expectedIds": ["dashboard-screenshot-image", "incident-runbook-table"]
}
```

In production, this dataset should come from actual support tickets, search logs, incident reviews, analytics dashboards, and known bad retrievals. Keep the first version small enough that reviewers can inspect every expected id. Scale only after the labels are trustworthy.

## Policy Implementations

The three policies are short enough to review. The text-only policy indexes text, tables, and code. The unified policy ranks every asset in one pool. The modality-routed policy filters before ranking.

```javascript
const policies = {
  textOnlyIndex(query, assets) {
    return rank(query, assets.filter((asset) => ["text", "table", "code"].includes(asset.modality)), {
      modalityBoost: 0,
      domainBoost: 0.2,
      sensitivityFilter: false,
    }).slice(0, 3);
  },
  unifiedUngated(query, assets) {
    return rank(query, assets, {
      modalityBoost: 0,
      domainBoost: 0.25,
      sensitivityFilter: false,
    }).slice(0, 4);
  },
  modalityRouted(query, assets) {
    const candidates = assets.filter((asset) => {
      const modalityAllowed = query.requiredModalities.includes(asset.modality);
      const sensitivityAllowed = sensitivityRank[asset.sensitivity] <= sensitivityRank[query.allowedSensitivity];
      return modalityAllowed && sensitivityAllowed;
    });
    return rank(query, candidates.length ? candidates : assets, {
      modalityBoost: 2.2,
      domainBoost: 1.1,
      sensitivityFilter: true,
    }).slice(0, query.requiredModalities.length > 1 ? 3 : 2);
  },
};
```

The important design choice is the pre-ranking filter. Rerankers are useful, but they should not be the only place where modality and sensitivity policy appears. If a restricted screenshot is not allowed for the task, it should be filtered before the answer context is assembled.

## Ranking And Scoring

The ranking function uses token overlap over query text, domain, required modalities, asset ids, captions, and tags. It then adds boosts for modality and domain and subtracts sensitivity penalties when the policy allows that behavior.

```javascript
function rank(query, assets, options) {
  const queryTokens = tokenSet(query.text, query.domain, query.requiredModalities);
  return assets
    .map((asset) => {
      const assetTokens = tokenSet(asset.id, asset.modality, asset.domain, asset.caption, asset.tags);
      const overlap = [...queryTokens].filter((token) => assetTokens.has(token)).length;
      const lexical = overlap / (Math.sqrt(queryTokens.size * assetTokens.size) || 1);
      const modalityScore = query.requiredModalities.includes(asset.modality) ? options.modalityBoost : 0;
      const domainScore = asset.domain === query.domain ? options.domainBoost : 0;
      const sensitivityPenalty = sensitivityRank[asset.sensitivity] > sensitivityRank[query.allowedSensitivity]
        ? (options.sensitivityFilter ? 4 : 0.6)
        : 0;
      return { ...asset, score: lexical + modalityScore + domainScore - sensitivityPenalty };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
```

This scoring model is intentionally simple. Replace it with real embedding similarity, hybrid sparse-dense scores, late-interaction scores, or provider file-search scores in your own system. Keep the same test contract: expected evidence ids, required modalities, allowed sensitivity, and measured pass criteria.

## Metrics

The harness computes recall, modality precision, sensitivity violations, context item count, and a simple latency proxy.

```javascript
function evaluate(query, retrieved) {
  const ids = new Set(retrieved.map((asset) => asset.id));
  const expectedHits = query.expectedIds.filter((id) => ids.has(id)).length;
  const recall = expectedHits / query.expectedIds.length;
  const requiredModalities = new Set(query.requiredModalities);
  const modalityMatches = retrieved.filter((asset) => requiredModalities.has(asset.modality)).length;
  const modalityPrecision = retrieved.length ? modalityMatches / retrieved.length : 0;
  const sensitivityViolations = retrieved.filter((asset) =>
    sensitivityRank[asset.sensitivity] > sensitivityRank[query.allowedSensitivity]
  ).length;
  const pass = recall === 1 && modalityPrecision >= 0.5 && sensitivityViolations === 0;
  return { recall, modalityPrecision, sensitivityViolations, contextItems: retrieved.length, pass };
}
```

Recall checks whether expected evidence appears in the retrieved set. Modality precision checks whether the retrieved items are the kind of evidence the query asked for. Sensitivity violations count artifacts above the task's allowed data class. Context items approximate how much mixed evidence the answer model must inspect.

The pass rule is strict: full expected recall, at least half of retrieved evidence in the required modalities, and zero sensitivity violations. You can tune the precision threshold for your product, but do not relax sensitivity violations. A retrieved restricted artifact is still an exposure even if the final answer omits it.

## Results

The run produced this output:

```output
Multimodal retrieval routing experiment
queries=14
textOnlyIndex: pass_rate=0.143 recall_at_k=0.5 modality_precision=0.333 sensitivity_violations=5 mean_context_items=3 latency_ms=2006
unifiedUngated: pass_rate=0.786 recall_at_k=1 modality_precision=0.536 sensitivity_violations=0 mean_context_items=4 latency_ms=2313
modalityRouted: pass_rate=1 recall_at_k=1 modality_precision=1 sensitivity_violations=0 mean_context_items=2 latency_ms=1249
```

The text-only policy failed because many expected answers required screenshots, videos, audio transcript evidence, or modality-specific source objects. It retrieved half of the expected evidence on average, but the pass rate was only 14.3%. That is a useful negative control: text-only systems can look acceptable on text-heavy evals while failing the queries that motivated multimodal retrieval in the first place.

The unified untyped policy did much better on recall. It found all expected evidence on average and passed 78.6% of tasks. The trade-off was weaker modality precision and larger context. It returned four items per query, which increases answer latency and raises the chance that irrelevant evidence influences the generator. In a larger system, this pattern often shows up as plausible but bloated answers.

The modality-routed policy passed every task in this benchmark. It preserved recall, returned only required modalities, avoided sensitivity violations, and used two context items on average. The latency proxy was also lower because fewer artifacts moved into downstream context.

## Error Analysis

Text-only indexing failed visual and media queries by construction. The most important lesson is not that text-only is bad. The lesson is that a text-only baseline is still necessary. It tells the team how much value the multimodal machinery adds, and it catches cases where expensive multimodal retrieval is unnecessary.

Unified untyped retrieval failed because recall alone was not enough. It often retrieved the expected asset, but it also returned unrelated modalities. That creates two production problems. First, the answer model must choose among more evidence than it needs. Second, the product loses a clear explanation of why a screenshot, table, or video was included.

Modality-routed retrieval did not fail on this small benchmark, but that should not be overread. A harder dataset should include misleading captions, stale screenshots, near-duplicate charts, transcripts with speaker ambiguity, and examples where the correct response is unsupported. The next version should also report confidence intervals once enough labeled queries exist.

## Production Readiness

Use this harness as a release gate around the retriever. Run it whenever you change parsers, OCR, caption prompts, embedding models, vector dimensions, top-k, reranking, file-search providers, or answer prompts. Retrieval changes can break grounding without changing a single line of generation code.

Set thresholds by query class. A public product-documentation query may tolerate broader context and lower modality precision. A restricted support workflow should require zero sensitivity violations, exact citation locators, and explicit reviewer routing for screenshots or call transcripts. A dashboard answer may require freshness thresholds measured in minutes.

Instrument production traces with the same fields: query class, predicted modalities, allowed sensitivity, retrieved ids, source modalities, citation locators, context item count, latency by stage, and final answer disposition. Without those fields, the team cannot tell whether a regression came from parsing, indexing, retrieval, reranking, or answer generation.

## Reproducibility

The harness is a Node script with a static JSON dataset. It does not require a local model service, GPU, torch, CUDA, or CPU ML runtime. The script writes `results.json`, `output.txt`, and an SVG chart from the same dataset.

Run it with:

```sh
node run-experiment.mjs
```

The expected output should match the results block above unless you change the dataset, scoring constants, or pass rule. For a production deployment, replace lexical scoring with your real retriever while keeping the same evaluation envelope.

## Guardrails And Rollback Criteria

Roll back a retrieval change when sensitivity violations appear in any restricted query class. Roll back when recall@k drops below the approved threshold for critical workflows. Roll back when modality precision falls far enough that answer context is dominated by irrelevant artifact types.

Also watch for citation regressions. A retriever can return the right parent document while losing the exact page, bounding box, row, timestamp, or transcript span needed to verify the claim. Treat that as a failed retrieval, not a formatting issue.

Finally, set a context budget. If unified retrieval returns too many mixed artifacts, the answer model may become slower and less reliable even when recall improves. A good multimodal retriever is not the one that returns the most evidence. It is the one that returns enough inspectable evidence for the answer and no more.

## Implementation Plan

Start by collecting twenty to fifty real queries that forced users to inspect screenshots, tables, videos, call transcripts, diagrams, or code. Label expected evidence ids and required modalities. Include hard negatives where the answer should be unsupported.

Next, run three policies: the current system, a quality-biased broad-retrieval baseline, and a modality-routed policy. Keep the baselines. They prevent the team from mistaking policy complexity for progress.

Then wire the gate into release review. A pull request that changes parsing, embeddings, retrieval filters, or prompt assembly should attach the metric diff. The reviewer should see pass rate, recall, modality precision, sensitivity violations, context size, latency, and examples of newly failing queries.

Once the harness catches real regressions, add it to the deployment checklist. Multimodal RAG becomes easier to operate when every release answers the same question: did retrieval produce the right kind of evidence, within the right boundary, with citations a human can inspect?

## Limitations

This harness is not a benchmark of Gemini, OpenAI, Anthropic, vector databases, or any specific embedding model. It is a policy test. The lexical scorer is deliberately simple so the behavior is inspectable.

The dataset is small. It is good for explaining failure modes and validating release-test shape, but it is not enough for statistical confidence. Expand it with real traffic, include domain-specific hard cases, and report uncertainty when the sample size grows.

The harness also assumes the asset metadata is correct. In production, OCR, captioning, transcript generation, video segmentation, and table extraction can all fail before retrieval begins. Add parser-quality checks and source-level audits so the retriever is not asked to repair broken inputs.
