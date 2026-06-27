# Operator Scripts

This folder is for operator-only helpers. The app build, runtime, and pipeline do
not call anything here.

Use `publish-generated-content.mjs` when generated article Markdown and assets
live outside the repo but need to be rendered through the same static generator
and uploaded to S3.

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
AWS_PROFILE=macbook-terraform node operator-scripts/publish-generated-content.mjs \
  --source-dir /tmp/generated-ai-content \
  --site-url https://learn.toolsite.com \
  --app-bucket blog-ai-static-349188916794 \
  --content-bucket blog-ai-content-349188916794 \
  --distribution-id E17JFCAQXSGYZW
```
