# Operator Workspace

This folder is for work done by us around the app. The app runtime and the
CodeBuild pipeline do not import files from here.

- `scripts/`: manual operator helpers, including generated-content publishing.
- `diy-project-blogs/`: internal article evidence workspaces used to create
  findings, charts, screenshots, and measured support for polished public
  articles. The public website must not expose the DIY/operator distinction.

Operator outputs are allowed to include local endpoint status, fallback notes,
and failed probes. Public articles are not. If a project documents our local
environment or a failed local dependency, keep it internal with `publish: false`
and create a customer-safe tutorial from the broader lesson.

Before any generated article batch is published, run the mandatory public
content gate:

```sh
node operator/scripts/check-public-content.mjs \
  --articles-dir /tmp/generated-ai-content/articles \
  --assets-dir /tmp/generated-ai-content/assets \
  --source-label generated-ai-content
```

If it fails, do not publish the batch. Report the failing articles and fix or
exclude them.

For LM Studio projects on local hardware, manage model memory explicitly:

- unload all models before the run.
- load only the embedding model during embedding phases.
- unload embeddings before loading the chat model.
- load only the chat model during generation or evaluation phases.
- unload all models at cleanup unless the user explicitly asks to keep one
  loaded.

If loading, unloading, embeddings, or chat inference fails, stop and ask for
intervention. Do not fabricate results.

Local model catalog endpoint, when running:

```sh
curl -s http://localhost:1234/api/v1/models
```

If the endpoint is unavailable, record the failure in the project output and
continue with projects that do not require live model inference.
