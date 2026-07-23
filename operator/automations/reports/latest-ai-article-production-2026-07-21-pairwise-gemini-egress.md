# Latest AI Article Production: Pairwise Judges, Gemini 3.6, and Agent Egress

Date: 2026-07-21

## Outcome

Produced and promoted one atomic three-article batch after candidate and
committed-source gates passed:

1. `audit-pairwise-llm-judges-order-swaps` — deep research, LLM Evaluation
   Reliability.
2. `migrate-gemini-3-6-flash-task-cost-replay` — timely model analysis,
   Multimodal Model Operations.
3. `audit-local-first-coding-agent-data-egress` — timely systems analysis,
   Coding Agent Security.

The library contained three articles dated 2026-07-21 before promotion; this
batch brings that logical publication date to six, below the 50-article daily
maximum. A concurrent, already-pushed three-article batch landed at `c90586d`
during drafting. This run rebased operationally on that commit, re-ran all
58-article gates, and did not modify or stage the concurrent batch's files.

## Originality review

The committed library and recent reports already covered routing case mix,
rare-risk canaries, timeout censoring, retry correlation, token-work admission,
retrieval fusion, prompt-cache accounting, repository-clustered uncertainty,
model migrations, dataset ingestion, and agent authorization gates.

Rejected directions included another cascade/routing threshold article, another
dataset-ingestion interpretation of the Hugging Face incident, and another
generic agent-protocol gate. The selected deep mechanism is distinct: it
separates presentation-order instability from candidate-correlated evaluator
error. The two timely topics address a new July 21 model release and a separate
July 13–15 coding-agent data-egress incident/source release.

## Source signals reviewed

Gemini 3.6 Flash sources included Google's July 21 release announcement, model
specification, migration guide, pricing documentation, and DeepMind benchmark
table; Artificial Analysis's same-day model record and comparison; Datacurve
DeepSWE; the MLE-Bench paper and repository; and the OSWorld repository. The
article preserves within-benchmark comparisons, labels provider point estimates,
and treats the 17% token reduction as workload-specific.

Coding-agent egress sources included SpaceXAI's May 25 launch, July 15 source
announcement and GitHub repository, enterprise lifecycle documentation, July 14
security FAQ, the version-bounded independent v0.2.93 analysis, Axios's July 14
report, the OECD incident record, a public source review, CISA supply-chain
guidance, OpenSSF Scorecard, and Git history documentation. Public copy does not
claim that visible disabled upload code proves current transfer, that transmitted
data trained a model, or that deletion has been independently verified.

The deep article cites the NeurIPS MT-Bench/Chatbot Arena paper, two position
and fairness studies, a 2026 multi-bias mitigation study, Arena's design, and
Autorubric. These sources motivate the mechanism; all reported focal effect
sizes come from the repo-local controlled experiment.

## Deep evidence project

Created `operator/diy-project-blogs/projects/pairwise-judge-swap-audit` with a
version-1 evidence manifest, fixed config, dependency-free runner, README,
19,200 repeat-policy rows plus header, aggregate bootstrap results, statistical
analysis, output capture, and generated SVG figure.

Design:

- 800 repeats of 500 paired answer comparisons.
- 48% latent candidate win probability and a preregistered 52% promotion rule.
- candidate-first, randomized-single, swap-drop, swap-tie, discordant-review,
  and latent-truth policies on matched pairs.
- focal position-plus-style bias, position-only, style-only, and unbiased
  controls.
- 5,000 bootstrap resamples over repeat-level metrics.

Headline findings:

- candidate-first estimated 65.90% for a 48.00% latent candidate and falsely
  promoted in 100% of repeats.
- randomized-single estimated 55.92% and falsely promoted in 95.13%.
- swap-tie estimated 55.97%, exposed 19.86% discordance, and falsely promoted
  in 98.13% because consistent candidate-correlated errors survived.
- swap-drop retained 80.14% coverage and increased the estimate to 57.45%.
- in the position-only control, swap-tie fell to 49.18%, showing that the swap
  repaired the injected order effect.
- in the style-only control, swap-tie remained 57.46% and promoted in 99.00%,
  the central failed mitigation.

The claim boundary is mechanism-level only. No provider judge was measured, no
universal review fraction was selected, and synthetic style exposure is not
presented as a production prevalence estimate.

## Skeptical editorial review

Machine-readable review:
`operator/automations/reports/latest-ai-article-production-2026-07-21-pairwise-gemini-egress-editorial-review.json`.

- Pairwise judge article: 4.57/5 average. Strongest counterargument: injected
  bias makes the focal mechanism expected rather than measuring a live judge.
  Weakest claim narrowed: swap-drop is not generally worse; it targets an
  order-consistent subset estimand. Main barrier: representative blinded human
  labels. Revisions separated estimands, added judge/reviewer cost accounting,
  and required random review of consistent strata.
- Gemini article: 4.43/5 average. Strongest counterargument: the price, token,
  and benchmark signals may already justify broad migration. Weakest claim
  narrowed: benchmark gains are provider point estimates without repeat-level
  uncertainty. Main barrier: matched 3.5 configuration and billed thinking-token
  telemetry. Revisions added no-tool/accounting controls and split rollout into
  independently reversible capability cells.
- Coding-agent egress article: 4.43/5 average. Strongest counterargument: July
  remediation and open source may make a full wire audit disproportionate.
  Weakest claim narrowed: source remnants do not prove current behavior. Main
  barrier: account/server-dependent behavior and limited lawful payload
  inspection. Revisions added vendor-binary versus local-build comparison,
  server-policy replay, and independent transmission/retention/provenance/
  authority controls.

Every rubric dimension is at least 4 and each average is at least 4.3.

## Visuals

- `pairwise-judge-swap-results.svg`: measured focal estimates against 48% latent
  truth, generated from the saved aggregate artifact.
- `gemini-3-6-flash-decision-surface.svg`: sourced price, token, DeepSWE,
  MLE-Bench, OSWorld, context, and unsupported-mode comparison.
- `coding-agent-egress-audit-matrix.svg`: evidence matrix separating execution,
  transmission, retention, provenance, and authority.

The candidate SVG upgrader processed all three; the repository-wide SVG check
passed for 58 assets.

## Validation

Passed:

- candidate SVG visual-system upgrade: 3/3.
- exact three-candidate automation gate with structured editorial review.
- committed-source public content gate: 58 articles.
- production build at `https://learn.toolsite.com`: 58 tutorials.
- generated-site checks.
- repository-wide SVG visual-system check: 58 assets.
- generated privacy scan for internal evidence fields, private paths, and local
  diagnostics.
- generated HTML/JSON checks for canonical paths, local images, TOCs, structured
  blocks, and absence of internal metadata.
- `git diff --check`.
- in-app browser review at 1440×900 and 390×844.

Browser review confirmed each 960×540 visual decoded and rendered at 802×451 on
desktop and 336×189 on mobile without distortion. Mobile document width stayed
exactly 390 pixels. Tables overflowed only inside 352-pixel local scroll
containers. The homepage spotlight decoded at 960×540 and 332 pixels wide.
Browser logs contained no warnings or errors.

The local preview required narrow permission to bind 127.0.0.1:4173 and was
stopped after review. Runtime discovery through the app helper stalled, so the
known bundled Codex Node runtime was used. No Torch, CPU-Torch, CUDA, MPS
experiment, local-model inference, AWS, Terraform, Tofu, S3, deployment, or
cloud-resource command ran.

## Publication

Publication commit: pending creation after this report.

Push target: `origin/main` through the authorized GitHub pipeline path. No S3
fallback is used.
