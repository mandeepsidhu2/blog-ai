---
title: Prove Ranker Complementarity Before Enabling RRF
description: Reproduce a two-dataset retrieval audit showing how reciprocal-rank fusion can be score-scale robust yet reduce relevance when one ranker is weak.
topic: Retrieval Evaluation
level: Advanced
date: 2026-07-18
readingTime: 24
tags: reciprocal-rank-fusion, information-retrieval, beir, hybrid-search, relevance-evaluation
image: /content/v1/assets/retrieval-fusion-scale-audit.svg
imageAlt: Grouped bar chart comparing unigram and bigram BM25 with normalized score fusion and reciprocal-rank fusion on SciFact and NFCorpus
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/retrieval-fusion-scale-audit
evidenceManifest: operator/diy-project-blogs/projects/retrieval-fusion-scale-audit/evidence-manifest.json
---

Reciprocal-rank fusion solves a real engineering problem: two retrievers can emit scores on incompatible scales. Converting scores to ranks before combining them removes that unit mismatch. It does not follow that the fused ranking is more relevant.

We tested the distinction on the public BEIR SciFact and NFCorpus test sets. The matched experiment indexed 5,183 scientific abstracts and 3,633 biomedical documents, evaluated 300 and 323 queries, and compared unigram BM25 with adjacent-word-bigram BM25. Treatments included raw score addition under a 100-fold relative-scale sweep, per-query min-max normalization, RRF with constants 10, 60, and 100, and an identical-ranker negative control. Query-level bootstrap intervals used 1,000 resamples with seed 20260718.

The hypothesis was falsified twice. RRF at `k=60` did not improve nDCG@10 over the stronger unigram ranker. It reduced SciFact nDCG@10 from 0.660 to 0.540, a paired mean change of -0.121 with a 95% bootstrap interval from -0.156 to -0.084. On NFCorpus it reduced 0.308 to 0.289, a change of -0.020 with an interval from -0.030 to -0.009. The duplicate-ranker control changed neither ranking nor metric, exactly as it should.

RRF was robust to score units, but it consistently promoted documents from a much weaker bigram ranker. Raw addition exposed the other failure mode: SciFact nDCG@10 moved from 0.665 at a 0.1× bigram scale to 0.489 at 10×. Unit robustness and relevance improvement are different claims.

The decision is consequential for hybrid search and retrieval-augmented generation. Do not enable RRF because two result lists exist. First demonstrate complementarity on held-out queries, compare against the best individual ranker and a normalized-score baseline, and preserve a no-diversity control. RRF is an aggregation rule, not evidence that both inputs deserve equal influence.

## Finding and decision summary

- Unigram BM25 was the strongest individual method on both datasets: 0.660 nDCG@10 on SciFact and 0.308 on NFCorpus.
- Bigram BM25 was materially weaker: 0.460 and 0.122 nDCG@10. RRF therefore combined signal with a systematically poorer ranking.
- RRF at `k=60` lost 18.3% of SciFact nDCG@10 and 6.3% of NFCorpus nDCG@10 relative to unigram BM25.
- The `k` ablation did not rescue the conclusion. RRF at `k=10` reached 0.582 on SciFact and 0.293 on NFCorpus, still below the best individual method with intervals excluding zero.
- Per-query min-max score fusion also lost: -0.077 nDCG@10 on SciFact and -0.015 on NFCorpus. The failure was not peculiar to rank fusion.
- Raw score addition was fragile. Scaling the bigram contribution from 0.1× to 10× moved SciFact nDCG@10 by 0.176 and NFCorpus by 0.030.
- Fusing unigram BM25 with an identical copy produced exactly 0.000 change on every aggregate. Fusion cannot manufacture diversity.
- The lists were superficially diverse—mean top-100 Jaccard overlap was only 0.181 on SciFact and 0.083 on NFCorpus—but bigram BM25 added a relevant top-100 document for only 4 of 300 and 32 of 323 queries. Low overlap is not useful complementarity.

The supported rule is not “never use RRF.” It is “require held-out evidence that each added ranker contributes useful, nonredundant candidates.” Dense-plus-sparse retrieval may satisfy that condition. The two lexical rankers tested here did not.

## Research question, hypothesis, and claim ladder

