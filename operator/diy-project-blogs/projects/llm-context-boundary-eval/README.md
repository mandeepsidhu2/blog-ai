# LLM Context Boundary Evaluation

This project evaluates whether a locally served LLM can hold a strict context boundary under realistic RAG failure modes: missing support, conflicting passages, stale distractors, numeric extraction, and multi-hop synthesis.

## Model Setup

- Chat model: `qwen/qwen3.6-35b-a3b`
- Embedding model: `text-embedding-qwen3-embedding-0.6b`
- LM Studio base URL: `http://127.0.0.1:1234`
- Cases: 8

## Aggregate Results

- Decision accuracy: 1
- Answerable-case accuracy: 1
- Abstention accuracy: 1
- Mean citation recall: 0.813
- Unsupported hallucination rate: 0
- Mean latency: 1017.775 ms
- Mean reasoning tokens: 0

## Case Results

| Case | Expected | Actual | Correct | Citation recall | Unsupported hallucination | Latency ms |
| --- | --- | --- | --- | --- | --- | --- |
| rag-supported-citation | answer | answer | yes | 1 | 0 | 1267.9 |
| unsupported-policy | abstain | abstain | yes | 1 | 0 | 750.4 |
| conflict-needs-review | abstain | abstain | yes | 1 | 0 | 989.2 |
| tool-risk-supported | answer | answer | yes | 0 | 0 | 1097.8 |
| recency-trap | answer | answer | yes | 1 | 0 | 978.7 |
| numeric-extraction | answer | answer | yes | 1 | 0 | 1095.6 |
| unsupported-benchmark-claim | abstain | abstain | yes | 1 | 0 | 852.5 |
| multi-hop-supported | answer | answer | yes | 0.5 | 0 | 1110.1 |

## Interpretation

The benchmark is intentionally small but not synthetic filler: each case represents a concrete production failure class. The useful signal is not the average alone; it is the per-case trace showing where the model answers, abstains, or cites the wrong context. Engineers can extend the dataset with their own incident-derived cases and keep this as a regression suite for model, prompt, retrieval, and policy changes.
