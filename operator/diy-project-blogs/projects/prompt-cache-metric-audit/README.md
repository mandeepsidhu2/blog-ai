# Prompt Cache Metric Audit

This controlled simulation tests whether request hit rate is a sufficient
capacity and cost metric for LLM prompt caching when reusable prefixes vary in
token size.

The frozen workload uses `o200k_base` token counts from the 52 Markdown
articles committed at revision `fd213d3`. Article bodies are prefix-size
proxies, not a claim that article traffic resembles a production AI service.
Request popularity, interarrival times, cache capacity, and TTL behavior are
simulated and fully declared in `config.json`.

## Design

- 40 independently seeded traces per cell.
- 12,000 requests per trace with exponential interarrival times averaging 3,
  30, or 180 seconds.
- Zipf popularity with alpha 1.05.
- Three designed size-popularity relationships: large prefixes popular,
  independent ranks, and small prefixes popular.
- Whole-prefix LRU with 10%, 20%, and 40% token capacity.
- Sliding TTLs of 5, 30, and 60 minutes.
- Input billing proxy: uncached `1.0x`, cache write `1.25x`, cache read `0.10x`.
- Fixed-size negative control and uniform-popularity control.
- Percentile bootstrap intervals over the 40 independent traces.

The simulator records request hit rate, token-weighted hit rate, the difference
between those metrics, modeled input-cost ratio, evictions, and expirations.

## Reproduce

Install the pinned tokenizer into an isolated environment, then run:

```bash
PYTHONPATH=/tmp/blog-ai-prompt-cache-deps python3 build-workload.py
python3 run-experiment.py
python3 render-figure.py
```

`build-workload.py` verifies the frozen Git revision and regenerates
`workload.json`. The main experiment reads that frozen artifact. The renderer
reads only `results.json`.

## Claim boundary

The result is about measurement and policy behavior under the declared trace
model. It is not a benchmark of OpenAI, Anthropic, Google, vLLM, SGLang, a
specific GPU, or a production request trace. Provider-managed caches can use
different routing, admission, eviction, and TTL semantics. Self-hosted prefix
caches operate on KV blocks rather than the whole-prefix objects modeled here.
