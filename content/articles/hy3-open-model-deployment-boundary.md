---
title: Pilot Hy3 Where 590 GB of Weights Makes Operational Sense
description: Evaluate Tencent Hy3 as an open agent model using its real memory footprint, serving recipes, measured latency tails, and evidence boundaries.
topic: Open Models
level: Advanced
date: 2026-07-14
readingTime: 16
tags: open-models, mixture-of-experts, inference-serving, agent-models
image: /content/v1/assets/hy3-deployment-decision-surface.svg
imageAlt: Decision surface comparing Hy3 model scale, supported accelerator layouts, serving throughput, and adoption boundaries
evidenceMode: strategy
qualityTier: timely-analysis
---

Tencent released Hy3 on July 6, 2026 with an attractive headline: 295 billion total parameters, only 21 billion active per token, a 256k-token context window, and Apache 2.0 weights. The active-parameter number explains part of the compute economics. It does not describe the deployment footprint.

The BF16 checkpoint is roughly 590 GB before KV cache and runtime overhead. Current serving guides place the practical single-node floor at eight 141 GB H200/H20-class GPUs or four 192 GB B200/GB200-class GPUs. Eight 80 GB H100s do not fit the BF16 weights plus useful cache in the documented vLLM recipe. Hy3 is open and uses selective expert compute, but the public evidence does not establish cost efficiency for your workload; it is not a 21B model you casually place on an existing commodity inference node.

That distinction should drive adoption. Pilot Hy3 if you already operate large-memory accelerators, need an Apache-licensed model with native tool calling and controllable reasoning, and can evaluate its parser/runtime coupling. Prefer a smaller dense or MoE model if your primary objective is low operational complexity, modest traffic, or 80 GB GPU reuse.

## Key finding and decision summary

Hy3’s strongest public case is not a provider benchmark rank. It is the combination of open weights, an explicit production-serving path, and measured evidence that active parameters do not determine memory residency.

Use a three-part gate:

1. **Capability:** replay tool, coding, long-context, and hallucination cases from your workload; do not accept Tencent’s internal rates as your SLA.
2. **Fit:** load the exact BF16 or FP8 checkpoint on the accelerator topology you can procure and measure KV-cache headroom at the target context distribution.
3. **Runtime contract:** pin the model, tokenizer, tool/reasoning parser, vLLM or SGLang commit, and speculative-decoding configuration together.

Proceed only if Hy3 wins on accepted task completions per dollar or per reserved accelerator-hour after those costs are included. “21B active” is a useful FLOP clue, not a purchase order.

This article reports no local Hy3 deployment measurement: the required four-to-eight large-memory accelerators were not available. Memory-fit and serving numbers below are therefore attributed to the model card and serving projects, not presented as independent replication. A valid internal pilot must predeclare a cost-matched smaller-model baseline and a hosted-API baseline, then stop if Hy3 does not improve accepted task completions per dollar or if p99 latency exceeds the product deadline.

## What shipped on July 6

