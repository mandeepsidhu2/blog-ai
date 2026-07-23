---
title: Pilot Moondream 3.1 by Vision Task, Not One Benchmark Rank
description: Compare Moondream 3.1 across detection, referring, and counting cells, then design a license-aware production VLM canary.
topic: Vision-Language Models
level: Advanced
date: 2026-07-22
readingTime: 20
tags: vision-language-models, object-detection, multimodal-ai, model-evaluation, edge-ai
image: /content/v1/assets/moondream-3-1-task-surface.svg
imageAlt: Comparison matrix showing Moondream 3.1 wins and losses across detection, referring, and counting benchmarks
evidenceMode: strategy
qualityTier: timely-analysis
---

Moondream 3.1 is interesting because its July 7, 2026 release makes a compact deployment claim and publishes a benchmark table that resists a simple winner narrative. The model has 9 billion total parameters but activates 2 billion, exposes native `query`, `detect`, `point`, and `caption` skills, and can run through the same API locally or in Moondream Cloud. Yet its own numbers show material task reversals: it leads Qwen3.5 9B on COCO detection, trails it on LVIS and HumanRef, leads on TallyQA, and trails both Qwen3.5 and Gemma 4 12B on CountBench.

That pattern is more useful than a launch superlative. A retail shelf detector, aerial-image locator, document question-answering service, and general captioner do not purchase the same capability. The engineering decision is to build a task-by-runtime-by-license pilot, preserve each benchmark's metric and split, and require matched evidence on the organization's own images before migration.

The published scores are vendor-reported under one stated harness. They are not independent replication, and several comparison models are specialists rather than interchangeable VLM products. Use them to choose test cells, not to skip testing.

## Finding and decision summary

- The July 7 model card reports a mixture-of-experts architecture with 9B total and 2B active parameters.
- Native structured skills cover question answering, captioning, open-vocabulary boxes, and pointing; a single aggregate VLM score cannot represent all four contracts.
- Moondream reports 81.46 F1@0.5 on COCO validation versus 75.58 for Qwen3.5 9B, but 67.40 on LVIS validation versus 71.11.
- On crowded scenes, it reports 74.61 on Dense200 and 52.77 on SKU-110K, while SAM 3 leads CrowdHuman at 82.91 versus Moondream's 74.50.
- Referring detection reverses again: Moondream reports 87.10 on RefCOCO-M but 70.39 on HumanRef, where Qwen3.5 reports 84.90.
- Counting is mixed: Moondream reports 90.35% on CountBench, 74.86% on TallyQA, and 88.68% on PixMo-Count; the row leaders differ.
- The custom model license permits internal use, product components, fine-tuning, quantization, redistribution, and edge deployment, but requires a commercial license when access to general-purpose hosted Moondream inference or self-serve fine-tuning is itself the product.
- Local Photon support is documented for Apple Silicon and NVIDIA Ampere-or-newer hardware; the model card does not establish your latency, memory, power, or concurrency envelope.

Pilot Moondream 3.1 when native detection and pointing simplify a real workflow and 2B active parameters fit the target runtime. Do not approve it from the average of incompatible benchmark rows, and do not treat active parameters as a memory-footprint specification.

## What changed on July 7

