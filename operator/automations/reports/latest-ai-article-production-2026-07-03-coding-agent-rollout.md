# Latest AI Article Production Run: Coding Agent Rollout Gates

Run time: 2026-07-03 07:02-07:24 EDT

## Source Signals Reviewed

- Microsoft command-line coding-agent rollout paper:
  https://arxiv.org/abs/2607.01418
- Anthropic Claude Code overview:
  https://code.claude.com/docs/en/overview
- GitHub Copilot cloud agent documentation:
  https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent
- OpenAI Codex documentation:
  https://developers.openai.com/codex
- Open-source coding-agent trace census:
  https://arxiv.org/abs/2606.24429
- Agentic coding tool configuration study:
  https://arxiv.org/abs/2602.14690
- No-chain-of-thought task-completion horizon paper:
  https://arxiv.org/abs/2606.07157
- Public community and developer-news discovery searches around Claude Code,
  Copilot CLI, cloud coding agents, AI credits, security concerns, and peer-led
  adoption. These were used as discovery inputs only; article claims were
  grounded in official docs, papers, or measured local artifacts.

## Candidates

Promoted two passing candidates:

- `coding-agent-rollout-gates-2026`
  - Title: `Plan Coding Agent Rollouts With Adoption Gates`
  - Internal mode: `strategy`
  - Topic/tags remain customer-facing AI-agent, developer-productivity,
    software-engineering, eval, governance, and observability metadata.
  - Article: `content/articles/coding-agent-rollout-gates-2026.md`
  - Asset: `content/assets/coding-agent-rollout-gates-2026.svg`
- `measure-coding-agent-rollout-gates`
  - Title: `Measure Coding Agent Rollout Gates`
  - Internal mode: `experiment`
  - Topic/tags remain customer-facing AI-agent, developer-productivity, eval,
    observability, software-engineering, and governance metadata.
  - Article: `content/articles/measure-coding-agent-rollout-gates.md`
  - Asset: `content/assets/measure-coding-agent-rollout-gates.svg`

No additional candidates were promoted. The batch remained below the 50-article
daily publication ceiling.

## Experiment Artifacts

Created internal evidence project:

- `operator/diy-project-blogs/projects/coding-agent-rollout-gates/`

Artifacts:

- `dataset.json`: 14 team-level rollout records.
- `run-experiment.mjs`: deterministic rollout-policy evaluator.
- `output.txt`: concise measurement output.
- `results.json`: detailed per-policy and per-team metrics.
- `chart.svg`: article visual for the measured candidate.
- `README.md`: reproduction notes.

Measured output:

```output
Coding agent rollout gate experiment
teams=14
broadRollout: seats=1048 retained=828 activation=0.79 monthly_credit_units=38744 wasted_credit_units=11475 pr_lift=479 unsupported_teams=7 p95_payback_days=304
activityOnly: seats=558 retained=469 activation=0.841 monthly_credit_units=23028 wasted_credit_units=6222 pr_lift=387 unsupported_teams=3 p95_payback_days=240
peerVisibleGate: seats=408 retained=396 activation=0.971 monthly_credit_units=16651 wasted_credit_units=3126 pr_lift=397 unsupported_teams=0 p95_payback_days=106
```

No local model service was used. No torch work was introduced, so MPS checks
were not triggered. No AWS, Terraform, OpenTofu, or cloud-mutating commands
were run.

## Gates And Review

- Candidate public-content gate against isolated temp batch:
  `passed for 2 articles`.
- Committed-source public-content gate:
  `passed for 17 articles`.
- Site build:
  `Built 17 tutorials into dist`.
- Generated-site check:
  `Site checks passed`.
- Blocked-label/local-diagnostic scan:
  clean for generated `dist/`.
- JSON spot-check:
  both generated article payloads included the expected title, image, TOC, and
  parsed content blocks.
- Browser review:
  home spotlight and both article hero images loaded completely, used
  `object-fit: contain`, exposed 960x540 natural dimensions, and rendered in
  stable article slots.

## Escalation Notes

- Local `node` was unavailable on `PATH`; used the bundled Codex Node runtime:
  `/Applications/Codex.app/Contents/Resources/cua_node/bin/node`.
- Sandbox blocked local preview binding to `127.0.0.1:4173` with `EPERM`.
  Existing preview ports `4173` and `4174` were unavailable/unstable, so the
  browser review used an outside-sandbox preview server on `127.0.0.1:4191`.
- Git push is expected to require outside-sandbox execution if DNS is blocked,
  matching prior automation runs.

## Intervention Needed

None. The candidates passed the required gates and were ready for normal GitHub
pipeline publication through `main`.