The preregistered hypothesis in the saved manifest was directional: across SciFact and NFCorpus, RRF at `k=60` would improve nDCG@10 over the stronger individual lexical ranker, remain invariant to a 100× score-scale sweep, and show no gain when the same ranking was fused with itself.

Only the control and invariance logic survived. RRF does not consume retrieval scores, so rescaling scores cannot affect it. The identical-copy control retained precisely the same document order. But the central relevance hypothesis failed on both datasets.

That yields a four-step claim ladder:

1. **Directly measured:** exact lexical rankings, nDCG@10, Recall@100, and MRR on the fixed public test qrels.
2. **Mechanism supported:** equal rank contributions can hurt when one input ranker is substantially weaker; raw sums can change when score scales drift.
3. **Operational inference:** a production fusion rollout needs ranker-removal ablations and score-scale stress tests, not only a fused-versus-old-system comparison.
4. **Not established:** the study does not show that dense-plus-sparse RRF is harmful, that `k=60` is universally wrong, or that learned fusion is preferable.

The original [RRF paper](https://doi.org/10.1145/1571941.1572114) reported broad gains across its evaluated systems. Current systems expose RRF because its rank arithmetic is simple and score-scale agnostic: [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/rrf.html), [Azure AI Search](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking), and [OpenSearch](https://opensearch.org/docs/latest/search-plugins/search-pipelines/rrf-processor/) all document variants of the method. Those sources establish implementation and prior evidence. They do not guarantee that a new pair of production rankers is complementary.

## Methodology

### Datasets and fixed evaluation boundary

[BEIR](https://arxiv.org/abs/2104.08663) was designed to expose retrieval behavior across heterogeneous tasks. We selected two compact public test sets with graded qrels and different relevance structure. SciFact maps scientific claims to evidence abstracts; the test split contains 300 queries and 339 judged query-document pairs. NFCorpus contains 323 test queries and 12,334 judgments over nutrition and biomedical documents. The official [BEIR repository](https://github.com/beir-cellar/beir) records 5,183 SciFact documents and 3,633 NFCorpus documents and supplies the download locations and hashes.

We used title plus body text with no learned model, stemming, stop-word list, query expansion, or relevance feedback. That makes the mechanism inspectable, but it also makes the experiment narrower than a modern neural hybrid stack. Dataset SHA-256 hashes are stored in `results.json` so a rerun cannot silently substitute a later corpus.

### Matched lexical retrievers

The primary ranker tokenizes lowercase alphanumeric unigrams. The second creates adjacent-word bigrams. Both use the same BM25 implementation, `k1=1.2`, `b=0.75`, document set, query set, rank depth, and deterministic tie break. The difference isolates term representation; it does not confound the comparison with a different index engine.

```python
class BM25:
    def __init__(self, docs, mode, k1=1.2, b=0.75):
        self.mode, self.k1, self.b = mode, k1, b
        self.n = len(docs)
        self.lengths = {}
        self.postings = defaultdict(list)
        for doc_id, text in docs.items():
            counts = Counter(terms(text, mode))
            self.lengths[doc_id] = sum(counts.values())
            for term, count in counts.items():
                self.postings[term].append((doc_id, count))
        self.avgdl = sum(self.lengths.values()) / self.n

    def search(self, query, limit=1000):
        scores = defaultdict(float)
        for term in set(terms(query, self.mode)):
            posting = self.postings.get(term, ())
            df = len(posting)
            if not df:
                continue
            idf = math.log(1 + (self.n - df + 0.5) / (df + 0.5))
            for doc_id, tf in posting:
                norm = self.k1 * (
                    1 - self.b + self.b * self.lengths[doc_id] / self.avgdl
                )
                scores[doc_id] += idf * tf * (self.k1 + 1) / (tf + norm)
        return sorted(scores.items(), key=lambda x: (-x[1], x[0]))[:limit]
```

The bigram ranker is intentionally plausible but not tuned. Adjacent phrases can improve precision for multiword concepts, yet exact bigrams have lower recall. That tension is the treatment. If an untuned second ranker hurts, the fusion layer should not conceal that fact.

### Fusion treatments

RRF assigns each document `1 / (k + rank)` from each input list and sums contributions. The constant dampens top-rank differences; smaller values give the head more influence. The implementation keeps absent documents out of that ranker’s contribution rather than inventing a tail rank.

```python
def rrf(left, right, k):
    scores = defaultdict(float)
    for rank, (doc, _) in enumerate(left, 1):
        scores[doc] += 1 / (k + rank)
    for rank, (doc, _) in enumerate(right, 1):
        scores[doc] += 1 / (k + rank)
    return sorted(scores.items(), key=lambda x: (-x[1], x[0]))

def duplicate_control(primary):
    # Same ranking twice: RRF scores double but document order must not change.
    return rrf(primary, primary, 60)
```

Raw score fusion adds unigram score plus a scaled bigram score at 0.1×, 1×, or 10×. Per-query min-max fusion first maps each nonempty score list to `[0,1]`, then adds equal weights. This normalization is invariant to positive affine rescaling within a query but can still overweight a weak ranker.

```python
def score_fusion(left_rows, right_rows, scale=1.0, normalize=False):
    def values(rows):
        mapping = dict(rows)
        if not normalize or not mapping:
            return mapping
        lo, hi = min(mapping.values()), max(mapping.values())
        width = hi - lo
        return {
            doc: (value - lo) / width if width else 0.0
            for doc, value in mapping.items()
        }

    left, right = values(left_rows), values(right_rows)
    candidates = set(left) | set(right)
    combined = (
        (doc, left.get(doc, 0.0) + scale * right.get(doc, 0.0))
        for doc in candidates
    )
    return sorted(combined, key=lambda x: (-x[1], x[0]))
```

## Baselines, controls, and ablations

The primary baseline is the better individual ranker selected separately within each dataset. Unigram BM25 won both, so no post-hoc method switching affected the headline. The normalized-score baseline asks whether score calibration avoids the RRF result. It did not.

The duplicate-ranker negative control is important because it separates “two list inputs” from “two information sources.” If its metric changed, the fusion or tie-breaking implementation would be wrong. Its exact zero delta across 623 queries is a strong implementation check, not evidence of external validity.

The score-scale stress control changes only the multiplier on bigram scores. Candidate documents and per-ranker orders remain fixed. A raw sum that moves under this treatment has no stable meaning unless the production system controls score calibration.

The `k={10,60,100}` ablation tests whether the default-like value of 60 alone caused the loss. Smaller `k=10` reduced the damage by emphasizing top ranks, but every RRF variant remained below unigram BM25 on both datasets. We did not tune `k` on test qrels and then report the winner as confirmatory evidence.

## Results

Sources for dataset semantics and sizes: [BEIR paper](https://arxiv.org/abs/2104.08663) and [BEIR repository](https://github.com/beir-cellar/beir). Numeric results below come from the saved exact run and fixed test qrels.

| Dataset and treatment | nDCG@10 | Recall@100 | MRR | Paired nDCG change vs best individual |
|---|---:|---:|---:|---:|
| SciFact unigram BM25 | 0.660 | 0.886 | 0.631 | baseline |
| SciFact bigram BM25 | 0.460 | 0.696 | 0.438 | -0.200 descriptive |
| SciFact min-max sum | 0.583 | 0.874 | 0.544 | -0.077 [-0.108, -0.047] |
| SciFact RRF `k=10` | 0.582 | 0.883 | 0.539 | -0.078 [-0.105, -0.050] |
| SciFact RRF `k=60` | 0.540 | 0.881 | 0.520 | -0.121 [-0.156, -0.084] |
| NFCorpus unigram BM25 | 0.308 | 0.237 | 0.519 | baseline |
| NFCorpus bigram BM25 | 0.122 | 0.083 | 0.226 | -0.186 descriptive |
| NFCorpus min-max sum | 0.293 | 0.237 | 0.486 | -0.015 [-0.025, -0.006] |
| NFCorpus RRF `k=60` | 0.289 | 0.237 | 0.484 | -0.020 [-0.030, -0.009] |

```output
retrieval-fusion-scale-audit seed=20260718 bootstrap=1000
scifact documents=5183 queries=300 qrels=339
scifact unigram_bm25 ndcg10=0.6605 recall100=0.8859 mrr=0.6315
scifact bigram_bm25  ndcg10=0.4603 recall100=0.6955 mrr=0.4377
scifact rrf_k60       ndcg10=0.5397 delta=-0.1207
scifact delta_ci95=[-0.1557,-0.0840]
nfcorpus documents=3633 queries=323 qrels=12334
nfcorpus unigram_bm25 ndcg10=0.3081 recall100=0.2369 mrr=0.5189
nfcorpus bigram_bm25  ndcg10=0.1218 recall100=0.0831 mrr=0.2256
nfcorpus rrf_k60      ndcg10=0.2885 delta=-0.0195
nfcorpus delta_ci95=[-0.0304,-0.0089]
```

The loss is not just an nDCG artifact. MRR also fell from 0.631 to 0.520 on SciFact and from 0.519 to 0.484 on NFCorpus. Recall@100 barely changed between unigram BM25 and RRF on NFCorpus, showing that the fused system often retained relevant candidates but ordered the first page worse. That distinction matters in RAG: a reranker may recover a candidate-recall gain, but a top-`k` context assembler can pay immediately for poor head ordering.

Candidate overlap explains why a naive diversity metric would have approved the wrong treatment. SciFact's mean top-100 Jaccard overlap was 0.181 and NFCorpus's was 0.083, so the two rankers returned many different documents. Yet bigram BM25 contributed a relevant document absent from unigram BM25's top 100 on only 4 SciFact queries, with 4 such documents total, and on 32 NFCorpus queries, with 49 total. Diversity was abundant; unique relevant yield was scarce.

Raw addition revealed a separate sensitivity:

```output
raw-score scale stress, bigram contribution 0.1x -> 1x -> 10x
SciFact nDCG@10 0.6653 -> 0.6107 -> 0.4889
SciFact range=0.1764; strongest result occurs near unigram dominance
NFCorpus nDCG@10 0.3087 -> 0.2959 -> 0.2789
NFCorpus range=0.0298; strongest result occurs near unigram dominance
duplicate RRF control SciFact delta=0.0000 CI=[0.0000,0.0000]
duplicate RRF control NFCorpus delta=0.0000 CI=[0.0000,0.0000]
RRF k=10/60/100 SciFact=0.5824/0.5397/0.5356
RRF k=10/60/100 NFCorpus=0.2933/0.2885/0.2886
top100 mean Jaccard SciFact=0.1807 NFCorpus=0.0828
queries with bigram-only relevant@100 SciFact=4/300 NFCorpus=32/323
```

## Statistical analysis and uncertainty

Each query is the sampling unit. For a fusion method, we compute its per-query nDCG@10 minus the stronger individual method’s per-query nDCG@10, resample those paired differences with replacement 1,000 times, and report percentile intervals. Pairing preserves query difficulty and gives the decision-relevant uncertainty: whether the new method changes performance on this query population.

The intervals exclude zero for RRF and min-max fusion on both datasets. That is evidence of a negative average change inside each fixed test set. It is not a probability that production RRF will fail. Queries are not sampled from a documented deployment population, qrels are incomplete, and the two datasets share scientific/biomedical language.

The repeats are bootstrap observations, not 1,000 new retrieval executions. Retrieval itself is deterministic. This matters when comparing the study with stochastic model experiments: resampling estimates query-population uncertainty conditional on the saved rankings; it does not measure model-seed or index-build variance.

The SciFact interval is wider because most queries have very few relevant documents, so moving one evidence abstract changes nDCG sharply. NFCorpus has many more judgments per query, but its low Recall@100 shows that this basic lexical setup leaves substantial headroom.

## Error analysis and negative results

Adjacent bigrams fail when relevant documents express the concept with different word order, intervening terms, morphology, or synonyms. Short claim-like queries can generate only a handful of bigrams. A document matching one exact phrase may receive a confident score without covering the rest of the information need. RRF then grants that ranker the same reciprocal contribution as the stronger unigram list.

The normalized-score result is a useful negative result. Min-max scaling fixes units but not ranker quality. If a weak list has a sharp top-score gap, normalization can make that top document look as authoritative as the best document from a strong list. Calibration and complementarity must both be tested.

We did not run a learned weight optimizer. Optimizing on these test qrels would leak evaluation labels and could simply learn to ignore bigrams. A valid learned-fusion comparison needs separate training, validation, and test queries or nested cross-validation. It also needs operational features available at serving time.

We also did not add a dense encoder. That omission is deliberate for the mechanism study but the largest external-validity limit. Dense and lexical rankers may retrieve more complementary candidates than unigram and bigram BM25. [Qdrant's hybrid-search guidance](https://qdrant.tech/documentation/concepts/hybrid-queries/) and [OpenSearch normalization documentation](https://opensearch.org/docs/latest/search-plugins/search-pipelines/normalization-processor/) show several production combination choices; teams still need local judgments to choose among them.

## Production readiness and rollout protocol

Create a frozen, time-split judgment set representing real query classes: head and tail traffic, navigational and exploratory intent, identifier-heavy queries, multilingual inputs, freshness-sensitive requests, and adversarial or malformed text. Keep the final period untouched until the fusion rule and weights are frozen.

Log per-ranker rank, native score, normalized score, fusion contribution, candidate overlap at 10/100/1000, and the final context or answer citation. Measure nDCG or graded precision where labels permit, Recall@`k` for reranking, answer-supportedness for RAG, p50/p95 latency, index cost, and zero-result rate. Slice the metrics because average complementarity can hide a critical regression.

Require four comparisons: each individual ranker, RRF, a normalized-score method, and a ranker-removal ablation. Add the duplicate-list control in offline tests. Stress score transforms by multiplying and shifting one score family; RRF should be invariant, while any raw-score method should either remain stable through explicit calibration or fail the gate.

Do not use candidate-set overlap as the admission test. A second ranker qualifies only when it adds judged-relevant documents on enough held-out queries to offset the head-ordering harm it creates. Track unique relevant yield at the reranker depth, conditional win rate by query class, and the fused-versus-best paired interval. A ranker with low overlap but near-zero unique relevant yield is noise with a diversity costume.

Canary fusion behind a reversible route. Illustrative rollback criteria are a greater than 2% relative loss in judged nDCG@10, a greater than 1 percentage-point loss in answer-supportedness, a greater than 10% p95 retrieval-latency increase, or any critical query slice losing more than 3 percentage points of Recall@50. These thresholds are operating examples, not estimates from BEIR.

If fusion improves Recall@100 but worsens nDCG@10, place a validated reranker between fusion and context assembly. Do not assume the generator will repair ordering. Cap the context budget and measure whether lower-ranked additions displace better evidence.

## Reproducibility

The evidence project contains the runner, configuration, version-1 manifest, dataset hashes, aggregate JSON/CSV, 6,230 per-query-method rows, and the generated SVG. It uses Python's standard library only. No Torch, model service, accelerator, or private data is involved.

```sh
mkdir -p /tmp/beir-data
curl -L https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/scifact.zip -o /tmp/beir-data/scifact.zip
curl -L https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/nfcorpus.zip -o /tmp/beir-data/nfcorpus.zip
unzip -q -o /tmp/beir-data/scifact.zip -d /tmp/beir-data
unzip -q -o /tmp/beir-data/nfcorpus.zip -d /tmp/beir-data
python3 run_experiment.py --data-dir /tmp/beir-data --out-dir . --bootstrap-samples 1000
```

The download dependency is the largest reproduction barrier. Compare the saved SHA-256 values before interpreting metric drift. The runner is exact and deterministic, but upstream availability is not under this repository's control.

## Limitations and claim boundary

Two small English scientific datasets cannot represent ecommerce, source code, legal discovery, conversational memory, multilingual retrieval, or web freshness. Test qrels are finite and may omit relevant documents. BM25 parameters were fixed rather than tuned per dataset. Rank depth was 1,000. No ANN index introduced recall loss, and no latency measurement was attempted.

The second ranker is intentionally related to the first. That gives a clean negative test but does not estimate the value of genuinely heterogeneous dense, sparse, graph, or behavioral signals. The article's figure should therefore be read as a diversity failure, not a benchmark of the best available retrieval stack.

The strongest supported conclusion is narrow: score-scale robustness does not imply relevance improvement, and equal rank fusion can degrade results when one ranker is weak. The evidence supports requiring complementarity tests before rollout.

It does not support disabling existing RRF systems that already pass held-out and online gates. It does not identify a universal `k`, weighting rule, or minimum acceptable individual score. It does not compare commercial engines because their analyzers, candidate depths, tie handling, and RRF variants can differ.

Use RRF when it wins a properly controlled local comparison and its unit invariance is operationally useful. Reject it when the only rationale is that rank fusion is simple. The experiment shows exactly why those are different standards.
