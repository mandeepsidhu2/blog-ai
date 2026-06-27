# Operator Scripts

This folder is for operator-only helpers. The app build, runtime, and pipeline do
not call anything here.

Use `publish-generated-content.mjs` when generated article Markdown and assets
live outside the repo but need to be rendered through the same static generator
and uploaded to S3.

The publish helper runs mandatory customer-content gates before staging files.
It rejects generated Markdown that is incomplete, missing article-specific
assets, missing production-readiness guidance, missing code/output examples, or
contains operator-only details such as the local model catalog health-check
article, `localhost:1234` model endpoint output, private filesystem paths, or
the local AWS profile name.

Validate without uploading:

```sh
node operator/scripts/check-public-content.mjs \
  --articles-dir /tmp/generated-ai-content/articles \
  --assets-dir /tmp/generated-ai-content/assets \
  --source-label generated-ai-content
```

`publish-generated-content.mjs` does not allow `--skip-check`; if a gate fails,
nothing should be uploaded and the failing article names must be reported.

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
