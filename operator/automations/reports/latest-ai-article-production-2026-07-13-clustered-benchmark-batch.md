# Latest AI Article Production — 2026-07-13 Clustered Benchmark Batch

Run time: 2026-07-13 20:59–21:31 EDT

## Outcome

Prepared and validated one atomic three-article batch:

1. `repository-clustered-coding-agent-benchmark-uncertainty`
   - Title: **Test Repository Resampling Before Trusting Coding-Agent Gains**
   - Tier: deep research
   - Reader question: when repository-level tasks share an agent-effect
     component, which confidence interval preserves calibrated coverage, and
     where does the cluster bootstrap itself fail?
2. `gpt-live-full-duplex-evaluation`
   - Title: **Evaluate GPT-Live as a Duplex System, Not a Faster Voice Model**
   - Tier: timely analysis
   - Reader question: how should a voice-agent team change its evaluation
     contract after the July 8 full-duplex consumer release without assuming an
     undocumented API model?
3. `leanstral-1-5-proof-engineering-adoption`
   - Title: **Adopt Leanstral 1.5 as a Proof Worker, Not a Proof Authority**
   - Tier: timely analysis
   - Reader question: which Leanstral 1.5 results justify a pilot, and which
     deterministic trust boundaries must remain outside the model?

The batch contains three distinct customer topics: AI Evaluation, Voice AI,
and Formal Verification. It does not contain a strategy/experiment companion
pair.

## Originality audit

The committed library contained 46 articles before this run and 49 after the
batch. Recent reports and the automation memory were checked before topic
reservation. Rejected mechanisms included dropout scheduling, MLP-channel
interventions, agent release/authorization gates, routing, media provenance,
hallucinated dependencies, scientific-agent control planes, and the earlier
heading-aware retrieval screen.

The deep slot is not a repackaging of an existing gate or published experiment.
It studies the sampling distribution of paired benchmark effects under a
hierarchical Bernoulli process. The voice article is about duplex interaction
evaluation, not generic model routing. The proof article is about Lean 4 proof
search and trust boundaries, not agent authorization.

The required quality exemplars were inspected before the deep slot was
approved:

- `completed-research/dropout-decay`: hypotheses, coefficient calibration,
  matched static baselines, locked streams, paired seeds, confidence intervals,
  regime scope, and reproduction path.
- `policy-verified-agent-tool`: matched-random controls, multi-corpus/scale
  groups, bootstrap intervals, sign tests, cadence sensitivity, worst-case
  analysis, claim withdrawal, and reproducibility manifest.

## Deep evidence project

Project: `operator/diy-project-blogs/projects/clustered-agent-benchmark-uncertainty/`

The version-1 evidence manifest records:

- hypothesis: task-independent intervals under-cover when treatment effects
  vary by repository; repository resampling should be closer to 95% coverage;
- baselines: paired task-normal interval and task-level percentile bootstrap;
- controls: zero treatment heterogeneity and 10/20/40/80 repository-count
  ablation;
- repeats: 1,200 Monte Carlo datasets per scenario with 400 bootstrap resamples
  per interval;
- artifacts: configuration, runner, 3.4 MB per-repeat raw records, aggregate
  results, console audit, figure renderer, and result SVG;
- claim boundary: estimator behavior for the declared balanced hierarchical
  Bernoulli process only, not a measured correlation for a named benchmark.

No Torch or model service was used. The study is seeded JavaScript and therefore
did not trigger the MPS runtime rule.

Headline measurements:

- strong heterogeneity, 40 repositories / 320 tasks: task-normal 91.7%, task
  bootstrap 91.4%, repository bootstrap 93.5% coverage;
- corresponding mean interval widths: 15.3, 15.1, and 16.2 percentage points;
- zero-heterogeneity control: 94.0%, 93.8%, and 93.3% coverage;
- negative result at 10 repositories: repository bootstrap 90.4%, worse than
  task normal at 91.9% and task bootstrap at 91.7%;
- 80-repository ablation: repository bootstrap 94.1% coverage with 0.9-point
  absolute error.

The missing manifest-referenced result figure was added through
`render-figure.mjs`, which reads `results.json`. The public figure is therefore
traceable to the saved aggregate artifact rather than hand-entered values.

## Timely source signals

### GPT-Live / duplex voice

- OpenAI GPT-Live product release — 2026-07-08:
  https://openai.com/index/introducing-gpt-live/
- GPT-Live system card — 2026-07-08:
  https://deploymentsafety.openai.com/gpt-live
- ChatGPT release notes — 2026-07-08 availability boundary:
  https://help.openai.com/en/articles/6825453-chatgpt-release-notes
- OpenAI Realtime API reference — current documented API model/transports:
  https://platform.openai.com/docs/api-reference/realtime
- Full-Duplex-Bench v3 paper — 2026-04-06:
  https://arxiv.org/abs/2604.04847
- Full-Duplex-Bench code/data release — 2026-05-20:
  https://github.com/DanielLin94144/Full-Duplex-Bench
- tau-Voice paper — 2026-03-14:
  https://arxiv.org/abs/2603.13686
- Artificial Analysis speech methodology v1.0 — June 2026:
  https://artificialanalysis.ai/methodology/speech-to-speech-benchmarking
- Full-duplex benchmark observatory — current taxonomy:
  https://www.fullduplex.ai/benchmarks

The article keeps GPT-Live product claims separate from earlier benchmark
measurements and the currently documented `gpt-realtime` API. Missing price,
SLA, context, rate-limit, and enterprise data are labeled unknown rather than
inferred.