The [release post](https://moondream.ai/blog/moondream-3-1-beyond-benchmarks), dated July 7, 2026, introduced Moondream 3.1, a Cloudflare partnership, a new model license, and revised cloud pricing. The [Hugging Face model card](https://huggingface.co/moondream/moondream3.1-9B-A2B) identifies the 9B-total/2B-active architecture and structured skills. It also states that the weights are distributed as safetensors with F32, BF16, and F8_E4M3 tensor types represented in the repository metadata.

The deployment surface matters. The [local runtime guide](https://docs.moondream.ai/running-locally/) documents one API shape for local and cloud execution and names Apple Silicon plus NVIDIA Ampere-or-newer as supported local targets. The model card states that no API key is required for the base local model, while fine-tunes and cloud calls need one. Those are integration facts, not evidence of equivalent performance across targets.

The provider says its benchmark figures use the same settings for Moondream 3.1, Qwen3.5 9B, SAM 3, LocateAnything, and Gemma 4 12B, with detection reported as F1 at IoU 0.5. That helps within the release's table. It does not make a segmentation specialist, a general VLM, and a hosted product equivalent on cost, output schema, or production support.

## Comparison: preserve the task cells

The following table is locally transcribed from the [July 7 Moondream release](https://moondream.ai/blog/moondream-3-1-beyond-benchmarks). Higher is better. Detection rows are F1@0.5; counting rows are percent correct. A dash means the row was not reported for the selected compact comparison, not that a model cannot perform the task.

| Benchmark and split | Contract / metric | Moondream 3.1 9B | Qwen3.5 9B | Strongest reported comparator | Decision signal |
|---|---|---:|---:|---:|---|
| COCO val | open-vocabulary detect, F1@0.5 | 81.46 | 75.58 | SAM 3: 77.06 | favorable general-object screen |
| LVIS val | long-tail detect, F1@0.5 | 67.40 | 71.11 | Qwen3.5: 71.11 | long-tail weakness to reproduce |
| SKU-110K test | dense retail detect, F1@0.5 | 52.77 | 44.27 | Moondream: 52.77 | relevant for shelf-like scenes |
| CrowdHuman | crowded person detect, F1@0.5 | 74.50 | 64.40 | SAM 3: 82.91 | specialist remains stronger |
| RefCOCO-M val | phrase-grounded detect, F1@0.5 | 87.10 | 85.73 | Moondream: 87.10 | narrow referring advantage |
| HumanRef val | human-reference detect, F1@0.5 | 70.39 | 84.90 | Qwen3.5: 84.90 | major reversal; block broad claim |
| CountBench | counting, % correct | 90.35 | 94.66 | Qwen3.5: 94.66 | not the count leader |
| TallyQA | counting, % correct | 74.86 | 72.22 | Gemma 4: 76.41 | competitive, not dominant |
| PixMo-Count val | counting, % correct | 88.68 | 88.66 | Moondream: 88.68 | effectively tied at shown precision |

Do not average these nine numbers. The metrics have two units, datasets differ in size and difficulty, and operational value depends on the target distribution. A two-point change on one curated split does not necessarily outweigh a fourteen-point reversal on another.

Do not attribute every difference to model weights. The release says settings are matched, but a decision-grade reproduction still needs the exact image resize, prompt or skill call, score threshold, non-maximum suppression, maximum detections, and evaluator revision. Until those are replayable, call the rows provider-reported system results.

## Benchmark comparability limits

COCO's [detection task](https://cocodataset.org/#detection-2017) emphasizes common objects, while [LVIS](https://www.lvisdataset.org/) expands to a long-tailed vocabulary. A model can improve on COCO and regress on LVIS without contradiction. SKU-110K's [paper and dataset](https://github.com/eg4000/SKU110K_CVPR19) target densely packed retail shelves. [CrowdHuman](https://www.crowdhuman.org/) focuses crowded pedestrian scenes. Those distributions ask different questions.

RefCOCO-family evaluation and HumanRef are also not interchangeable. A phrase-grounding score depends on reference style, box protocol, and split. Counting datasets vary between direct object counts, question-answer framing, density, and annotation policy. [TallyQA](https://github.com/manoja328/TallyQA) explicitly separates simple and complex questions, while PixMo-Count is a distinct collection and evaluation pipeline.

The release reports point estimates but the public page does not attach confidence intervals, per-category errors, decoding variance, or repeated-run variance beside every row. Without those, 88.68 versus 88.66 on PixMo-Count should be treated as a displayed tie, not evidence of superiority.

Active parameters are not resident weights. A 9B MoE can activate 2B per token while still requiring storage and memory management for more than 2B parameters, depending on quantization, expert placement, and runtime. Measure cold-load bytes, peak resident memory, first-result latency, steady-state throughput, and energy on the exact hardware.

## Engineering decision: a task-by-runtime canary

Start with the user contract, not a benchmark bundle. For detection, define accepted labels, box coordinate convention, IoU threshold, maximum objects, abstention, and latency. For pointing, specify whether one or many points are valid. For query and caption, define factuality, forbidden inference, length, and structured-output schema.

Build a minimum 500-image adjudicated set for each high-value cell, stratified by the failure axes that matter: small objects, crowding, occlusion, glare, rotated views, rare classes, text-heavy scenes, and out-of-domain inputs. Freeze the split before tuning. Compare the incumbent and Moondream with identical image preprocessing, prompts, thresholds, retry policy, hardware, precision, and concurrency.

Report per-cell precision, recall, F1 at the production IoU, calibration or confidence reliability if exposed, malformed-output rate, abstention, p50/p95/p99 latency, cold start, peak memory, throughput, and cost per accepted result. Bootstrap by source scene or capture session rather than individual crop when images are correlated.

Also report the intersection gate: the fraction of images for which the model is correct, schema-valid, and inside the latency budget simultaneously. Separate dashboards can make a system look deployable when accuracy failures and latency failures occur on different examples; the user receives one joint outcome.

The native skills are a potential simplification. A structured `detect()` result may remove prompt parsing and post-processing that a general query interface needs. Test that as a system comparison: count total application code, schema failures, retries, and end-to-end latency, not just model inference.

Predeclare adoption gates. A reasonable template is non-inferior recall within two points on safety-critical classes, at least 20% lower p95 or total cost, zero schema-breaking changes, no subgroup more than five points below the incumbent, and stable results across three repeated runs. These are proposed gates, not vendor claims.

## License and deployment boundary

The [Moondream Model License 1.0](https://moondream.ai/licenses/model/1.0) is not Apache or MIT. Its plain-language table allows internal use, commercial product components, SaaS features powered by the model, fine-tuning, quantization, conversion, redistribution, edge deployment, and customer-controlled cloud use. It requires a separate commercial license for general-purpose hosted Moondream inference, per-customer endpoints operated for others, self-serve hosted fine-tuning, and marketplaces selling model access.

That distinction affects architecture. An internal visual inspection service or a domain workflow powered by the model is described as allowed; reselling generic model access is not. Preserve the exact license version and obtain counsel for the actual product shape. A technical canary cannot approve legal terms.

For local execution, pin the model repository revision, runtime package, precision, and quantization. The [safetensors format documentation](https://huggingface.co/docs/safetensors/index) explains the storage format but not the model's operational memory. Hash the downloaded files and retain the license text with the deployment bill of materials.

## Production Readiness and failure modes

Open-vocabulary detectors can map a user phrase to a visually adjacent class, return duplicate boxes, or miss small and occluded objects. Counting can double-count overlapping instances or infer an answer from scene priors. Query and caption skills can state attributes unsupported by pixels. Treat each as a different incident class.

MoE routing can make performance sensitive to runtime implementation and precision. Quantization may change small-object localization more than high-level captions. A cloud/local API match does not guarantee numerically identical outputs. Run parity tests before using cloud for development and local inference for production.

Monitor input resolution, aspect ratio, task mix, label mix, box count, confidence distributions, empty results, malformed structures, latency, memory pressure, and disagreement with human review. Sample errors by capture source; a global dashboard can hide one camera or geography collapsing.

Rollback to the incumbent if a protected or safety-critical stratum crosses its error budget, schema failures exceed the declared bound, p99 latency violates the queue envelope, runtime updates alter outputs outside tolerance, or license/product boundaries change. Keep a shadow path long enough to replay the exact failed images.

## Adoption boundary and when not to use it

Use Moondream 3.1 when detection or pointing is central, a 9B-total/2B-active MoE fits the deployment plan, and the native structured interface reduces system complexity. It is especially worth testing for dense retail and aerial-style cells suggested by the release results.

Do not use the release table as evidence for medical, biometric, safety, or surveillance fitness. Do not choose it for long-tail detection without reproducing the LVIS-like weakness. Do not select it for counting solely from one dataset. Avoid self-hosting when the organization cannot own model artifacts, runtime patching, hardware qualification, and the custom license review.

The strongest counterargument is that a bespoke canary duplicates a broad vendor benchmark. It does not: the release table itself demonstrates why task weighting determines the winner. The weakest public claim would be that 2B active means small memory; that claim is explicitly rejected. The largest adoption barrier is acquiring representative, adjudicated images with redistribution and privacy rights.

## Rollout and rollback plan

Week one freezes the incumbent, model revision, license, runtime, and task schemas. Week two builds the stratified image set and blinded adjudication guide. Week three runs cloud and local parity plus precision cells. Week four shadows production and measures end-to-end cost, queueing, and human-review escapes.

Advance one task at a time. Detection can ship while counting remains blocked. Keep the old model and preprocessing path deployable, version every output with model/runtime identifiers, and retain enough inputs to reproduce incidents lawfully.

## Source ledger

- [Moondream 3.1 release](https://moondream.ai/blog/moondream-3-1-beyond-benchmarks), July 7, 2026: scores, compared models, metrics, launch scope, and methodology statement.
- [Moondream 3.1 model card](https://huggingface.co/moondream/moondream3.1-9B-A2B), accessed July 22, 2026: 9B total/2B active, skills, formats, and local usage.
- [Local Photon guide](https://docs.moondream.ai/running-locally/), accessed July 22, 2026: API parity, streaming, model loading, and supported hardware families.
- [Model License 1.0](https://moondream.ai/licenses/model/1.0), accessed July 22, 2026: allowed product uses and hosted-service restrictions.
- [COCO detection](https://cocodataset.org/#detection-2017), accessed July 22, 2026: common-object benchmark scope.
- [LVIS](https://www.lvisdataset.org/), accessed July 22, 2026: long-tailed instance vocabulary and evaluation scope.
- [SKU-110K repository](https://github.com/eg4000/SKU110K_CVPR19), accessed July 22, 2026: dense retail benchmark provenance.
- [CrowdHuman](https://www.crowdhuman.org/), accessed July 22, 2026: crowded-person benchmark provenance.
- [TallyQA repository](https://github.com/manoja328/TallyQA), accessed July 22, 2026: counting question categories and evaluation provenance.
- [safetensors documentation](https://huggingface.co/docs/safetensors/index), accessed July 22, 2026: model storage-format boundary.

Moondream 3.1 deserves a serious pilot because the structured visual skills and sparse activation can change a system design. Its own evidence also supplies the caution: there is no task-independent winner. Preserve the cells, test the target distribution, and migrate only the skills that clear their own gate.
