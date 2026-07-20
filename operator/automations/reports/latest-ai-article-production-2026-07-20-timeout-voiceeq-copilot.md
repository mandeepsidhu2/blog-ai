# Latest AI Article Production — 2026-07-20

Run completed: 2026-07-20 11:20 EDT

## Outcome

Produced and promoted one atomic three-article batch containing exactly one
`deep-research` article and two `timely-analysis` articles on distinct topics.
The committed library increased from 43 to 46 articles. Exactly three articles
are dated July 20, below the daily maximum of 50.

The committed library, automation memory, recent run reports, evidence-project
inventory, and required completed-research exemplars were inspected before slot
reservation. Retry amplification, batching, prompt caching, token admission,
retrieval fusion, sequential peeking, repository-clustered uncertainty, and
recent model-deployment theses were rejected as repeated mechanisms.

## Reserved slots and sources

1. `measure-timeout-censoring-latency` — AI Performance Engineering. Reader
   question: can endpoint timeouts reverse a completed-only p95 ranking? Evidence
   path: a new paired stochastic simulation with deadline sweeps and a no-tail
   ablation.
2. `evaluate-real-world-voiceeq-adoption` — Voice AI Evaluation. Reader
   question: what can the July 15 Real World VoiceEQ release decide, and what
   still needs a local listening study? Evidence path: the technical report,
   launch post, leaderboard, ITU P.800, VoiceMOS, Common Voice, CHiME, and NIST.
3. `copilot-usage-metrics-without-productivity-theater` — AI Engineering
   Analytics. Reader question: what can GitHub's July 17 repository and app
   metrics support without mislabeling activity as productivity? Evidence path:
   GitHub release notes and API documentation joined with DORA, SPACE, causal
   study, privacy, and measurement-control sources.

Timely source claims record dates, exact field or protocol scope, and local
inference boundaries. Tables preserve native units and explicitly reject
cross-row normalization when interfaces, datasets, denominators, or scoring
settings differ.

## Deep evidence project

Evidence project:
`operator/diy-project-blogs/projects/timeout-censoring-latency-audit`.

The dependency-free JavaScript experiment used 240 paired repeats, 5,000
requests per endpoint and repeat, four deadlines, two endpoint distributions,
and a no-tail control. It wrote 2,880 repeat-condition rows and used 5,000 paired
bootstrap resamples per focal metric. No Torch or model service was used.

At the eight-second focal deadline:

- steady: 100.00% completion, 2.414 s completed-only and deadline-aware p95;
- fast/spiky: 94.31% completion, 1.259 s completed-only p95, 7.970 s
  deadline-aware p95, and 9.331 s latent p95;
- completed-only delta: -1.155 s, 95% CI [-1.157, -1.154];
- deadline-aware delta: +5.556 s, 95% CI [+5.500, +5.585];
- completion delta: -5.69 percentage points, 95% CI [-5.73, -5.65].

Removing the six-percent tail made conditional and deadline-aware rankings
agree. The article retains two negative boundaries: deadline-aware p95 is only a
descriptive censoring-boundary statistic, and restricted mean observed time can
still prefer a fast body despite a release-blocking timeout rate.

The version-1 manifest traces the falsifiable hypothesis, steady and latent
baselines, paired control, no-tail ablation, deadline sweep, 240 repeats,
reproduction commands, claim boundary, code, configuration, repeat rows,
aggregates, statistical analysis, focal output, and result SVG.

## Skeptical editorial pass

Review artifact:
`operator/automations/reports/latest-ai-article-production-2026-07-20-timeout-voiceeq-copilot-editorial-review.json`.

- Timeout censoring averaged 4.71/5. The review narrowed the estimator claim,
  added the no-tail mechanism control, preserved the failed restricted-mean
  shortcut, and added A/A plus joint rollback criteria.
- VoiceEQ averaged 4.57/5. The review separated ratings from independent sample
  size, limited the “no best model” claim to tested configurations and weights,
  retained humans for perceptual constructs, and added product-specific gates.
- Copilot metrics averaged 4.71/5. The review rejected an undefined readiness
  score, preserved null semantics, added A/A and clustered uncertainty, and
  prohibited individual performance use.

Every rubric dimension is at least 4. Counterarguments, weakest claims,
reproduction barriers, and four substantive revisions per article are recorded.

## Visuals and validation

Three distinct evidence-bearing SVGs were created: the measured timeout-ranking
curve, the VoiceEQ domain/adoption matrix, and the Copilot evidence-layer
decision surface. The SVG upgrader was run. Its duplicate root-attribute defect
was detected by `xmllint`; candidate roots were repaired, then the upgrader
check and XML parsing passed.

- Pre-promotion automation gate with editorial review: passed exactly three
  candidates.
- Committed public-content gate: passed 46 articles.
- Production build: built 46 tutorials.
- Generated-site checks: passed.
- SVG visual-system check: passed 46 assets.
- Generated public-boundary scan and HTML/JSON spot checks: passed.
- `git diff --check`: passed.
- In-app browser review at 1440×900 and 390×844: all images decoded, TOCs
  rendered, tables stayed in horizontal overflow containers, and browser logs
  contained no warnings or errors.
- Mobile review found a 511 px document overflow caused by a long inline GitHub
  REST path. The prose was rewritten without losing endpoint semantics, the
  site was rebuilt, all committed gates were rerun, and final width was 390 px.
- Mobile and desktop homepage spotlight assets decoded; the 390 px spotlight
  rendered without clipping.

The local preview needed narrow outside-sandbox permission to bind
`127.0.0.1:4173`; it was stopped after review. Local `node` was absent, so the
ChatGPT-bundled Node runtime was used. No Torch, CPU-Torch, CUDA, MPS experiment,
local-model inference, AWS, Terraform, Tofu, S3, or cloud-resource command ran.

## Git publication

- Atomic batch commit: `f668330` (`Publish latency, voice, and Copilot analysis batch`).
- Local `main` also contains the prior run's two already-reviewed commits that
  remained ahead of `origin/main` after its DNS-blocked push.
- The sandboxed push failed GitHub DNS resolution. The narrowly authorized
  network retry succeeded, advancing `origin/main` from `8db9a53` through
  report commit `250a2b5`; the pipeline now has the prior completed batch and
  this run's atomic batch.