### Leanstral 1.5 / proof engineering

- Mistral Leanstral 1.5 release — 2026-07-02:
  https://mistral.ai/fr/news/leanstral-1-5/
- Mistral model documentation — 2026-06-30:
  https://docs.mistral.ai/models/model-cards/leanstral-1-5
- Hugging Face model card — July 2026 snapshot:
  https://huggingface.co/mistralai/Leanstral-1.5-119B-A6B
- FLTEval code/harness — 2026-07-02:
  https://github.com/mistralai/FLTEval
- Mistral changelog — current July 2026 service boundary and 2026-09-30
  endpoint retirement:
  https://docs.mistral.ai/resources/changelogs
- FATE benchmark paper — 2025-11-04:
  https://arxiv.org/abs/2511.02872
- Seed-Prover 1.5 paper — 2025-12-19:
  https://arxiv.org/abs/2512.17260
- PutnamBench paper and leaderboard:
  https://arxiv.org/abs/2407.11214
  https://trishullab.github.io/PutnamBench/leaderboard
- Lean 4 release index and 4.31 notes — 2026-06-17 / 2026-06-13:
  https://lean-lang.org/doc/reference/latest/releases/
  https://lean-lang.org/doc/reference/latest/releases/v4.31.0/
- Mathlib project:
  https://mathlib.org/

Provider-reported benchmark values are labeled as such. PutnamBench, FATE, and
FLTEval are explicitly not treated as normalized or directly comparable.

## Skeptical editorial pass

Machine-readable review:
`operator/automations/reports/latest-ai-article-production-2026-07-13-editorial-review.json`

Scores (question value, technical depth, evidence traceability, methodological
rigor, decision usefulness, clarity/density, visual evidence):

- clustered benchmark: 5, 5, 5, 4, 5, 4, 5 — average 4.71;
- GPT-Live: 5, 4, 4, 4, 5, 5, 5 — average 4.57;
- Leanstral: 5, 5, 4, 4, 5, 4, 5 — average 4.57.

Strongest counterarguments:

- deep: the chosen simulation exposes a designed dependence mechanism and
  cannot estimate dependence in any public benchmark;
- voice: an unavailable consumer model could tempt unsupported API projection;
- proof: most headline values are provider-reported under heterogeneous tasks
  and test-time budgets.

Weakest claims and substantive revisions:

- changed the deep title and conclusion from an absolute resampling directive
  to a conditional test; explicitly recorded that the broad hypothesis failed
  across controls and cluster counts;
- removed the implied 30–40 repository cutoff and made alternative-method
  disagreement the trigger;
- added a non-transfer boundary between ChatGPT GPT-Live behavior and a future
  API, plus a sourced requirements decision matrix;
- reframed Leanstral pass@8 improvement as search-budget yield rather than a
  capability/compute causal claim;
- added the September 30, 2026 Labs endpoint retirement and an export/self-host
  requirement.

## Visuals

Each article has a distinct evidence-bearing SVG:

- coverage estimates with Monte Carlo error bars across heterogeneity and
  repository-count scenarios;
- full-duplex event-evaluation surface with earlier FDB-v3 reference metrics;
- Leanstral benchmark evidence beside the production proof trust envelope.

The candidate SVG upgrader ran on all three assets. Browser review found a
duplicate `data-visual-quality` XML attribute inserted by the upgrader; the
assets existed but rendered as broken images. The duplicate attributes were
removed in source, the candidate and committed gates were rerun, the site was
rebuilt, and `xmllint --noout` passed for all three. This defect was not hidden
or waived.

Post-fix review at 1440×1000 and 390×844 confirmed:

- all SVGs load with natural dimensions 1280×720;
- article and home images use `object-fit: contain`;
- article pages have no horizontal overflow at 390 px;
- labels, bars, error bars, headings, and captions are visible;
- no browser console warnings or errors were recorded.

## Gates and checks

Passed:

1. SVG candidate upgrade: 3/3 assets.
2. Pre-promotion automation candidate gate: exactly 1 deep + 2 timely, three
   topics, originality, evidence, source diversity, manifest, and editorial
   review.
3. Post-fix candidate gate, rerun while promoted article files were temporarily
   held out so originality compared against the prior committed library.
4. Committed public-content gate: 49 articles.
5. Production build: 49 tutorials.
6. Generated-site checks.
7. SVG visual-system check: 49 assets.
8. XML parsing for all three new SVGs.
9. Blocked-label/local-diagnostic scan of new HTML and JSON.
10. HTML/JSON/manifest/search-index spot checks.
11. Desktop and 390 px browser review of all new article pages and the home
    spotlight.
12. `git diff --check`.

Local `node` was unavailable on `PATH`; the bundled Codex Node runtime was used.
The sandbox denied the local preview bind with `EPERM`, so the narrowly approved
outside-sandbox preview server was used only for required browser review and was
stopped afterward. Public web research used the web research tool. No AWS,
Terraform, OpenTofu, local-model, Torch, or other cloud-mutating command ran.

## Publication transaction

The validated batch and initial report were committed as:

- `08767ff` — `Publish benchmark uncertainty and AI analysis batch`

The sandboxed push failed because DNS resolution for `github.com` was blocked.
The narrowly approved outside-sandbox `git push origin main` succeeded:

```text
760f3ef..08767ff  main -> main
```

This report update is committed separately so the durable record contains the
observed remote result. No S3 fallback, AWS CLI, Terraform, or OpenTofu command
was used.
