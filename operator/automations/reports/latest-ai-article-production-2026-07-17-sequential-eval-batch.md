# Latest AI Article Production Candidate — 2026-07-17

## Reserved slots

| Slot | Reader question | Evidence path | Why now |
|---|---|---|---|
| Deep research | How much does repeated unadjusted significance checking inflate false LLM-evaluation wins, and what sensitivity does a simple correction sacrifice? | `operator/diy-project-blogs/projects/sequential-eval-peeking-audit/` | Teams increasingly stream benchmark results into release dashboards, while optional stopping is distinct from the library's earlier fixed-horizon cluster-resampling question. |
| Timely model analysis | When does Inkling's 975B-total/41B-active multimodal design justify an adaptation pilot despite its resident-weight burden? | July 15 release, model card, benchmark table, serving integrations, and primary benchmark/method sources | Inkling is a two-day-old open-weight multimodal release with a deployment shape that active-parameter marketing can obscure. |
| Timely ecosystem analysis | Which EU AI Act engineering tasks remain on the August 2026 track after the adopted high-risk deferrals? | Council, Commission, EUR-Lex, Parliament procedure, C2PA, ISO, and scholarly sources | The August deadline is near, the Transparency Code assessment is new, and the adopted Omnibus is still awaiting Official Journal publication. |

## Originality decision

Compared all 28 committed articles, recent successful and blocked run reports,
the July 15 quality audit, automation memory, evidence manifests, and both
required research exemplars. Rejected prompt caching, model routing, open-model
weight-footprint recap, generic agent gates, MCP migration, fixed-horizon
repository bootstrap, and repackaged dropout/tokenization/channel evidence.

The selected mechanisms are distinct: sequential optional stopping, multimodal
MoE adaptation economics, and split regulatory implementation timelines. The
Inkling article does not reuse the Hy3 thesis: Hy3 centered on a 590 GB dense
weight footprint and provider deployment boundary, while Inkling tests whether
native multimodal adaptation value can repay a sparse 975B resident model and
requires a smaller-model adaptation control.

## Deep experiment

The non-Torch JavaScript study ran 20,000 independent deterministic repetitions
per cell over maximum samples 100/200/400/800, review cadences 10/25/50/100,
effects 0/0.1/0.2, and three stopping policies. The focal null rates were 5.27%
fixed-horizon, 22.95% naive peeking, and 1.57% Bonferroni. At effect 0.2,
detection rates were 44.66%, 61.57%, and 18.82%. The fixed-horizon point estimate
above 5% and severe Bonferroni conservatism are reported as negative results.

Artifacts include config, runner, aggregate JSON, 4.8 MB focal-trial CSV,
renderer, and result SVG. No Torch, model inference, AWS, Terraform, Tofu, or
cloud mutation ran.

## Editorial review

The separate skeptical pass is stored in
`latest-ai-article-production-2026-07-17-editorial-review.json`. It records the
strongest counterargument, weakest claim, reproduction barrier, three
substantive revisions, and seven honest rubric scores for each article. Mean
scores were 4.71 for the deep article and 4.57 for each timely article.

The most consequential revisions narrowed the fixed-horizon calibration claim
and separated exploratory from confirmatory evaluation; relabeled Inkling's
storage numbers as arithmetic floors and required a smaller-model adaptation
control; and treated the EU high-risk dates as adopted planning dates pending
Official Journal publication rather than already consolidated law.

## Promotion and validation

The candidate-only automation profile passed for exactly three articles with
one `deep-research` and two `timely-analysis` entries. The promoted library then
passed:

- `check-public-content.mjs`: 31 public articles
- `build-site.mjs`: 31 generated tutorials at `https://learn.toolsite.com`
- `check-site.mjs`: all generated HTML, JSON, manifest, sitemap, and article checks
- `upgrade-svg-library.mjs --check`: 31 assets
- `xmllint --noout`: all three new article visuals
- `git diff --check`: no whitespace errors

Rendered review at 1440×900 and 390×844 covered the home page and all three new
article pages. Titles, article cards, visuals, navigation, and tables rendered;
there was no page-level horizontal overflow, tables had bounded horizontal
scrollers, and no image was broken. A delayed mobile-home recheck confirmed the
hero entrance animation settles to visible content.

## Artifact integrity

| Artifact | SHA-256 |
|---|---|
| `artifacts/aggregate-results.json` | `49c6bcce8a13ad6496af8ee7269e63806fcbd7870ef64058981e0c46944da1f9` |
| `artifacts/focal-trials.csv` | `e38a3ba9866e689507cf34ebd4fb81f4c06076ed9540c4f65ddb667e088fb075` |
| `artifacts/false-positive-rate.svg` | `6357e45fb884bb641ffb16e84e16f4ab2a6c10165beda88df4e91913cb091bfa` |
| `sequential-eval-peeking-audit.svg` | `35ca3c5cad02873c7f088a95d6f0685c850c25f949cb66477ebbb89c8892d5b2` |
| `inkling-deployment-decision-surface.svg` | `a6918a6e9d5ab63ad6b1d6304ee4c080c050ac7dc9d4a4b4347491f6f160b9d2` |
| `eu-ai-act-split-deadline-map.svg` | `26d9da9053a0476ceceb0220d7a1486bc85808646cdbe8aaf3a852149f48273f` |

## Final status

The three-article batch is promoted and all content, build, site, SVG, XML,
diff, and rendered-review gates pass. Publication commit `4b4f736` was pushed
to `origin/main` (`c46ec62..4b4f736`). A follow-up report-only commit records
this durable outcome.
