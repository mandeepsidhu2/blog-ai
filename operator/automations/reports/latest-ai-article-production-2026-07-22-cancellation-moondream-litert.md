# Latest AI Article Production — 2026-07-22

## Outcome

Produced and promoted one atomic three-article batch: exactly one
`deep-research` article and exactly two `timely-analysis` articles on distinct
topics. Candidate and committed-source quality gates passed. No partial batch,
cloud deployment command, Torch run, local-model inference, AWS, Terraform, or
Tofu command was used.

## Originality review and reserved slots

The committed 52-article library, recent automation reports, evidence-project
inventory, automation memory, and the two completed-research exemplars were
reviewed before topic selection. The batch rejected previously used mechanisms,
including clustered resampling, sequential peeking, timeout censoring,
correlated retries, request/token admission, batching arrival shape, workload
mixtures in cascades, and rare-risk canary allocation.

- Deep research — `cancel-orphaned-agent-fanout-work`: asks whether propagating
  an expired parent's lifetime into safely cancellable fan-out children reclaims
  capacity and improves other parents' completion. Evidence path: new matched
  dependency-free discrete-event experiment.
- Timely model analysis — `pilot-moondream-3-1-by-vision-task`: asks how teams
  should interpret Moondream 3.1 when the July 7 release shows material rank
  reversals across detection, referring, and counting cells.
- Timely systems analysis — `adopt-litert-js-by-browser-backend-cell`: asks which
  model/browser/backend cells justify LiteRT.js adoption after the July 9
  release, given WebGPU coverage, experimental WebNN, and export constraints.

## Current source signals

The Moondream analysis used the July 7, 2026 release, Hugging Face model card,
local runtime guide, Model License 1.0, and primary benchmark/dataset sources for
COCO, LVIS, SKU-110K, CrowdHuman, and TallyQA. It preserves F1@0.5 versus
percent-correct units and labels the rows provider-reported system results.

The LiteRT.js analysis used Google's July 9, 2026 announcement, the June 12
getting-started guide, the LiteRT repository, W3C WebNN and WebGPU specifications,
MDN WebGPU documentation, Transformers.js, WebLLM, PyTorch export, and
TensorFlow.js documentation. It confines Google's up-to-3x and 5x-to-60x signals
to the published workload/device boundary.

## Deep evidence project

Created `operator/diy-project-blogs/projects/agent-fanout-cancellation` with a
version-1 evidence manifest, frozen configuration, runnable simulator, figure
renderer, 2,880 repeat-policy rows, aggregate results, paired-bootstrap results,
focal output, and a measured SVG.

The study used 240 matched repeats, 24 workers, six children per parent, a
six-second deadline, four cancellation policies, three scenarios, and 5,000
paired-bootstrap resamples. In the bursty cell, 250-millisecond cooperative
cancellation versus no cancellation:

- increased parent completion from 37.62% to 46.22%, a +8.60 percentage-point
  change with 95% interval [8.27, 8.95];
- reduced orphan work from 5.449 to 0.348 worker-seconds per parent, a -5.101
  second change [-5.271, -4.938];
- reduced total work by 2.241 worker-seconds per parent [-2.301, -2.183];
- reduced maximum queue depth by 22.1 tasks [-23.7, -20.4]; and
- left successful-parent p95 nearly flat, preserving the important negative
  result that survivor latency alone misses the capacity effect.

The 60-second no-timeout control produced exactly zero paired difference for
every metric. Claim boundaries exclude named-provider estimates, universal
250-millisecond targets, remote billing cessation, shared-work cancellation,
and interruption of irreversible side effects.

## Skeptical editorial pass

Machine-readable review:
`operator/automations/reports/latest-ai-article-production-2026-07-22-editorial-review.json`.

- Fan-out cancellation: average 4.86/5. Strongest counterargument: cancellation
  can destroy shared work, cache value, or nearly complete effects. Revisions
  added retained-value/subscriber ledgers, separated local release from remote
  cancellation acknowledgement and billing, and made the joint completion and
  capacity surface the decision gate.
- Moondream 3.1: average 4.43/5. Strongest counterargument: a product dataset can
  overfit and miss the release suite's breadth. Revisions added a correctness ×
  schema × latency intersection gate, narrowed weight attribution to system
  results pending exact harness replay, and elevated the custom license to an
  architecture boundary.
- LiteRT.js: average 4.57/5. Strongest counterargument: the browser device matrix
  may cost more to qualify than local inference saves. Revisions made silent CPU
  fallback a degraded event, added privacy-minimal capability tokens and
  invalidation, and separated graph smoke tests from numeric/task parity.

Every rubric dimension is at least 4 and every article average exceeds 4.3.

## Visuals

Created three distinct evidence-bearing SVGs and ran the SVG upgrader:

- `agent-fanout-cancellation.svg`: measured orphan-work bars and completion
  labels derived from saved aggregates;
- `moondream-3-1-task-surface.svg`: sourced benchmark-margin decision matrix;
- `litert-js-backend-decision-surface.svg`: sourced CPU/WebGPU/WebNN readiness
  and gate matrix.

All decode at 960×540. At 1440×900 the three article pages had no document
overflow and tables stayed in local scroll containers. At 390×844, document
width remained exactly 390 pixels, images rendered at 336×189, tables scrolled
inside 352-pixel containers, the home spotlight rendered, and browser logs were
clean.

## Checks

- Candidate SVG upgrader: passed for 3/3 assets.
- Candidate automation gate with editorial review: passed for exactly 3
  articles.
- Daily count: 3 articles dated 2026-07-22, below the limit of 50.
- Committed public-content gate: passed for 55 articles.
- Production build: built 55 tutorials.
- Generated-site gate: passed.
- SVG visual-system check: passed for 55 assets.
- SVG and sitemap XML parsing: passed.
- Generated-output privacy/internal-metadata scan: passed.
- HTML/JSON title spot checks: passed.
- `git diff --check`: passed.
- In-app browser desktop/mobile review: passed.

## Git publication

The article-batch commit and push outcome are recorded in the final update to
this report after the passing source set is committed and sent to `origin/main`.

## Worktree boundary

The untracked `operator/diy-project-blogs/projects/pairwise-judge-swap-audit`
directory was not created or used by this run and is excluded from staging and
publication.
