# MCP Token Audience Gates

This internal evidence project evaluates release gates for MCP-style OAuth
token handling. It uses a deterministic JavaScript harness and a static dataset
of fourteen token/request scenarios.

The run compares three policies:

- `scopeOnly`: verifies only required scopes.
- `audienceOnly`: verifies required scopes and a resource audience match.
- `resourceBound`: verifies scopes, audience, issuer, token transport,
  protected resource metadata discovery, prompt-requested resource consistency,
  refresh-token misuse, and downstream passthrough attempts.

Run:

```sh
node operator/diy-project-blogs/projects/mcp-token-audience-gates/run-experiment.mjs
```

Outputs:

- `output.txt`: concise metric summary.
- `results.json`: dataset, per-policy metrics, and per-case decisions.
- `chart.svg`: chart used as the measured tutorial visual basis.

No local model inference is used. No torch code is used, so the MPS-only torch
rule is not triggered.