The [Tencent release](https://www.tencent.com/tencent-hunyuan-officially-releases-hy3-advancing-agent-capabilities-and-deeper-product-integration/) dates Hy3’s general release to July 6, following an April 23 preview. Tencent reports 295B total parameters, 21B active parameters, and 256k context, plus a 20× increase in average daily preview-token consumption and a 6× increase in WorkBuddy users actively selecting the preview. Those adoption figures are provider product signals, not controlled quality measurements.

The [Hugging Face model card](https://huggingface.co/tencent/Hy3) specifies 80 transformer layers, 192 routed experts with top-8 activation, 64 attention heads with 8 KV heads, a 120,832-token vocabulary, a 3.8B-parameter multi-token-prediction layer, and BF16 support. It also provides a separate [Hy3-FP8 checkpoint](https://huggingface.co/tencent/Hy3-FP8). The base model page currently says no Hugging Face inference provider serves it, so “downloadable” and “one-click hosted” are different availability states.

The license is a meaningful change from many “open” announcements. The model card links an [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), allowing commercial use subject to the license terms. That removes a custom model license negotiation, but it does not remove data-governance, export, security, or downstream-use review.

## Comparison: three evidence layers, three different questions

The table keeps incompatible measurements separate. Sources are Tencent’s July 6 [release](https://www.tencent.com/tencent-hunyuan-officially-releases-hy3-advancing-agent-capabilities-and-deeper-product-integration/), the current [model card](https://huggingface.co/tencent/Hy3), the July 6 [vLLM recipe](https://recipes.vllm.ai/tencent/Hy3), and the current [SGLang cookbook](https://lmsysorg.mintlify.app/cookbook/autoregressive/Tencent/Hy3).

| Evidence layer | Exact setup and measured values | What it supports | Comparability limit |
|---|---|---|---|
| Tencent blind work-task study | 270 experts, 312 valid comparisons; Hy3 2.67/4 vs GLM-5.1 2.51/4 | a provider-run productivity pilot is plausible | task mix, prompts, inference budget, and rater protocol are not fully public |
| Tencent internal reliability evals | hallucination 12.5%→5.4%; commonsense error 25.4%→12.7%; multi-turn issue 17.4%→7.9%; MRCR 42.9%→75.1% | preview-to-release regressions improved on named internal/public surfaces | mixes internal datasets with one public benchmark; no confidence intervals |
| vLLM FP8 serving run | 4×GB300, TP4, 160 prompts, 8192 input/1024 output, concurrency 32; 934 output tok/s, p50 TTFT 506 ms, p99 TTFT 14.54 s | one reproducible high-end serving point | not BF16, not 8×H200, random prompts, and not a quality result |
| SGLang BF16 fit matrix | about 590 GB weights; 8×H200 or 4×B200/B300/GB200 listed as fit configurations | memory-residency and topology planning | no application throughput or cloud price is implied |

Do not average those rows. A 2.67/4 expert score cannot be normalized against 934 tokens/s, and an internal hallucination reduction cannot certify your RAG system. The comparison is a decision ledger: quality hypothesis, reliability signal, runtime measurement, and capacity boundary.

## The active-parameter trap

In a mixture-of-experts model, only a subset of experts executes for a token. Hy3 routes through 8 of 192 experts, which can reduce arithmetic per token relative to a similarly sized dense model. But the router may select different experts for the next token, so the serving process needs the full expert weight set resident or accessible at adequate bandwidth.

At two bytes per BF16 parameter, 295B parameters imply about 590 GB of raw weights. That back-of-the-envelope value matches the SGLang guide. It excludes allocator fragmentation, kernels, activations, the 3.8B MTP module’s details, and KV cache. The 21B active count therefore should not be multiplied by two and presented as a 42 GB deployment estimate.

The [vLLM recipe](https://recipes.vllm.ai/tencent/Hy3) lists 8×H200, 8×H20-3e with 141 GB, or 8×AMD MI300X/MI355X-class paths for the main recipe. It explicitly says 8×H100 80 GB and 8×A100 80 GB do not fit BF16 weights plus KV cache and require multi-node tensor parallelism. The [SGLang hardware table](https://lmsysorg.mintlify.app/cookbook/autoregressive/Tencent/Hy3) also lists four 192 GB B200 or GB200 GPUs because 4×192 GB provides 768 GB before overhead.

Those are framework claims for documented configurations. Before procurement, run a cold-load test and a sustained mixed-length workload. Context length is a maximum addressable limit, not a promise that 256k requests at production concurrency fit the same topology.

## Serving benchmark: read the tail, not only throughput

The vLLM recipe’s representative FP8 run used four GB300 GPUs, tensor parallelism of four, two MTP speculative tokens, 160 random prompts, 8,192 input tokens, 1,024 output tokens, and maximum concurrency 32. It reported 0 failures, 0.91 requests/s, 934.26 output tokens/s, 8,408 total tokens/s, median time to first token of 505.64 ms, and median time per output token of 30.86 ms.

The p99 first-token latency was 14,538.85 ms—nearly 29 times the median. That tail is more operationally important than the attractive aggregate throughput for interactive systems. It may reflect batching and the deliberately long prompt shape; the recipe does not establish a causal explanation. Your pilot should retain the exact arrival process, prompt-length distribution, prefix-cache setting, and SLO percentile.

The recipe disables prefix caching for its benchmark and uses random data. A production agent may benefit from repeated system/tool prefixes, while a retrieval workload may not. Re-enable caching only as a separate treatment and report cache-hit-adjusted latency and token throughput.

## Runtime and parser coupling

Hy3 exposes `high`, `low`, and `no_think` reasoning modes through `reasoning_effort`. It also uses family-specific tool and reasoning parsers. The vLLM guide calls them `hy_v3`; the SGLang cookbook uses suffix-aware `hunyuan` parsers that resolve special tokens from the tokenizer vocabulary.

That is not cosmetic configuration. A model can generate correct semantic tool intent while an outdated parser drops a suffix, fails streaming extraction, or merges reasoning content into the visible answer. Version the tuple:

```text
checkpoint digest
+ tokenizer files
+ chat template
+ tool-call parser
+ reasoning parser
+ serving framework commit/image
+ MTP settings
+ generation parameters
```

The SGLang page says the current path may require source installation or a development image until a tagged release carries the shipping tokenizer support. The vLLM page identifies version 0.26.0+ and newer optimization dependencies. Treat “main branch required” as a change-control cost. Freeze a known-good image after validation and scan dependencies before promoting it.

## Benchmark limitations: what the quality numbers do not establish

Tencent reports an expert blind evaluation in which Hy3 scored 2.67/4 against GLM-5.1 at 2.51/4. It also reports that SWE-bench Verified accuracy varied within four percentage points across CodeBuddy, Cline, and KiloCode scaffolds. These are useful warnings that scaffold choice matters, but they are not a normalized independent leaderboard.

The internal hallucination rate fell by 7.1 percentage points, commonsense error by 12.7 points, and multi-turn issue rate by 9.5 points from the preview baseline. MRCR reportedly rose 32.2 points. The model card does not expose item-level records, repeat counts, or confidence intervals for those figures. Use them to choose pilot tests, not to replace pilot tests.

For coding, run the public [SWE-bench Verified harness](https://github.com/SWE-bench/SWE-bench) with your scaffold and image pin. For long context, use the public [MRCR benchmark description](https://arxiv.org/abs/2501.12630) only after matching its version and prompt construction. These comparisons use different settings, hardware, datasets, and prompts; a provider’s same-name score can move when the scaffold, tool budget, or judge changes.

## Engineering decision: a staged pilot

Start with a fit-and-contract test before a quality bake-off:

1. Load BF16 and FP8 separately on the intended topology; record weight memory, free KV-cache memory, cold-start time, and OOM boundary.
2. Validate plain chat, `no_think`, `high`, parallel tool calls, malformed tool recovery, and streaming cancellation.
3. Replay at least three prompt-length strata and four concurrency levels; report p50, p95, and p99 TTFT and time per output token.
4. Compare against the current production model at equal task and tool budgets.
5. Price accepted completions, not raw tokens/s: include accelerator reservation, idle capacity, retries, and review cost.

Do not start with 256k prompts. Begin below 8k, then test 32k, 128k, and the longest justified workload. Context scaling changes KV-cache pressure and prefill latency; a model that fits at short context may violate the same SLO at long context.

## Adoption boundary: when not to use Hy3

Wait if your serving fleet is standardized on eight 80 GB accelerators and multi-node tensor parallelism is unacceptable. Wait if your organization cannot pin a source-built inference runtime, or if the tool-call parser is part of a regulated protocol requiring a stable tagged dependency.

Prefer a smaller model when traffic is bursty enough that large reserved nodes sit idle, when the workload is mostly classification/extraction, or when an external API already meets privacy and reliability requirements at lower total cost. Open weights do not guarantee economical self-hosting.

Also wait if “Apache 2.0” is being used as a substitute for a model risk review. The license says what you may do with the code and weights; it does not certify training-data provenance, geographic availability, safety performance, or suitability for a high-stakes decision.

## Production readiness, failures, and rollback

Watch four failure classes:

- memory failures: OOM during long prefill, KV-cache eviction, or topology-specific kernel fallback;
- protocol failures: tool JSON split incorrectly, reasoning leakage, or suffix-sensitive parser drift;
- quality failures: unsupported claims, repeated tool loops, and long-context instruction loss;
- operational failures: large p99 TTFT, framework-main regressions, or expert-parallel imbalance.

Keep the incumbent model behind the same gateway contract. Shadow Hy3 with no side effects, then route a bounded workload by stable request hash. Roll back when accepted completion rate falls below the incumbent, p99 TTFT exceeds the declared budget, tool-parse failures cross the error budget, or memory pressure forces context truncation.

The rollback unit is the whole serving tuple, not only the checkpoint. Reverting weights while leaving a new tokenizer or parser in place can preserve the incident.

## Source ledger and dates

- July 6, 2026 — [Tencent release](https://www.tencent.com/tencent-hunyuan-officially-releases-hy3-advancing-agent-capabilities-and-deeper-product-integration/): release date, 295B/21B/256k specifications, product adoption signals, and Apache framing.
- July 6, 2026 snapshot — [Hy3 model card](https://huggingface.co/tencent/Hy3): architecture, internal evaluation signals, quickstart, and 8-GPU recommendation.
- July 2026 snapshot — [Hy3-FP8 model card](https://huggingface.co/tencent/Hy3-FP8): separate quantized checkpoint boundary.
- Updated July 6, 2026 — [vLLM Hy3 recipe](https://recipes.vllm.ai/tencent/Hy3): hardware fit, version dependency, MTP setup, and the 4×GB300 serving measurement.
- Current July 2026 — [SGLang Hy3 cookbook](https://lmsysorg.mintlify.app/cookbook/autoregressive/Tencent/Hy3): 590 GB estimate, four/eight-GPU fit matrix, parser behavior, and runtime maturity.
- Current license — [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0): legal text governing the release.
- Current harness — [SWE-bench repository](https://github.com/SWE-bench/SWE-bench): independent coding-evaluation implementation for local replay.
- January 2025 — [MRCR paper](https://arxiv.org/abs/2501.12630): long-context benchmark provenance and comparability context.
- Current optimization project — [Tencent HPC-Ops](https://github.com/Tencent/hpc-ops): separately built kernels referenced by the vLLM optimization path.

Hy3 is worth a serious pilot because it combines an open license, agent-oriented behavior, long context, and credible serving support. The right lesson from 21B active parameters is not “small deployment.” It is “large resident model with selective compute”—a design that can be efficient only when the memory, runtime, and traffic shape fit together.
