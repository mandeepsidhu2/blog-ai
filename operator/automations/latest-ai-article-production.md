# Latest AI Article Production Automation

## Schedule

Run every 12 hours.

## Objective

Produce one atomic batch of exactly three publication-grade articles while
respecting the daily publication maximum of 50 articles:

1. one `qualityTier: deep-research` article grounded in completed empirical
   work or a new controlled experiment;
2. one `qualityTier: timely-analysis` article comparing a recent model,
   benchmark, release, or specification with quantitative evidence; and
3. one `qualityTier: timely-analysis` article explaining a separate current AI
   systems, product, protocol, or market development with concrete engineering
   consequences.

The three articles must cover distinct customer-facing topics. Do not produce a
strategy/experiment companion pair about the same narrow gate. The batch is
atomic: if any slot lacks sufficient evidence or fails a gate, publish no
partial batch and report exactly which slot was blocked. Do not lower the bar or
substitute generic filler to reach three.

Reader excitement must come from important results, surprising comparisons,
useful numbers, and clear implications. It must not come from hype language.

The governing question is not "is this long enough?" It is "would a senior
engineer or scientist learn something consequential, trust the evidence, and
make a better technical decision after spending time on it?" Length and section
counts are only anti-thinness floors. Never add prose, headings, code, sources,
or tables solely to satisfy a count.

## Quality Exemplars

Before choosing the deep-research slot, inspect these local projects as quality
exemplars:

- `/Users/mandeepsidhu/Desktop/code/completed-research/dropout-decay`: read
  `README.md`, `REPRODUCING.md`, `docs/formula_coefficient_methodology.md`, and
  `paper/paper_results_summary.json`.
- `/Users/mandeepsidhu/Desktop/code/policy-verified-agent-tool`: read
  `README.md`, `paper/paper_results_summary.json`,
  `paper/reproducibility_manifest.md`, and the statistical-testing summaries
  under `paper/tables/` and `reports/diagnostics/`.

Use their research discipline as the target: explicit hypotheses, matched
baselines, multiple seeds or repeated observations, ablations and negative
controls, uncertainty or confidence intervals, claim narrowing, scope limits,
and a reproducibility path from raw artifacts to each public claim. Do not copy
their prose and do not repeatedly publish the same result. Use other completed
research when it meets the same bar.

## Internal Versus Public Framing

`evidenceMode` is an internal production contract only. It is not a public
article class, topic, URL pattern, card label, heading, or tag.

Topic and tags describe the customer-facing domain. Strategy and experiment
candidates can belong to the same domain. For example:

- a current-market article about embedding model releases can use topic
  `Embeddings` and tags such as `embeddings`, `retrieval`, and
  `model-evaluation`.
- a measured benchmark article using one of those embedding models can use the
  same topic and overlapping tags.
- the only required distinction is the internal `evidenceMode` front matter.

Public copy must not say "strategy article", "experiment article",
"research-backed article", "experiment-backed article", "trend article",
"operator project", "DIY project", or similar internal labels.

## Research Phase

1. Reserve the three required slots before drafting. Record a one-sentence
   reader question, the evidence path, and the reason the topic matters now for
   each slot.
2. Search the committed library and recent automation reports before approving
   a slot. Reject a topic that merely renames an existing article, reuses its
   central mechanism, or republishes the same experiment with a new wrapper.
3. For the two timely-analysis slots, gather current public signals from
   primary or high-signal sources:
   official model/provider blogs, release notes, framework docs, standards
   bodies, GitHub repositories, arXiv papers, benchmark releases, issue threads,
   conference/workshop material, and public social/community signals.
4. Use social media and community sites only as discovery signals unless the
   source itself is authoritative. Do not treat viral claims as facts without
   primary-source confirmation.
5. Prefer timely sources published or materially updated in the last 14 days.
   A source up to 30 days old is acceptable when it provides a necessary
   benchmark, specification, or comparison baseline. Explain why older sources
   still matter.
6. Record exact source URLs, publication dates, model/version identifiers, and
   the provenance of every quantitative comparison. If web access is blocked,
   source quality is weak, or a claim cannot be verified, stop the entire batch
   and report the affected slot.

## Deep-Research Slot

The deep-research article must:

- use `qualityTier: deep-research` and `evidenceMode: experiment`.
- be based on saved artifacts from a completed research project or a new
  project under `operator/diy-project-blogs/projects/<slug>/`.
- state the hypothesis, datasets, model/configuration scale, treatment,
  baselines, seed or repeat count, metrics, and hardware/runtime boundary.
- distinguish exploratory screens from confirmatory evidence.
- include matched baselines, at least one ablation or negative control,
  uncertainty or statistical testing, error analysis, and an explicit claim
  ladder separating supported conclusions from speculation.
- use only as much prose as the argument requires, with anti-thinness floors of
  2,400 total words and 1,800 non-code words. It must still contain three
  substantive implementation excerpts, two measured-output blocks, a sourced
  result table, and at least six unique scholarly or primary links across three
  source domains.
