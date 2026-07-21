# Latest AI Article Production — 2026-07-21

## Outcome

Produced and promoted one atomic three-article batch: exactly one deep-research
article and two timely-analysis articles on distinct topics. The candidate
automation gate passed before promotion. After promotion, the 52-article
library passed the public-content, production-build, generated-site, SVG,
privacy, HTML/JSON, XML, and rendered desktop/mobile checks.

## Reserved slots and originality decision

| Slot | Reader question | Evidence path | Originality decision |
|---|---|---|---|
| Deep research | Can a globally accurate two-model cascade conceal severe harm on rare critical workloads? | New `cascade-case-mix-audit` paired Monte Carlo study with 600 repeats, 12,000 requests per repeat, four policies, two controls, confidence intervals, and saved repeat-level outputs | Distinct from prior routing, retry, canary, queueing, and calibration articles: the mechanism is workload-mixture masking under routing selection, with stratum-specific release criteria. |
| Timely analysis | Does ArchEval measure an autonomous hardware architect, a simulator-loop engineer, or a tool user? | July 3 ArchEval paper plus primary simulator, benchmark, tutorial, and adjacent-system documentation | Distinct from general agent benchmarking and model-routing work: the decision is to preserve feedback-level boundaries in procurement and deployment tests. |
| Timely analysis | When is a RODA MCP search result fit to become governed training data? | July 7 AWS release and repository plus RODA, MCP, Croissant, STAC, provenance, datasheet, and dataset-documentation standards | Distinct from retrieval and MCP governance articles: the decision is an evidence ladder from discovery through provider verification and reproducible snapshotting. |

The review covered all 49 previously committed titles and recent run reports.
Rejected candidates included renamed or companion treatments of canary design,
correlated retries, queueing, retrieval fusion, GitHub tooling, Cosmos models,
model routing, and generic agent gates. The two required completed-research
exemplars were inspected for controlled baselines, repeat-level artifacts,
claim narrowing, and artifact-to-claim traceability.

## Source signals reviewed

- ArchEval was submitted on July 3, 2026 with 20 design challenges spanning
  eight simulators and three assistance levels. Its reported L3 result for
  GPT-5.5 with Codex was a 1.21x best geometric mean and a 65% win rate, while
  only 15% of self-evaluated modeling attempts passed. The article treats L1,
  L2, and L3 as different products rather than averaging them.
- AWS announced RODA MCP on July 7, 2026 for a registry exceeding 1,100 datasets
  from more than 400 organizations. The repository exposes ten tools, a first
  100 KB sample boundary, and three access tiers. Those discovery capabilities
  are not treated as license, consent, provenance, or reproducibility proof.
- The deep article's public quantitative claims come from its saved local run.
  No model inference or provider benchmark was substituted for controlled
  evidence.

## Deep evidence project

Project: `operator/diy-project-blogs/projects/cascade-case-mix-audit`

- Population: 12,000 paired requests per repeat with rare critical workloads.
- Policies: strong-only, global threshold, stratum-specific threshold, and an
  oracle upper bound.
- Repeats: 600 per scenario-policy cell; the repeat-level CSV contains 7,200
  observations plus its header.
- Shifted-confidence result: the global threshold reached 96.46% aggregate
  accuracy at $0.0046 per request but only 75.64% critical accuracy and falsely
  approved in every repeat.
- Stratum-specific result: 97.76% aggregate accuracy, 91.41% critical accuracy,
  $0.0049 per request, and a 3.17% false-approval rate.
- Strong-only reference: 95.42% aggregate accuracy, 90.04% critical accuracy,
  and $0.0200 per request.
- Controls: calibrated scores reduced but did not eliminate false approval
  (72.67% for the global rule); equal model skill reduced it to 4.67%. The claim
  therefore identifies heterogeneous skill plus routing selection as the joint
  mechanism and treats miscalibration as an amplifier, not the sole cause.
- The version-1 manifest traces hypothesis, claim boundary, baselines, controls,
  repeat count, reproduction command, configuration, runner, repeat CSV,
  aggregates, statistical output, focal output, and evidence figure.

No Torch, CPU-Torch, CUDA, MPS experiment, provider inference, AWS, Terraform,
Tofu, deployment, or cloud-resource command ran.

## Skeptical editorial pass

The machine-readable review is
`operator/automations/reports/latest-ai-article-production-2026-07-21-editorial-review.json`.

- Cascade audit averaged 4.71/5. Revisions narrowed the causal claim, centered
  both controls, added a production threshold-selection implementation, and
  made subgroup sample-size and drift boundaries explicit.
- ArchEval averaged 4.43/5. Revisions separated assistance levels, placed
  sourced values next to their comparison table, and added simulator leakage,
  workload-transfer, rollback, and adoption boundaries.
- RODA MCP averaged 4.43/5. Revisions changed a search-centric comparison into
  an evidence ladder, added quantitative pilot gates, and separated registry
  metadata from provider authority, consent, and governed snapshots.

Every rubric dimension scored at least 4. Each review records the strongest
counterargument, weakest claim, reproduction or adoption barrier, and at least
two substantive revisions.

## Visuals

- `cascade-case-mix-results.svg`: artifact-derived critical-accuracy comparison
  with the strong-only release reference.
- `archeval-feedback-boundary.svg`: sourced separation of L1, L2, and L3
  assistance products and their comparability boundaries.
- `roda-dataset-evidence-ladder.svg`: sourced discovery-to-governed-snapshot
  decision ladder.

The SVG upgrader ran on the candidate asset directory. All three promoted SVGs
and the evidence-project SVG parse as XML and pass the visual-system check.

## Validation

- Candidate automation profile with editorial review: passed for exactly three
  articles before promotion.
- Committed public-content gate: passed for 52 articles.
- Production build: built 52 tutorials.
- Generated-site checks: passed.
- SVG visual-system check: passed for 52 assets.
- XML parsing: passed for the three promoted assets and evidence figure.
- Generated privacy scan: no internal metadata, evidence paths, private paths,
  localhost model-service details, AWS profiles, or Terraform-state diagnostics.
- HTML/JSON spot checks: crawler-visible H1, TOC, local SVG reference, and JSON
  TOC passed for all three slugs.
- `git diff --check`: passed.
- In-app browser: 1440x900 and 390x844 review passed. All promoted images decoded
  at 960x540; mobile article images rendered at 336 pixels wide; document width
  remained 390 pixels; wide tables used local horizontal scrolling; homepage
  spotlight rendered; browser warnings and errors were empty. The preview
  required narrow outside-sandbox permission to bind `127.0.0.1:4173` and was
  stopped after review.

## Publication record

Atomic batch commit `e3837db` contains the three articles, three public assets,
deep evidence project, and editorial review. The durable report is committed
separately so it can record that immutable batch identifier. No partial batch
was published.
