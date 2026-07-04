# Personal Agent Access Gates

This project measures access-control policies for personalized computer-use
agents. It is internal evidence for public tutorials about granting assistants
limited access to local files, browser history, email, calendars, customer
systems, and finance or HR data.

The experiment is deterministic and does not use a local model, torch, CUDA, or
CPU torch. It compares three policies:

- `broadConsent`: a coarse grant that lets the agent see and act broadly.
- `sourceScoped`: a connector-level grant that limits some sensitive actions.
- `taskAccessGate`: a task-level gate with blocked, read-only, draft, write,
  confirmation, and human-approval routes.

Run:

```sh
/Applications/Codex.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
```

Artifacts:

- `cases.json`: task dataset.
- `output.txt`: deterministic metric output.
- `results.json`: per-policy and per-case scoring details.
- `personal-agent-access-gates.svg`: chart used as the article asset.

No local model service was required. If a later variant uses LM Studio, follow
the repo model hygiene rules: unload all models before the run, load only the
needed model for the active phase, unload it before switching phases, and stop
if model listing, loading, unloading, or inference fails.
