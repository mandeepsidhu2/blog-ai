# Content

Tutorials are static Markdown files in `content/articles`.

## Article Contract

Each article must begin with front matter:

```md
---
title: Build a Tiny RAG Pipeline in Python
description: Implement retrieval, prompt assembly, and generation boundaries.
topic: RAG
level: Intermediate
date: 2026-06-27
readingTime: 22
tags: rag, retrieval, embeddings
image: /content/v1/assets/tiny-rag-pipeline.svg
imageAlt: RAG pipeline architecture diagram with retrieval and generation stages
evidenceMode: experiment
---
```

Required fields:

- `title`
- `description`
- `topic`
- `level`
- `date`
- `readingTime`
- `tags`
- `image`
- `imageAlt`
- `evidenceMode`

Automation-produced articles also require the internal `qualityTier` field:

- `deep-research`: empirical work with methods, baselines, controls,
  uncertainty, measured outputs, and reproducibility.
- `timely-analysis`: current, source-dense analysis with quantitative
  comparison and engineering decision guidance.

Like `evidenceMode`, `qualityTier` must not become a public badge, topic, tag,
headline formula, or URL category.

Automation-produced `deep-research` articles additionally require internal
front matter:

- `evidenceProject`: repo-relative project directory under
  `operator/diy-project-blogs/projects/`.
- `evidenceManifest`: JSON manifest inside that project.

The evidence manifest uses `version: 1` and must include a specific
`hypothesis`, an explicit `claimBoundary`, `design.baselines`,
`design.controls`, `design.repeats`, `reproduction.commands`, and at least three
existing project-relative artifact paths. The public build does not emit these
internal fields. They exist so a result can be traced from the article back to
code, configs, measurements, and figures. The machine-readable contract lives at
`operator/automations/evidence-manifest.schema.json`.

```json
{
  "version": 1,
  "hypothesis": "A specific, falsifiable statement with the expected direction of effect.",
  "claimBoundary": "What the evidence supports and what it cannot establish.",
  "design": {
    "baselines": ["matched baseline"],
    "controls": ["negative control or ablation"],
    "repeats": 5
  },
  "reproduction": {
    "commands": ["node run-experiment.mjs"]
  },
  "artifacts": ["config.json", "results.json", "figure.svg"]
}
```

Asset fields:

- `image`: article-specific Open Graph and in-page hero image. Use an absolute
  site path such as `/content/v1/assets/example.svg`. Customer-facing content
  must not rely on the shared site hero image.
- `imageAlt`: descriptive alt text for the article image. Keep it literal and
  specific to the diagram or screenshot.

Article images must be reviewable before publishing. Use SVG, PNG, or JPEG
assets that are non-empty, local to `content/assets`, readable by the build
checks, at least 640x320, and landscape enough to fit the article hero and home
spotlight without cropping. SVGs must include a `<title>`, `<desc>`, and
viewBox or width/height metadata, and must not depend on remote linked assets.
SVGs must also declare `data-visual-quality="publication"`, use the shared
fieldbook visual system and `data-text-fit="bounded"` marker, avoid generic
Arial/Helvetica slide styling, keep card radii at 12px or below, and contain
enough graphical structure to communicate a real result or system. Run
`operator/scripts/upgrade-svg-library.mjs` before the public content gate.

## Internal Source Modes

`evidenceMode` describes how we produced and validated the article. It is an
operator-only evidence contract, not a customer-facing category, topic, tag, SEO
cluster, navigation label, or URL strategy.

There are two internal evidence modes:

- `strategy`: explain AI practices, adoption patterns, model
  trends, code organization, harness engineering, or operating models. These may
  cite external sources and should still be concrete, current, and actionable.
- `experiment`: include code snippets, outputs, and results from an internal
  project under `operator/diy-project-blogs`.

This distinction is for us only. The website must present both as ordinary
articles. Do not write public copy that says "DIY project", "operator project",
"research-backed article", "experiment-backed article", "strategy article",
"experiment article", or "trend article". If an article uses supporting
evidence, integrate it naturally as measurements, results, figures, or
reproducibility notes.

Evidence mode is orthogonal to domain. For example, an embedding-model market
analysis and an embedding-model benchmark can both use topic `Embeddings` and
similar tags such as `embeddings`, `retrieval`, and `model-evaluation`; only the
internal `evidenceMode` differs.

Do not use `strategy`, `experiment`, `trend`, `research-backed`, or
`experiment-backed` as the article topic or as exact tags. Those are internal
production labels, not customer-facing domain labels. Domain tags that contain a
more specific meaning, such as `ai-strategy`, are acceptable when they describe
reader intent.