- include at least 45 substantive implementation lines, eight measured signals,
  and eight output lines. Compact, meaningful excerpts are preferred over
  inflated code listings.
- include Methodology, Baselines or Controls, Results, Statistical Analysis or
  Uncertainty, Reproducibility, Limitations or Error Analysis, and Claim
  Boundary sections. Report at least one negative result, failed hypothesis, or
  negative control in plain language.
- include a real result figure generated from the cited artifacts. A generic
  architecture flowchart is not sufficient evidence.
- set internal `evidenceProject` and `evidenceManifest` front matter. The
  manifest must follow `operator/automations/evidence-manifest.schema.json` and
  the contract in `docs/CONTENT.md`, and trace the public claims to existing
  configs, code, raw/processed results, and figures.

Long Torch reruns are not required when completed artifacts are internally
consistent and reproducible. Prefer reading and validating saved summaries,
configs, traces, figures, and manifests. Never invent missing measurements.

## Timely-Analysis Slots

Each timely-analysis article must:

- use `qualityTier: timely-analysis` and `evidenceMode: strategy`.
- cover a different topic from the other two batch articles.
- use at least eight primary or high-signal sources and identify dates and exact
  model, product, protocol, or benchmark versions. Use at least four independent
  source domains; multiple provider pages do not count as independent
  corroboration.
- use only as much prose as the decision requires, with anti-thinness floors of
  1,800 total words and 1,400 non-code words. Include at least eight measured
  specifications, scores, prices, latency values, context limits, or adoption
  statistics and explicitly record at least three source/release dates.
- include a nearby-sourced Markdown comparison table with at least three columns
  and three data rows. Normalize units, label unknown values, and never compare
  benchmark numbers with incompatible settings as if they were equivalent.
- explain benchmark limitations, missing information, likely confounders, and
  what an engineer should test before adopting the release.
- include a concise finding/decision summary, explicit comparison/benchmark and
  engineering-decision sections, a source ledger with dates, an adoption
  boundary or when-not-to-use section, production implications, failure modes,
  and rollback or migration guidance.

One timely slot should normally be model/benchmark/specification focused. The
other should normally be systems/ecosystem/news focused. A press-release recap,
feature list, or unsourced leaderboard summary does not qualify.

## Skeptical Editorial Review

Drafting and reviewing are separate passes. After all three drafts and visuals
exist, stop writing and review each article as a skeptical senior engineer or
scientist encountering it for the first time:

1. State the strongest counterargument to the article's conclusion.
2. Identify the most weakly supported public claim and either strengthen,
   narrow, or remove it.
3. Identify the largest reproduction or adoption barrier and make it explicit.
4. Compare the article with the committed library for duplicated thesis,
   repeated long paragraphs, and templated structure.
5. Make at least two substantive revisions based on the review. Copy editing
   alone does not count.
6. Score `questionValue`, `technicalDepth`, `evidenceTraceability`,
   `methodologicalRigor`, `decisionUsefulness`, `clarityDensity`, and
   `visualEvidence` from 1 to 5. Every score must be at least 4 and the average
   must be at least 4.3. Do not inflate scores; a failing score blocks the whole
   atomic batch.

Write the machine-checkable result to `editorial-review.json` using
`operator/automations/editorial-review.schema.json`. The review is internal and
must never appear in public article copy.

## Visual Standard

Every article must have a distinct evidence-bearing visual:

- deep research: a real chart, ablation, uncertainty plot, or result matrix
  generated from the article's artifacts;
- timely analysis: a sourced comparison matrix, benchmark chart, release
  timeline, or decision surface built from the cited facts.

Do not publish generic pastel cards, repeated rounded-box pipelines, stock
icons, decorative neural-network imagery, or an `assistant -> checks -> decision`
diagram that merely restates the prose. SVGs must use the shared publication
visual system, avoid Arial/Helvetica, keep radii at 12px or below, and remain
readable at article and mobile widths.

Run the SVG visual-system pass against candidate assets before the candidate
content gate:

```sh
node operator/scripts/upgrade-svg-library.mjs \
  --assets-dir /tmp/blog-ai-article-run-<timestamp>/assets
```

## Local Model Rules

When an experiment uses LM Studio or another local model service:

- discover models through `curl -s http://localhost:1234/api/v1/models` only
  when needed.
- unload all models before the run.
- load only the model needed for the current phase.
- unload embedding models before loading chat models.
- unload all models during cleanup unless explicitly instructed otherwise.
- if model listing, loading, unloading, embeddings, or inference fails, stop
  that candidate and ask for intervention. Do not publish guessed results.

Torch experiments, if introduced, must use MPS only. Stop if MPS is unavailable.
Do not run CUDA or CPU torch experiments.

## Sandbox And Local Tooling Boundary

This automation is allowed to request and use outside-sandbox execution when
the default sandbox blocks work that is required for the scheduled run. Allowed
uses include:

- current public web research and source verification.
- canonical Node-based public-content gates, site builds, and generated-site
  checks.
