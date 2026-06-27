# Operator Scripts

This folder is for operator-only helpers. The app build, runtime, and pipeline do
not call anything here.

Use `publish-generated-content.mjs` when generated article Markdown and assets
live outside the repo but need to be rendered through the same static generator
and uploaded to S3.

Use `publish-current-site.mjs` when committed `content/articles` and
`content/assets` should be built and uploaded as the current site.

The publish helper runs mandatory customer-content gates before staging files.
It rejects generated Markdown that is incomplete, missing article-specific
assets, missing production-readiness guidance, missing required code/output
examples for measured implementation articles, missing current sources for
strategy-mode articles, or containing operator-only details such as the local model
catalog health-check article, `localhost:1234` model endpoint output, private
filesystem paths, or the local AWS profile name.

`evidenceMode` is an internal evidence contract only. It must not become a
public article label, topic, tag, heading, or taxonomy. Articles in different
evidence modes can and should share the same customer-facing domain metadata
when they cover the same subject, such as embeddings or agent evaluation.

Validate without uploading:

```sh
node operator/scripts/check-public-content.mjs \
  --articles-dir /tmp/generated-ai-content/articles \
  --assets-dir /tmp/generated-ai-content/assets \
  --source-label generated-ai-content
```

`publish-generated-content.mjs` does not allow `--skip-check`; if a gate fails,
nothing should be uploaded and the failing article names must be reported.
`publish-current-site.mjs` follows the same rule for committed content.

The gate is intentionally strict. It is acceptable for a generated article batch
to fail and remain unpublished. Do not lower the gate to save weak content.

Expected external source shape:

```text
/tmp/generated-ai-content/
  articles/
    example-tutorial.md
  assets/
    example-tutorial.svg
```

Example:

```sh
AWS_PROFILE=macbook-terraform node operator/scripts/publish-generated-content.mjs \
  --source-dir /tmp/generated-ai-content \
  --site-url https://learn.toolsite.com \
  --app-bucket blog-ai-static-349188916794 \
  --content-bucket blog-ai-content-349188916794 \
  --distribution-id E17JFCAQXSGYZW
```

Committed site example:

```sh
AWS_PROFILE=macbook-terraform node operator/scripts/publish-current-site.mjs \
  --site-url https://learn.toolsite.com \
  --app-bucket blog-ai-static-349188916794 \
  --content-bucket blog-ai-content-349188916794 \
  --distribution-id E17JFCAQXSGYZW \
  --delete
```
