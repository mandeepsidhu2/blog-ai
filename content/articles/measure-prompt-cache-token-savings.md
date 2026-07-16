---
title: Measure Prompt-Cache Token Savings, Not Request Hit Rate
description: Audit prompt-cache economics with exact token sizes, repeated traffic traces, TTL and capacity ablations, negative controls, and cost-aware rollout rules.
topic: LLM Serving
level: Advanced
date: 2026-07-16
readingTime: 24
tags: prompt-caching, inference-economics, kv-cache, capacity-planning, observability
image: /content/v1/assets/prompt-cache-metric-audit.svg
imageAlt: Bar charts comparing prompt-cache request hits, token-weighted hits, and modeled input-cost savings across traffic shapes
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/prompt-cache-metric-audit
evidenceManifest: operator/diy-project-blogs/projects/prompt-cache-metric-audit/evidence-manifest.json
---

Prompt caching is easy to enable and surprisingly easy to measure badly. A dashboard may report that half of requests hit a cache, yet that number does not say whether the hits covered the expensive prefixes. If cached objects range from a short tool schema to a repository-scale context, one hit is not economically equivalent to another.

We tested that distinction with a controlled simulation built from exact `o200k_base` token counts for 52 committed technical articles. Each article body served as a reusable-prefix size proxy. Request traffic was simulated rather than inferred: 40 independently seeded traces per cell, 12,000 requests per trace, Zipf popularity, whole-prefix LRU eviction, three capacities, three sliding TTLs, three traffic cadences, and deliberately different relationships between prefix size and popularity.

At 20% token capacity and a 30-minute TTL, the large-prefix-popular workload produced a 47.6% request hit rate but a 54.7% token-weighted hit rate: a +7.1 percentage-point gap. Reversing the relationship made request hit rate look better—55.4%—while token hit rate stayed at 52.2%, a -3.3-point gap. The fixed-size negative control collapsed the gap to 0.0 points, as it should.

The more consequential result appeared under sparse traffic. With one request every 180 seconds on average and a five-minute TTL, cache writes cost more than uncached input: modeled savings were -7.4% when large prefixes were popular and -11.4% when small prefixes were popular. Extending the same large-prefix workload to a 30-minute TTL changed modeled savings from -7.4% to +31.7%.

The decision is simple: use request hit rate to debug reuse, but use token-weighted hits and realized input-cost ratio to approve a cache policy. A high object hit rate can coexist with weak savings, and an apparently modest object hit rate can cover the tokens that matter.

## Finding and Decision Summary

Three measurements belong in every prompt-cache release review:

1. `request_hit_rate = hit requests / all requests`;
2. `token_hit_rate = cached input tokens / all reusable input tokens`;
3. `realized_cost_ratio = billed input units / uncached input units`.

The first describes frequency. The second describes the amount of avoided prefill or discounted input. The third includes write premiums, expiry, and the provider or serving system's actual accounting.

For the tested trace model:

- large-prefix popularity created a stable +7.1-point token-versus-request gap at 20% capacity;
- small-prefix popularity reversed the sign, so request hits overstated token coverage by 3.3 points;
- fixed-size prefixes forced the two hit rates to match;
- uniform popularity also removed the designed alignment effect;
- under dense traffic, changing the TTL from 5 to 60 minutes did not improve the primary cell because LRU capacity churn dominated and no entries expired;
- under sparse traffic, the five-minute TTL became a negative result: write premiums outweighed cache reads.

Do not set a universal hit-rate target such as 50%. Set a cost or prefill target for each workload class, then observe which request hit rate happens to produce it.

## Research Question and Hypothesis

The hypothesis was: when reusable prefixes vary materially in token size, request hit rate will differ from token-weighted hit rate enough to change the inferred cost benefit of a prompt-cache configuration.

This question matters because provider and self-hosted caching surfaces now expose materially different contracts. OpenAI's July 9, 2026 [GPT-5.6 release](https://openai.com/index/gpt-5-6/) specifies cache writes at `1.25x` uncached input and reads at a 90% discount, alongside explicit breakpoints and a 30-minute minimum cache life. Anthropic's current [prompt-caching documentation](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) documents a default five-minute lifetime that refreshes on use and an optional one-hour cache. Google's June 23 [context-caching guide](https://ai.google.dev/gemini-api/docs/generate-content/caching) separates implicit and explicit caches, with explicit TTL and storage billing.

