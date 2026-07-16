# Latest AI Article Production — 2026-07-16

## Outcome

Produced and promoted one atomic three-article candidate batch:

1. `deep-research`: **Measure Prompt-Cache Token Savings, Not Request Hit Rate** (`measure-prompt-cache-token-savings`)
2. `timely-analysis`: **Pilot Muse Spark 1.1 as an Agent Model, Not a Safety Boundary** (`muse-spark-1-1-agent-api-pilot`)
3. `timely-analysis`: **Migrate to Stateless MCP Before the 2026-07-28 Specification** (`mcp-2026-07-28-stateless-migration`)

Topic selection compared the candidates with the committed library, recent
automation reports, and the pre-pruning 52-article snapshot at revision
`fd213d3`. It rejected renamed release gates, companion articles, repeated
benchmark mechanisms, and reused evidence. The final batch covers cache
economics, agent-model adoption, and protocol migration.

## Deep evidence project

Evidence project:
`operator/diy-project-blogs/projects/prompt-cache-metric-audit`

- Built a revision-hashed workload from exact `o200k_base` token counts for 52
  committed article bodies: 163,605 tokens total, 2,485 minimum, 3,010 median,
  and 5,170 maximum.
- Ran 40 independently seeded traces per cell and 12,000 requests per trace
  over 189 cells, yielding 7,560 trace-level result rows.
- Controlled size-popularity alignment, cache capacity at 10%, 20%, and 40%,
  sliding TTL at 5, 30, and 60 minutes, and request cadence at 3, 30, and 180
  seconds.
- Included fixed-size and uniform-popularity negative controls plus an uncached
  cost baseline.
- At 20% capacity and 30-second cadence, large-prefix popularity produced a
  47.6% request hit rate, 54.7% token hit rate, and 37.9% modeled savings.
- Under 180-second cadence and a five-minute TTL, the same workload produced
  -7.4% modeled savings; a 30-minute TTL produced +31.7%.
- The article derives the billing-model break-even token-hit fraction of about
  21.7% and explicitly limits the result to the controlled trace model.
- Version-1 evidence manifest records hypothesis, baselines, controls, repeats,
  reproduction commands, claim boundaries, and seven existing artifacts.
- No Torch, model inference, CUDA, CPU-Torch, cloud, AWS, Terraform, or Tofu
  command was run.
- Workload SHA-256:
  `b4cd50b57045534a4de81a158084d01432583487319fe88e6b6efe5f1152106c`
- Raw-results SHA-256:
  `30fc25255176b484b3fd7930c1267038fa92a6ee71b7ffd12f3993a60f28fbb1`
- Aggregate-results SHA-256:
  `a6cca50fe09baeb149c1836d733431e9197b494db91ec77f3051ce676e7026d5`

## Timely evidence boundaries

The Muse Spark analysis uses Meta's July 9 launch, 112-page evaluation report,
and Advanced AI Scaling Framework, together with the primary publications for
Terminal-Bench, SWE-Bench Pro, OSWorld, Humanity's Last Exam, OpenCode, and
AgentDojo. It treats the reported benchmark rows as heterogeneous signals, not
a normalized leaderboard. It discloses that no local preview-API run was
performed and blocks broad adoption until pricing, limits, regional behavior,
failure modes, and accepted-task economics are measured.

The MCP analysis uses the locked May 21 release candidate, current draft core
and authorization specifications, merged Tasks proposal, MCP Apps design,
conformance repository, JSON Schema 2020-12, RFC 9207, W3C Trace Context, and
OpenTelemetry. It distinguishes the locked candidate from final SDK readiness,
requires revision-pinned dual-stack conformance, and limits initial canaries to
read-only or compensatable tools.

## Editorial review and revisions

The separate skeptical pass is recorded in
`operator/automations/reports/latest-ai-article-production-2026-07-16-editorial-review.json`.
All verdicts are `publish-ready`; rubric averages are 4.71 for prompt caching,
4.57 for Muse Spark, and 4.71 for MCP.

Material revisions included:

- correcting stale workload-size statistics against `results.json`, adding the
  corpus-proxy boundary, and deriving the cache-cost break-even threshold;
- adding a no-local-API disclosure, unresolved operational variables,
  pre-registered pilot thresholds, and failure-injection requirements for Muse
  Spark;
- adding final-artifact conformance, reviewed-revision pinning, stronger
  model-visible handle rules, quantitative canary budgets, and a
  compensatable-tool adoption boundary for MCP.

The review records the strongest counterargument, weakest public claim,
reproduction barrier, and at least two substantive revisions for every article.

## Visuals and validation

Built one evidence-bearing SVG per article and ran the SVG visual-system
upgrader. Full-aspect source inspection, XML parsing, generated HTML checks, and
rendered thumbnail review were performed. The first render exposed a duplicated
root SVG attribute introduced by the upgrader; all three assets were repaired,
re-rendered, and revalidated before promotion.

Final public asset SHA-256 values:

- prompt-cache audit:
  `c6cef8f7c94c88b126db750bad332833618c39a2d1c62b66b7dcce1cf3d8ed0f`
- Muse Spark evaluation surface:
  `b06433dd369be116b76f8d0dd1b06efe1298e7ee9103bb8b171b504d1e7d32c7`
- MCP migration surface:
  `caaf27741ec8166caff7221df1daa41402db18530593d46442c8b0a940f9c2f1`

Passed:

- candidate automation profile with editorial review: exactly three articles,
  one deep-research and two timely-analysis, with distinct topics;
- clean-snapshot candidate gate against the committed library;
- committed public-content gate: 28 articles;
- production build at `SITE_URL=https://learn.toolsite.com`: 28 tutorials;
- generated-site checks;
- SVG visual-system check: 28 assets;
- XML parsing for all three new SVGs;
- SEO HTML, structured-data, image, heading, and content-manifest spot checks;
- `git diff --check`.

The in-app browser control runtime was not exposed in this automation session,
so visual review used local Quick Look rendering plus generated HTML and XML
inspection. No remote assets or internal evidence metadata appear in the
customer-facing output.

## Repository hygiene

The quality-pruning commit `f9774cc` landed on `main` while this run was in
progress. The batch was rebased conceptually onto that committed 25-article
library, while the deep workload remains reproducibly frozen at the documented
pre-pruning revision. No unrelated source changes are included.

Run report written at 2026-07-16T14:20:48Z.

## Version control

- Batch commit: pending
- Push: pending
