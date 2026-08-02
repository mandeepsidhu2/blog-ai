# Latest AI Article Production: Conformal Coverage, Qwen3.7 Flash, and Agent Studio SSRF

Date: 2026-07-31

## Outcome

Produced and promoted one atomic three-article candidate batch:

1. `audit-conformal-coverage-by-slice` — deep research, Uncertainty Quantification.
2. `pilot-qwen-3-7-flash-by-workload-cell` — timely analysis, Multimodal Models.
3. `repair-agent-studio-api-proxy-ssrf` — timely analysis, AI Application Security.

The committed library contained 64 articles and three articles dated 2026-07-31
before this run. The batch adds three, leaving six for the date and remaining
below the 50-article daily maximum.

## Originality review

The committed library and recent run reports were compared before topic
reservation. A generic calibration-error article was rejected because the
library already covers calibration inside cascade decisions. Managed-agent
platform comparisons and China AI standards were also rejected because recent
runs already used those mechanisms or source clusters. The selected deep study
tests a distinct failure mode: marginal conformal coverage concealing severe
undercoverage in a decision-critical slice. The timely pieces address separate
July 25 and July 20 developments, with no shared evidence package or renamed
companion framing.

The requested research exemplars were inspected. The dropout-decay exemplar
was present at the supplied path. The supplied policy-verified-agent-tool path
was absent; its relocated copy under `completed-research/policy-verified-agent-tool`
was inspected instead.

## Source signals reviewed

The Qwen3.7 Flash article uses Qwen's July 25 changelog, product contract, and
vision documentation, plus primary OpenAI, Google DeepMind, and Anthropic model
materials. It preserves the provider's conflicting 64k and approximately
131.07k output limits as a pilot test instead of silently selecting one. Its
price table is arithmetic at dated public rates, not a claim of comparable
completed-task cost. The recommended decision unit includes retries, tool
errors, latency, schema validity, safety, and invoice reconciliation.

The Agent Studio article uses Google's July 20 security note and current web-app
quickstart, OWASP's SSRF guidance, RFC 3986, CWE-918, IANA registries, MDN, and
Google Cloud networking guidance. It does not infer an undisclosed exploit or
claim a bypass in Google's fixed implementation. The locally constructed test
matrix covers parsing, DNS, redirects, identity, methods, headers, bodies, and
network egress, with explicit regeneration, canary, rollback, and retrospective
incident-review boundaries.

Both timely articles include dated claims, diverse primary sources,
substantive locally constructed comparison tables, comparability limits,
engineering decisions, and adoption boundaries.

## Deep evidence project

Created `operator/diy-project-blogs/projects/conformal-slice-coverage-audit`
with a version-1 evidence manifest, locked configuration, dependency-free
runner, figure renderer, README, 16,000 repeat-policy rows, aggregate results,
statistical analysis, focal output capture, and generated SVG figure.

Design:

- 800 matched repeats with 4,000 calibration and 12,000 test cases each;
- five calibration policies across four scenarios;
- routine residual standard deviation 1 and critical residual standard
  deviation 3 in the focal mechanism;
- exchangeable 5% critical, shifted 5%-to-20% critical, equal-noise negative
  control, and limited-calibration scenarios;
- finite-sample split-conformal order statistics and 5,000 paired bootstrap
  resamples over repeat-level differences.

Headline findings:

- Under exchangeable rare/noisy sampling, pooled intervals reached 90.01%
  marginal coverage but only 44.62% critical-slice coverage; routine coverage
  was 92.40%.
- When critical prevalence shifted from 5% in calibration to 20% in test,
  pooled marginal coverage fell to 82.82% and critical coverage was 44.60%.
- Slice calibration restored shifted critical coverage to 90.28%, a paired
  improvement of 45.68 percentage points (95% bootstrap interval 45.52 to
  45.85), while increasing mean width by 0.543 (0.539 to 0.548).
- In the equal-noise control, pooled global, routine, and critical coverage were
  approximately 89.98%, 89.98%, and 89.97%, removing the focal mechanism.

The claim is limited to marginal versus declared group-conditional coverage
under the simulated data-generating processes. It does not establish pointwise
conditional coverage, production representativeness, or reliable operation
with missing, delayed, or erroneous slice labels.

## Skeptical editorial review

Machine-readable review:
`operator/automations/reports/latest-ai-article-production-2026-07-31-conformal-qwen-ssrf-editorial-review.json`.

- Conformal article: 4.86/5 average. Revisions made the estimand and decision
  unit explicit, added the label-error boundary, and documented the 200-case
  reproduction barrier.
- Qwen article: 4.57/5 average. Revisions added invoice reconciliation and a
  built-in-tool ablation so low list price cannot substitute for task evidence.
- Agent Studio article: 4.86/5 average. Revisions explicitly rejected any
  inferred bypass claim, bounded method/header/body forwarding, and added a
  retrospective incident check.

Every rubric dimension is at least 4. Each review records the strongest
counterargument, weakest claim, reproduction barrier, and at least two
substantive revisions.

## Visuals

- `conformal-slice-coverage.svg` shows the measured critical-slice coverage
  collapse and recovery across the focal policies.
- `qwen-3-7-flash-decision-surface.svg` turns vendor contracts into a bounded
  workload-cell pilot decision.
- `agent-studio-ssrf-test-matrix.svg` maps parser, resolver, redirect, and
  egress boundaries to concrete negative tests.

The SVG upgrader processed all three assets before promotion, and XML parsing
passed. Final repository-wide and browser visual checks are recorded below.

## Validation

Passed:

- exact three-candidate automation gate with structured editorial review;
- candidate SVG visual-system check for all three assets;
- committed-source public content gate: 67 articles;
- production build at `https://learn.toolsite.com`: 67 tutorials;
- generated-site checks;
- repository-wide SVG visual-system check: 67 assets;
- XML parsing for all three new SVGs;
- generated privacy scan for internal evidence metadata, private paths, and
  operator diagnostics;
- generated sitemap, homepage, HTML, and JSON presence checks;
- `git diff --check`;
- in-app browser review at 1440×900 and 390×844.

On mobile, each 1200×675 visual rendered at 336×189 without document overflow.
Wide tables were contained by local horizontal scrollers. The homepage linked
all three new articles. Browser logs contained no warnings or errors, and the
local preview was stopped after review.

No Torch, CPU-Torch, CUDA, MPS, local-model inference, AWS, Terraform, Tofu,
deployment, or cloud-resource command ran.

## Publication

Publication commit and push result will be recorded after all final gates pass.
