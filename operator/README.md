# Operator Workspace

This folder is for work done by us around the app. The app runtime and the
CodeBuild pipeline do not import files from here.

- `scripts/`: manual operator helpers, including generated-content publishing.
- `diy-project-blogs/`: small project workspaces used to create article findings,
  charts, screenshots, and publishable AI tutorial ideas.

Operator outputs are allowed to include local endpoint status, fallback notes,
and failed probes. Public articles are not. If a project documents our local
environment or a failed local dependency, keep it internal with `publish: false`
and create a customer-safe tutorial from the broader lesson.

Local model catalog endpoint, when running:

```sh
curl -s http://localhost:1234/api/v1/models
```

If the endpoint is unavailable, record the failure in the project output and
continue with projects that do not require live model inference.