Self-hosted serving is different again. vLLM's [automatic prefix caching design](https://docs.vllm.ai/en/v0.22.1/design/prefix_caching/) stores hashed KV blocks and uses LRU eviction. SGLang and newer research systems operate over radix trees, block granularity, routers, and heterogeneous workloads rather than the whole objects in this study. [UniCache](https://jxing.me/pdf/unicache-sigmetrics26.pdf) reports that realistic prefix-hit ratios can range from 20% to above 80% and that cache policy affects time to first token and GPU efficiency. [SAECache](https://arxiv.org/abs/2605.18825) goes further by learning semantic-aware eviction policies.

Those systems motivate the question; they do not validate our simulator. The experiment isolates a smaller proposition: even before routing, partial-prefix reuse, or semantic value enter the picture, prefix-size heterogeneity can make the most familiar cache metric incomplete.

## Methodology

### Frozen workload

The workload artifact was generated from Git revision `fd213d3`, before this article existed. It contains 52 public article bodies, each hashed and counted with `tiktoken==0.13.0` using `o200k_base`. Prefix sizes ranged from 2,485 to 5,170 tokens, with a median of 3,010 and a total of 163,605 tokens.

Articles are useful here because they provide real, heterogeneous technical text with stable provenance. They are not a production trace. We did not assume that article readership predicts prompt popularity; popularity was generated independently and deliberately aligned or anti-aligned with size.

The workload builder freezes revision, path, token count, byte count, and SHA-256:

```python
revision = CONFIG["revision"]
paths = [
    line
    for line in git(
        "ls-tree", "-r", "--name-only", revision, "content/articles"
    ).splitlines()
    if line.endswith(".md")
]
encoder = tiktoken.get_encoding(CONFIG["tokenizer"])
records = []

for path in sorted(paths):
    markdown = git("show", f"{revision}:{path}")
    body = markdown.split("---", 2)[-1].strip()
    records.append(
        {
            "slug": pathlib.Path(path).stem,
            "path": path,
            "tokens": len(encoder.encode(body)),
            "bytes": len(body.encode("utf-8")),
            "sha256": hashlib.sha256(
                markdown.encode("utf-8")
            ).hexdigest(),
        }
    )
```

### Traffic and cache model

Every cell used 40 independent seeds and 12,000 requests. Interarrival times were exponential with means of 3, 30, or 180 seconds. Object popularity followed a Zipf distribution with alpha `1.05`.

The treatment was the relationship between popularity rank and prefix size:

- `large-popular`: the largest prefix received rank 1;
- `independent`: ranks were deterministically shuffled per seed;
- `small-popular`: the smallest prefix received rank 1.

The cache held 10%, 20%, or 40% of the total observed prefix tokens. A hit refreshed a sliding TTL of 5, 30, or 60 minutes. On a miss, the whole prefix was admitted and least-recently-used objects were evicted until it fit. The cost model normalized uncached input to `1.0`, a cache write to `1.25`, and a read to `0.10`.

The key accounting logic is:

```python
if index in cache:
    request_hits += 1
    token_hits += size
    billed_input_units += size * cache_read_multiplier
    cache[index]["lastAccess"] = clock
    cache[index]["expiresAt"] = clock + ttl_seconds
else:
    billed_input_units += size * cache_write_multiplier
    while cache and resident_tokens + size > capacity:
        victim = min(
            cache,
            key=lambda candidate: (
                cache[candidate]["lastAccess"],
                candidate,
            ),
        )
        resident_tokens -= sizes[victim]
        del cache[victim]
        evictions += 1
    cache[index] = {
        "lastAccess": clock,
        "expiresAt": clock + ttl_seconds,
    }
    resident_tokens += size
```

The simulator reports both object and token numerators rather than deriving one from the other:

```python
return {
    "requestHitRate": request_hits / requests_per_run,
    "tokenHitRate": token_hits / requested_tokens,
    "hitRateGap": (
        token_hits / requested_tokens
        - request_hits / requests_per_run
    ),
    "costRatio": billed_input_units / requested_tokens,
    "savingsRate": 1 - billed_input_units / requested_tokens,
    "evictions": evictions,
    "expirations": expirations,
}
```

## Baselines, Controls, and Ablations

