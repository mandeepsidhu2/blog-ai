# Latest AI Article Production Run: Agent App Manifest Gates

Run time: 2026-07-03 07:18-07:44 EDT

## Source Signals Reviewed

- OpenAI Apps SDK security and privacy guidance:
  https://developers.openai.com/apps-sdk/guides/security-privacy
- OpenAI MCP server guidance for ChatGPT Apps and API integrations:
  https://developers.openai.com/api/docs/mcp
- Model Context Protocol authorization specification:
  https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- Model Context Protocol security best practices:
  https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- A2A protocol specification, including agent cards, extended cards, and
  signature verification:
  https://a2a-protocol.org/latest/specification/
- OWASP Top 10 for LLM Applications:
  https://owasp.org/www-project-top-10-for-large-language-model-applications/
- Public community/developer discovery around MCP onboarding, unofficial server
  trust, app-review expectations, consent clarity, and tool security. These
  were used as discovery inputs only; article claims were grounded in official
  docs, protocol specifications, security guidance, or measured local artifacts.

## Candidates

Promoted two passing candidates:

- `agent-app-consent-gates-2026`
  - Title: `Build Consent Gates for Agent App Manifests`
  - Internal mode: `strategy`
  - Topic/tags remain customer-facing agent-security, MCP, consent,
    app-security, authorization, and guardrail metadata.
  - Article: `content/articles/agent-app-consent-gates-2026.md`
  - Asset: `content/assets/agent-app-consent-gates-2026.svg`
- `measure-agent-app-manifest-risk-gates`
  - Title: `Measure Agent App Manifest Risk Gates`
  - Internal mode: `experiment`
  - Topic/tags remain customer-facing agent-security, MCP, app-security, eval,
    authorization, and guardrail metadata.
  - Article: `content/articles/measure-agent-app-manifest-risk-gates.md`
  - Asset: `content/assets/measure-agent-app-manifest-risk-gates.svg`

No additional candidates from this run were promoted. The batch remained below
the 50-article daily publication ceiling.

## Experiment Artifacts

Created internal evidence project:

- `operator/diy-project-blogs/projects/agent-app-manifest-risk-gates/`

Artifacts:

- `dataset.json`: 14 app, MCP server, and A2A-style agent-card release records.
- `run-experiment.mjs`: deterministic manifest-risk policy evaluator.
- `output.txt`: concise measurement output.
- `results.json`: policy metrics and case-level decisions.
- `chart.svg`: article visual for the measured candidate.
- `README.md`: reproduction notes.

Measured output:

```output
Agent app manifest risk gate experiment
cases=14
metadataOnly: accuracy=0.286 mean_score=0.357 blocked=0 reviewed=2 allowed=12 false_negatives=7 false_positives=0
consentOnly: accuracy=0.429 mean_score=0.5 blocked=1 reviewed=3 allowed=10 false_negatives=6 false_positives=0
boundaryGate: accuracy=1 mean_score=1 blocked=7 reviewed=3 allowed=4 false_negatives=0 false_positives=0
```

No model inference was used. No torch work was introduced, so MPS checks were
not triggered. No AWS, Terraform, OpenTofu, S3 sync, or CloudFront commands were
run.

## Gates And Review

- Candidate public-content gate against isolated temp batch:
  `passed for 2 articles`.
- Committed-source public-content gate:
  `passed for 25 articles`.
- Site build:
  `Built 25 tutorials into dist`.
- Generated-site check:
  `Site checks passed`.
- Blocked-label/local-diagnostic scan:
  clean for generated `dist/`.
- JSON/HTML spot-check:
  both generated article payloads and SEO pages included the expected titles,
  images, TOC, parsed content blocks, and metadata.
- Browser review:
  desktop and mobile article hero images loaded completely with 960x540 natural
  dimensions and `object-fit: contain`; the home spotlight image for
  `agent-app-consent-gates-2026` also loaded completely and rendered in a stable
  slot.

## Escalation Notes

- Local `node` was unavailable on `PATH`; used the bundled Codex Node runtime:
  `/Applications/Codex.app/Contents/Resources/cua_node/bin/node`.
- Sandbox blocked local preview binding to `127.0.0.1:4173` with `EPERM`.
  Outside-sandbox preview was required for browser review. Port `4173` was
  already occupied, so the preview ran on `127.0.0.1:4192`.
- Git push is expected to require outside-sandbox execution if network access
  is blocked.

## Worktree Caveat

The working tree contained unrelated pre-existing edits and untracked article
batches during validation, including `README.md`, `docs/INFRASTRUCTURE.md`,
`app-scripts/build-site.mjs`, `site/assets/styles.css`, and several untracked
articles/assets/projects not created in this run. They were not staged for this
automation commit. Full working-tree gates passed, but this run only promotes
the two agent-app manifest candidates listed above.

## Intervention Needed

None for this run. The promoted candidates passed the required gates and were
ready for normal GitHub pipeline publication through `main`.