- local runtime discovery, such as finding the Codex app Node binary when
  `node` is not on `PATH`.
- local evidence scripts and local model service probes that follow the model
  hygiene rules above.
- AWS CLI publishing steps allowed by the deployment boundary below, after all
  mandatory gates have passed.

Outside-sandbox execution is not a blanket bypass. Record why escalation was
needed in the run report, use the narrowest command that proves the step, and
do not use escalation to skip content gates, fabricate evidence, weaken model
hygiene, or run unrelated system commands.

## Candidate Output

Use a temporary batch directory outside committed article source while drafting
and validating candidates:

```text
/tmp/blog-ai-article-run-<timestamp>/
  articles/
  assets/
  editorial-review.json
  report.md
```

After candidates pass the mandatory public content gate, promote the passing
articles and article-specific assets into committed source:

- count articles already promoted for the current calendar day and promote only
  enough passing candidates to keep the day at or below 50 published articles.
- copy article Markdown files into `content/articles/`.
- copy article visual assets into `content/assets/`.
- keep internal experiment artifacts under `operator/diy-project-blogs/`.
- exclude failed, weak, incomplete, or diagnostic-only candidates instead of
  promoting them.

```sh
node operator/scripts/check-public-content.mjs \
  --articles-dir /tmp/blog-ai-article-run-<timestamp>/articles \
  --assets-dir /tmp/blog-ai-article-run-<timestamp>/assets \
  --source-label latest-ai-article-production \
  --quality-profile automation \
  --editorial-review /tmp/blog-ai-article-run-<timestamp>/editorial-review.json
```

## Quality Gates

Before any candidate is published or committed:

1. Run `node operator/scripts/check-public-content.mjs` against the candidate
   batch with `--quality-profile automation`. This mechanically requires exactly
   one deep-research article, exactly two timely-analysis articles, and three
   distinct topics. It also verifies evidence/source density, source diversity,
   substantive comparison tables, reproducibility manifests, originality
   against the existing library, and the structured editorial review.
2. Promote only the passing candidates into `content/articles` and
   `content/assets`.
3. Run the committed-source gates:

```sh
node operator/scripts/check-public-content.mjs
SITE_URL=https://learn.toolsite.com node app-scripts/build-site.mjs
node app-scripts/check-site.mjs
```

4. Scan generated output for blocked internal labels and local diagnostics.
5. Browser-review article images on article pages and the home spotlight before
   publishing. Do not publish if a visual is missing, clipped, unreadable,
   distorted, or dependent on a remote asset.
6. Spot-check article HTML and JSON. Use browser review when layout or visual
   changes are involved.

If a gate fails, do not weaken the gate. Fix, exclude, or report the candidate.

## Deployment Boundary

This automation is authorized to make passing articles durable and publishable
through the normal GitHub pipeline. This prompt explicitly authorizes
`git add`, `git commit`, and `git push origin main` to the main branch for this
automation, but only after the daily 50-article maximum is respected and the
mandatory public-content gate, source promotion, site build, and generated-site
check pass:

1. `git add` the promoted article Markdown, article assets, internal evidence
   projects, and any directly related documentation or report updates.
2. `git commit` the passing article batch with a concise message.
3. `git push origin main`.

The GitHub/CodeBuild pipeline is then responsible for rebuilding, uploading the
site outputs, and invalidating CloudFront. This is the preferred path because it
keeps published articles in Git history and makes the public website update
through the same route as normal source changes.

Use generated-content S3 publishing only when explicitly needed for an immediate
manual publish or when the GitHub pipeline is unavailable. In that fallback
case, after the mandatory public-content gate, site build, and generated-site
check pass, publish with:

```sh
node operator/scripts/publish-generated-content.mjs \
  --source-dir /tmp/blog-ai-article-run-<timestamp> \
  --site-url https://learn.toolsite.com \
  --content-bucket blog-ai-content-349188916794 \
  --app-bucket blog-ai-static-349188916794 \
  --distribution-id E17JFCAQXSGYZW
```

The helper stages generated articles/assets, rebuilds the site, runs
`app-scripts/check-site.mjs`, syncs `dist/content` to the content bucket, syncs
`dist/app` to the app bucket, invalidates the CloudFront distribution so the
website observes the uploaded S3 objects, and restores staged source files. Do
not use `--skip-check`.

AWS CLI commands are allowed only for this fallback publishing workflow and
read-only verification of uploaded objects. This includes the S3 syncs and the
CloudFront invalidation performed by the publishing helper. Do not run
Terraform, OpenTofu, or unrelated AWS resource mutation. Do not commit, push, or
publish if any gate fails.

The normal output is a concise run report with:

- source signals reviewed.
- candidate titles and slugs.
- which candidates passed or failed.
- experiment artifacts created.
- editorial scores, counterarguments, identified claim risks, and substantive
  revisions made.
- checks run.
- commit hash and push result for the normal GitHub pipeline path, or S3
  publishing result and uploaded-object verification when the fallback path is
  explicitly used.
- any intervention needed.