The economic baseline was no cache: every input token costs `1.0` normalized unit. A cost ratio below `1.0` indicates savings; above `1.0` indicates the cache policy was more expensive.

The measurement baseline was request hit rate, the simple object-count metric the hypothesis challenges.

The fixed-size negative control replaced every prefix size with the observed median while retaining the Zipf request sequence. With identical sizes, every hit covers the same tokens, so request and token hit rates must match. They did: both were 53.2% in the representative cell, with a gap of `+0.000`.

The uniform-popularity control set Zipf alpha to zero. It removed the designed size-rank relationship; request and token hit rates both averaged 19.0% in the representative cell.

Capacity was ablated at 10%, 20%, and 40%. TTL was ablated at 5, 30, and 60 minutes. Traffic cadence was ablated at mean interarrival times of 3, 30, and 180 seconds. This last ablation was added after an exploratory run showed no TTL effect under dense traffic. Rather than claiming TTL did not matter generally, the confirmatory design exposed the boundary where expiry becomes active.

## Results

Billing multipliers in the local calculation follow the July 9 [GPT-5.6 cache contract](https://openai.com/index/gpt-5-6/); all hit rates and savings below come from the saved 40-trace simulation, not from OpenAI traffic.

| Workload at 20% capacity | Mean cadence / TTL | Request hit rate | Token hit rate | Modeled savings |
|---|---:|---:|---:|---:|
| Large prefixes popular | 30 s / 30 min | 47.6% | 54.7% | 37.9% |
| Size and popularity independent | 30 s / 30 min | 52.5% | 52.2% | 35.0% |
| Small prefixes popular | 30 s / 30 min | 55.4% | 52.2% | 35.0% |
| Large prefixes popular, sparse | 180 s / 5 min | 12.8% | 15.3% | -7.4% |
| Large prefixes popular, sparse | 180 s / 30 min | 42.5% | 49.3% | 31.7% |
| Large prefixes popular, sparse | 180 s / 60 min | 47.4% | 54.5% | 37.7% |

The first three rows show why object hit rate can produce the wrong ranking. The small-prefix workload had the highest request hit rate, yet it did not save more tokens or money than the independent workload. The large-prefix workload had the lowest request hit rate but the highest token coverage and savings.

```output
prompt cache metric audit
articles=52 tokenizer=o200k_base seeds_per_cell=40 requests_per_run=12000
design alignment cadence_seconds request_hit token_hit gap savings cost_ratio
observed-size large-popular 30 0.476 0.547 +0.071 0.379 0.621
observed-size independent 30 0.525 0.522 -0.003 0.350 0.650
observed-size small-popular 30 0.554 0.522 -0.033 0.350 0.650
fixed-size-control request_hit=0.532 token_hit=0.532 gap=+0.000
uniform-popularity-control request_hit=0.190 token_hit=0.190 gap=-0.000
```

The sparse five-minute condition is the operational negative result. Its low hit rate was not merely disappointing; the 25% write premium made the cache more expensive than no cache.

```output
large-popular cadence=180s capacity=20% ttl=5m
request_hit=0.128 token_hit=0.153 savings=-0.074 cost_ratio=1.074
mean_expirations=10458.2 of 12000 requests
large-popular cadence=180s capacity=20% ttl=30m
request_hit=0.425 token_hit=0.493 savings=0.317 cost_ratio=0.683
large-popular cadence=180s capacity=20% ttl=60m
request_hit=0.474 token_hit=0.545 savings=0.377 cost_ratio=0.623
```

Under this billing model, the break-even token-hit fraction is not 50%. If `h`
is the fraction of reusable input tokens read from cache, normalized cost is
`1.25(1-h) + 0.10h = 1.25 - 1.15h`. The cache beats uncached input only when
`h > 0.25 / 1.15`, or about 21.7%. That threshold is specific to the declared
write and read multipliers; teams must recompute it whenever provider pricing,
storage charges, or admission behavior changes.

## Statistical Analysis and Uncertainty

Each reported cell mean uses 40 independently seeded request traces. The experiment calculates percentile bootstrap intervals with 5,000 resamples over those trace-level metrics. For the primary large-prefix cell, the mean hit-rate gap was approximately `0.0711`, and its 95% bootstrap interval was `[0.0709, 0.0713]`. The interval is narrow because each trace contains 12,000 requests under the same declared distribution.

That precision should not be confused with external validity. More simulation requests reduce Monte Carlo noise around this model; they do not prove that a production service has Zipf alpha `1.05`, exponential arrivals, whole-prefix LRU, or the same size distribution.

The three designed alignments are sensitivity analyses, not estimates of a latent production correlation. Their purpose is to show that the sign and magnitude of metric divergence depend on which prefixes become popular.

The fixed-size and uniform controls harden the mechanism claim. They show that the gap is not an arithmetic bug or an unavoidable artifact of LRU. Remove size heterogeneity, and the gap disappears. Remove designed size-popularity alignment, and the average gap is effectively zero.

## Failure Analysis and Negative Results

The simulation excludes partial-prefix hits. Managed APIs and KV-block caches may reuse only a portion of a prompt; one request can therefore contain both cached and uncached tokens. Whole-prefix objects make the experiment interpretable but less realistic.

The article corpus is also a size-distribution proxy, not evidence that
production prompts have the same reuse intervals, popularity skew, or
size-popularity correlation. The experiment supports the measurement
mechanism; it does not support a capacity recommendation for an unrelated
service.

The TTL model is sliding: a hit refreshes expiry. Anthropic documents that behavior for its five-minute cache. Other systems may use minimum residency, non-sliding expiry, admission controls, or opaque routing. The modeled 30-minute result should not be projected onto an undocumented provider implementation.

Capacity is global and measured in prompt tokens. Real KV memory depends on model architecture, layer count, KV heads, dtype, block fragmentation, and concurrent decode state. Two prefixes with the same token count can carry different operational costs if they route to different models or replicas.

LRU is deliberately ordinary, not state of the art. UniCache, semantic-aware approaches, prefix-aware routing, and multi-tier caches can outperform it. That strengthens the metric lesson: more sophisticated policies need more, not less, value-aware observability.

The dense-traffic TTL ablation was a null result. At three-second arrivals, the representative workload produced no expirations and identical metrics for 5-, 30-, and 60-minute TTLs. Capacity churn was the active constraint. A team observing that regime should not pay for longer retention merely because a longer TTL is available.

## Production Readiness

Instrument cache accounting at the attempt level:

```text
operation_id, attempt_id, provider, model, route
prompt_tokens, cache_write_tokens, cache_read_tokens
reusable_prefix_tokens, uncached_suffix_tokens
cache_key_version, breakpoint_version, ttl_class
request_hit, token_hit_rate, input_cost, ttft_ms
eviction_or_expiry_reason, fallback_count
```

Aggregate by task class and stable-prefix version. A global mean can hide a profitable coding-agent cache behind an unprofitable low-frequency document route.

Use three release thresholds:

- realized input cost must beat the uncached baseline at the same accepted-task rate;
- p95 time to first token must improve or remain inside the route SLO;
- cache misses must not trigger unsafe retry or fallback amplification.

Roll back when write tokens rise without a corresponding increase in read tokens, when a prompt change moves volatile fields ahead of the cache breakpoint, or when routing spreads one logical prefix across too many replicas to retain reuse.

For self-hosted serving, add block-level occupancy, prefix-routing affinity, and prefill compute avoided. For managed APIs, treat returned usage fields as the billing source of truth and reconcile them against invoices.

## Reproducibility

The evidence directory contains the pinned configuration, tokenizer requirement, revision-hashed workload, simulator, 7,560 trace-level rows, aggregate results with bootstrap intervals, output audit, and artifact-generated SVG.

Rebuild the workload with `tiktoken==0.13.0`, rerun the simulator, then regenerate the figure from `results.json`. No Torch, model inference, or cloud service is required.

An independent replication should replace the article-size proxy with a de-identified production prefix histogram and replay timestamped requests. Preserve size, route, breakpoint version, and reuse intervals while removing prompt contents. Then compare LRU with the actual provider or serving engine and at least one value-aware policy.

## Claim Boundary

The evidence supports a narrow conclusion: under the declared trace model, request hit rate can understate or overstate token reuse, and short-lived caches can cost more than uncached input when writes expire before reuse.

It does not establish the hit rate, savings, latency, or best eviction policy of OpenAI, Anthropic, Google, vLLM, SGLang, or any production workload. The 7.1-point gap is a measured property of this frozen size distribution and simulated popularity relationship.

The durable engineering decision is broader but still modest: approve prompt caching with token-weighted and realized-cost evidence, not an object-count dashboard alone.