## Structure

- Use `h2` for main sections.
- Use `h3` for local subsections.
- The article table of contents is generated from `h2` and `h3`.
- Include code fences for implementation-heavy tutorials.
- Use `output` fences for terminal or program output.
- Use Markdown tables for sourced model, benchmark, cost, latency, or
  specification comparisons. Tables render as horizontally scrollable semantic
  HTML on compact screens.
- Use article images for architecture diagrams, flow charts, or UI outputs that
  help readers understand the implementation. Generated content assets should
  live under `content/assets` only as temporary build input unless the article is
  intentionally committed to the repo.
- Use `operator/diy-project-blogs` internally for experiments that produce
  article findings, charts, screenshots, or local model catalog notes before
  content is staged and published to S3.

## Public Content Boundary

Public articles are for customers. They should teach an AI technique, show code
and outputs that readers can reuse, and reinforce that staying ahead in AI
requires hands-on practice now.

Do not publish anything that is failing, incomplete, placeholder-like, or only
useful as an internal note. A public article must have:

- article-specific image and alt text.
- image assets that pass the public content gate and render without broken
  references or cropped diagram content in local preview.
- for `evidenceMode: experiment`, at least three runnable code blocks, one
  output block, and a reproducibility section.
- for `evidenceMode: strategy`, at least five current primary or high-signal
  sources and a clear source/signal/research section.
- enough explanatory prose to stand alone as a deep technical reference.
- empirical or operational signal such as a metric, benchmark, threshold, trace,
  test, or release gate.
- production-readiness guidance, including failure modes, limitations,
  guardrails, rollback criteria, and reproducibility notes when the article
  depends on a measured run.

Avoid lightweight sections titled `Production extension`. That language is a
smell that the article is a short demo. Use explicit sections such as
`Production Readiness`, `Failure Analysis`, and `Reproducibility` instead.

Do not publish:

- localhost service health or local model catalog failures.
- private filesystem paths.
- AWS profiles, Terraform state details, bucket internals, or deployment logs.
- operator diagnostics whose main value is explaining our environment.
- internal labels such as DIY project, operator project, strategy article,
  experiment article, trend article, research-backed article, or
  experiment-backed article.
- hype filler such as "game-changing", "unlock the power", or generic claims
  that are not tied to a concrete mechanism, metric, source, or trade-off.

Keep those details in `operator/` project outputs. If a generated project is
only useful as an internal diagnostic, set `publish: false` and publish a
customer-safe tutorial instead.

Example:

````md
```python
print("hello")
```

```output
hello
```
````

## Quality Bar

Every tutorial should be:

- practical enough to build from.
- explicit about assumptions.
- honest about limitations, rollout boundaries, and production-readiness gaps.
- direct and evidence-dense; no filler paragraphs or unsupported hype.
- readable without requiring hidden context.
- useful as an SEO page and as a structured content payload.
- production-grade enough to represent the product to customers.
- worthy of a senior engineer's or scientist's time: it should answer an
  important question, expose enough evidence to audit the answer, and improve a
  real technical decision.

For AI engineering content, prefer controlled examples, evaluation criteria,
and reproducibility notes over trend-only commentary.

Automation batches contain exactly three distinct-topic articles: one
`deep-research` article and two `timely-analysis` articles. The deep article
must expose its hypothesis, baselines, repeated evidence, uncertainty, negative
results, limitations, and artifact path. Timely articles must compare current
facts from primary sources rather than summarize announcements.

Word, heading, source, code, and table counts are anti-thinness floors, not
quality targets. Do not pad an article to reach them. Automation candidates
must also pass a structured skeptical review covering question value, technical
depth, evidence traceability, methodological rigor, decision usefulness,
clarity/density, and visual evidence.

## Review Checklist

- Does the title match a concrete search intent?
- Does the description explain the tutorial outcome?
- Are code snippets complete enough to understand?
- Are outputs visually separated from code?
- Does the article have a useful image and alt text when the topic benefits from
  a diagram?
- Does the article image render completely in the article page and home
  spotlight without clipped labels, hidden axes, or broken image placeholders?
- Are limitations, guardrails, and rollout boundaries clear?
- Is the article free of operator-only diagnostics and local environment
  failures?
- Does `operator/scripts/check-public-content.mjs` pass before publishing?
- Does the generated article page include a table of contents?
- Does the article JSON include blocks and metadata?
