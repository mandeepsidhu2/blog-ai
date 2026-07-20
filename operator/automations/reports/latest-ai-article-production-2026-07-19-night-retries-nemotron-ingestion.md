# Latest AI Article Production — 2026-07-19 night run

Status: ready for publication commit

Run window: 2026-07-19 15:30–23:30 America/New_York (completed 2026-07-20T03:30Z)

## Atomic candidate batch

The batch contains exactly three articles and is promoted only as one unit:

1. `budget-llm-retries-correlated-failures` — `qualityTier=deep-research`, AI Reliability Engineering. A controlled, paired-seed simulation measures the completion, latency, load amplification, and overload tradeoffs of no retry, immediate retry, deterministic backoff, full jitter, and budgeted jitter under matched independent and temporally correlated faults.
2. `nemotron-3-embed-deployment-canary` — `qualityTier=timely-analysis`, Embedding Systems. A deployment decision surface separates model-card retrieval quality, vector-memory cost, checkpoint context limits, NIM runtime limits, migration compatibility, and rollback requirements for the July 2026 Nemotron 3 Embed release.
3. `isolate-ai-dataset-ingestion-workers` — `qualityTier=timely-analysis`, ML Supply Chain Security. The July 16 Hugging Face dataset-viewer incident is translated into an execution-tier matrix and a concrete isolation, credential, provenance, and recovery boundary for dataset ingestion.

The committed library and recent reports were compared before selection. Rejected candidates included renamed or companion treatments of token budgeting, tool-policy verification, multimodal serving, RRF fusion, inference batching, model-release recap formats, and generic production gates. The three selected mechanisms are distinct from each other and from the prior library.

## Source and evidence signals

The timely articles use dated primary sources and distinguish sourced facts from local engineering inferences. The embedding analysis compares NVIDIA model cards, NVIDIA NIM documentation and support matrices, MTEB methodology, and established vector-search implementation constraints. The ingestion analysis compares the Hugging Face incident disclosure with Hugging Face dataset-script and Hub security guidance, GitHub Actions security guidance, SLSA provenance requirements, Kubernetes security controls, and NIST container guidance. Both articles state comparability limits adjacent to their comparison tables and turn the evidence into bounded adoption and rollback decisions.

The required quality exemplars at `/Users/mandeepsidhu/Desktop/code/completed-research/dropout-decay` and `/Users/mandeepsidhu/Desktop/code/policy-verified-agent-tool` were inspected before the experiment and article design. Their influence is visible in the paired controls, repeat-level artifacts, manifest claim boundaries, statistical intervals, production gates, and explicit negative results.

## Deep-research evidence project

Evidence project: `operator/diy-project-blogs/projects/correlated-retry-amplification`

The version-1 evidence manifest traces hypotheses, baselines, matched controls, five policies, two loads, two fault processes, 200 paired main repeats, 80 no-fault control repeats, reproduction commands, artifact hashes, claim boundaries, and negative results. The dependency-free simulator produced 4,800 repeat-policy rows across 30 experimental cells; no Torch was used.

Focal 85-original-request/s correlated-fault results:

- No retry: 89.74% completion, 1.000 attempted-load amplification, 117.6 peak attempted calls/s.
- Full jitter: 96.91% completion, 1.208 amplification, 263.2 peak attempted calls/s.
- Budgeted jitter: 94.47% completion, 1.086 amplification, 134.0 peak attempted calls/s.
- Full jitter versus no retry, paired bootstrap: +7.17 percentage points completion (95% CI +7.12 to +7.21), +145.665 peak attempted calls/s (95% CI +142.905 to +148.330).
- Budgeted jitter versus full jitter: −2.44 percentage points completion (95% CI −2.49 to −2.39), −129.210 peak attempted calls/s (95% CI −131.900 to −126.410), and −2,336.375 overflow attempts (95% CI −2,455.965 to −2,217.425).
- Full jitter reduced p95 latency by 0.2137 s relative to deterministic backoff but increased peak attempts by 14.3/s; this negative capacity result is retained.
- With matched mean unavailability, independent faults made full jitter appear materially safer (99.35% completion and 174.0 peak attempted calls/s), showing why marginal failure rate alone is an inadequate control.

The initial independent control used a 10% marginal failure probability, which did not match the Markov process's 3.57% stationary failure rate. The control was corrected to 0.0357142857 and the entire experiment, analysis, manifest hashes, and visual were regenerated before drafting final claims.

Existing evidence artifacts include `repeat-results.csv`, `aggregate-results.json`, `statistical-analysis.json`, `focal-summary.txt`, and `retry-policy-tradeoff.svg`, plus executable experiment and analysis code.

## Skeptical editorial pass

Review artifact: `operator/automations/reports/latest-ai-article-production-2026-07-19-night-editorial-review.json`

Honest rubric averages were 4.71/5 for the retry article, 4.57/5 for the embedding article, and 4.57/5 for the ingestion article; every individual score is at least 4. The review records each article's strongest counterargument, weakest claim, reproduction barrier, and four substantive revisions.

Key revisions:

- Retry: corrected the matched-mean control, added the correlated-versus-independent comparison, narrowed the shared retry rate from a recommendation to a tested treatment requiring a rate/burst sweep, and kept the jitter capacity downside.
- Embeddings: separated the 32K checkpoint claim from the 4K NIM/runtime boundary, added a four-cell old/new query/index migration audit, quantified vector-storage arithmetic, and added runtime conformance plus rollback gates.
- Ingestion: separated incident facts from local control mappings, added a hostile-evidence table, narrowed the separate-cluster prevention claim, and introduced a four-tier execution matrix.

## Assets and public-boundary checks

Each article has a specific evidence-bearing SVG. The visual upgrader was run on all three assets, duplicate root attributes discovered by XML validation were corrected, and both `xmllint` and the upgrader's `--check` mode pass. Public article bodies and generated HTML/JSON contain no evidence-mode metadata, quality-tier metadata, evidence paths, review paths, operator diagnostics, localhost health, or private filesystem paths.

## Validation

Candidate batch:

- `check-public-content.mjs --quality-profile automation --editorial-review ...`: passed for exactly 3 articles.

Committed source:

- `node operator/scripts/check-public-content.mjs`: passed for 43 articles.
- `SITE_URL=https://learn.toolsite.com node app-scripts/build-site.mjs`: built 43 tutorials.
- `node app-scripts/check-site.mjs`: passed.
- SVG visual-system check: passed for 43 assets.
- `xmllint --noout` for all three new SVGs: passed.
- `git diff --check`: passed.
- Generated HTML/JSON spot checks: canonical URL, article HTML, table of contents, local visual, article blocks, and article TOC present for all three; internal fields absent.

Rendered browser QA used the repository preview at 1440×900 and 390×844. All three article titles and visuals render, images decode, desktop and mobile pages have no horizontal document overflow, mobile tables remain inside `overflow-x: auto` containers, the table of contents adapts at the mobile breakpoint, the homepage reports 43 guides, and no browser warnings or errors were recorded. The local preview server was stopped after inspection.

No AWS, Terraform, Tofu, deployment, or cloud-resource command was run. No Torch experiment was needed.

## Publication record

- Publication commit: pending
- Push: pending
