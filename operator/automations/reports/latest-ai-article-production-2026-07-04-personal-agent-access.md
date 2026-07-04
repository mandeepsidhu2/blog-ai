# Latest AI Article Production Run: Personal Agent Access Gates

Run time: 2026-07-04 00:00 EDT

## Sources Reviewed

- OpenAI computer-use tool documentation: https://platform.openai.com/docs/guides/tools-computer-use
- Anthropic computer-use tool documentation: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use-tool
- MyPCBench personal-computer agent benchmark: https://arxiv.org/abs/2606.16748
- LabOSBench computer-use agent benchmark: https://arxiv.org/abs/2606.16802
- PAPerBench privacy and personalization benchmark: https://arxiv.org/abs/2602.15028
- OpenCUA public computer-use agent stack and community signal: https://github.com/xlang-ai/OpenCUA

Recent memory already covered coding-agent rollout, coding-agent task routing,
MCP tool-catalog gates, cybersecurity-agent gates, smart-contract-agent gates,
and agent-app consent/manifest topics. This run avoided repeating those clusters
and focused on personal computer-use assistants and task-level access control.

## Candidate Batch

Temporary batch directory:

- `/private/tmp/blog-ai-article-run-20260704-personal-agent-access/`

Candidates created and promoted:

- `personal-agent-access-gates-2026`: `Gate Personal AI Assistants Before They Touch Private Tools`
- `measure-personal-agent-access-gates`: `Measure Personal AI Assistant Access Gates`

Both use customer-facing topic and tags for AI agents, computer use, privacy,
access control, evaluation, governance, and personal assistants. The internal
source mode remains front-matter metadata only and is not exposed as public
copy.

## Experiment Artifacts

Internal evidence project:

- `operator/diy-project-blogs/projects/personal-agent-access-gates/`

Artifacts:

- `cases.json`: 16 personal-assistant task records.
- `run-experiment.mjs`: deterministic policy harness.
- `output.txt`: metric output.
- `results.json`: per-policy and per-case scoring output.
- `personal-agent-access-gates.svg`: measured result chart.
- `README.md`: run notes and model-hygiene reminder.

No LM Studio or local model inference was used. No torch work was introduced, so
the MPS-only rule was not triggered.

Measured output:

```output
Personal agent access gate experiment
tasks=16
broadConsent: pass_rate=0.000 route_match=0.000 unsafe_actions=8 sensitivity_violations=0 overexposed_resources=1408 mean_visible_resources=96.00 false_blocks=0
sourceScoped: pass_rate=0.250 route_match=0.250 unsafe_actions=3 sensitivity_violations=2 overexposed_resources=240 mean_visible_resources=23.00 false_blocks=0
taskAccessGate: pass_rate=1.000 route_match=1.000 unsafe_actions=0 sensitivity_violations=0 overexposed_resources=57 mean_visible_resources=10.94 false_blocks=0
```

## Gates And Review

Passed:

- Candidate public-content gate for 2 articles.
- Committed-source public-content gate for 29 articles.
- Site build with `SITE_URL=https://learn.toolsite.com`, producing 29 tutorials.
- Generated-site check.
- `git diff --check`.
- Targeted generated-output scan for the two new pages found no blocked internal
  labels, private paths, localhost diagnostics, AWS profile references, or
  Terraform state references.
- Generated HTML and JSON spot checks verified both article pages, TOCs, image
  references, manifest entries, and search-index entries.
- Browser review on desktop verified both new article hero images, TOCs, and no
  horizontal overflow.
- Browser review at 390 px mobile verified both new article images stay
  contained and the home page links both tutorials without horizontal overflow.

Notes:

- A broad scan over all generated output still finds pre-existing localhost
  example text in the older `llm-context-boundary-evaluation` article. It is not
  introduced by this run and was left unchanged.
- The sandbox blocked the preview server bind with `EPERM`; outside-sandbox
  preview was used only for visual review and then stopped.
- Pre-existing local edits to `README.md` and `docs/INFRASTRUCTURE.md` were left
  unstaged and untouched.

## Intervention Needed

Local commit for this run:

- `525d80e` (`Add personal agent access gate articles`)

Push result:

- Sandboxed `git push origin main` failed DNS resolution for `github.com`.
- Outside-sandbox `git push origin main` was rejected by the approval reviewer
  because local `main` would publish nine unpushed commits, including eight
  pre-existing commits outside this run.

Intervention needed: approve or perform the branch push with awareness that it
will publish the prior local commits as well as this batch, or split/rebase the
history manually before pushing.
