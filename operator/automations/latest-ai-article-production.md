# Latest AI Article Production Automation

## Schedule

Run every 12 hours.

## Objective

Produce a high-quality candidate article batch from current AI market signals:

- two `evidenceMode: strategy` candidates based on deep research into recent AI
  trends, releases, ecosystem movement, benchmarks, protocols, tools, or
  engineering practices.
- two `evidenceMode: experiment` candidates backed by local code, runnable
  experiments, measured outputs, charts, or inspectable artifacts.

Quality is more important than count. Attempt four candidates, but do not force
publication-quality output when the research or experiment is not strong enough.
It is acceptable to ship fewer candidates or none if the gate fails.

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

1. Gather current public signals from primary or high-signal sources:
   official model/provider blogs, release notes, framework docs, standards
   bodies, GitHub repositories, arXiv papers, benchmark releases, issue threads,
   conference/workshop material, and public social/community signals.
2. Use social media and community sites only as discovery signals unless the
   source itself is authoritative. Do not treat viral claims as facts without
   primary-source confirmation.
3. Prefer sources published or materially updated in the last 30 days. If a
   source is older but relevant, explain why it matters now.
4. Record exact source URLs in the article. Strategy candidates need at least
   five current primary or high-signal sources.
5. If web access is blocked, source quality is weak, or the trend cannot be
   verified, stop that candidate and report the reason.

## Strategy Candidate Requirements

Each strategy candidate must:

- use `evidenceMode: strategy`.
- choose topic and tags by domain, not by evidence mode.
- be concrete enough for real software engineers, AI engineers, or research
  scientists to act on.
- include an article-specific visual asset.
- include a source/signal/research section.
- include operational signals such as evaluation criteria, release gates,
  benchmark implications, cost/latency trade-offs, adoption risks, or security
  controls.
- include production readiness, limitations, guardrails, and rollout guidance.
- avoid filler, unsupported hype, and vague claims.

## Experiment Candidate Requirements

Each experiment candidate must:

- use `evidenceMode: experiment`.
- create or update an internal project under
  `operator/diy-project-blogs/projects/<slug>/`.
- include a runnable script, data or fixtures where needed, output artifacts,
  and a short project README.
- produce measured evidence such as metrics, traces, latency, recall, tool-call
  behavior, graph state transitions, ablations, or error analysis.
- include at least three implementation code blocks and one output block in the
  article.
- include reproducibility notes, failure analysis, and production-readiness
  guidance.

Experiments can use any rigorous AI engineering subject, including local LLM
behavior, embedding models, RAG, LangGraph state flow, tool calling, agent
permissions, eval harnesses, structured outputs, or model-routing simulations.
They do not need to use a local model when a deterministic Python/JavaScript
experiment is the better evidence source.

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
  report.md
```

After candidates pass the mandatory public content gate, promote the passing
articles and article-specific assets into committed source:

- copy article Markdown files into `content/articles/`.
- copy article visual assets into `content/assets/`.
- keep internal experiment artifacts under `operator/diy-project-blogs/`.
- exclude failed, weak, incomplete, or diagnostic-only candidates instead of
  promoting them.

```sh
node operator/scripts/check-public-content.mjs \
  --articles-dir /tmp/blog-ai-article-run-<timestamp>/articles \
  --assets-dir /tmp/blog-ai-article-run-<timestamp>/assets \
  --source-label latest-ai-article-production
```

## Quality Gates

Before any candidate is published or committed:

1. Run `node operator/scripts/check-public-content.mjs` against the candidate
   batch.
2. Promote only the passing candidates into `content/articles` and
   `content/assets`.
3. Run the committed-source gates:

```sh
node operator/scripts/check-public-content.mjs
SITE_URL=https://learn.toolsite.com node app-scripts/build-site.mjs
node app-scripts/check-site.mjs
```

4. Scan generated output for blocked internal labels and local diagnostics.
5. Spot-check article HTML and JSON. Use browser review when layout or visual
   changes are involved.

If a gate fails, do not weaken the gate. Fix, exclude, or report the candidate.

## Deployment Boundary

This automation is authorized to make passing articles durable and publishable
through the normal GitHub pipeline. This prompt explicitly authorizes
`git add`, `git commit`, and `git push origin main` to the main branch for this
automation, but only after the mandatory public-content gate, source promotion,
site build, and generated-site check pass:

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
- checks run.
- commit hash and push result for the normal GitHub pipeline path, or S3
  publishing result and uploaded-object verification when the fallback path is
  explicitly used.
- any intervention needed.
