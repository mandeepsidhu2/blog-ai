# Latest AI Article Production Run: Computer-Use Action Gates

Run time: 2026-07-09 11:55 EDT

## Summary

Produced and promoted two passing AI-agent articles about action gates for
computer-use agents operating browser, desktop, and SaaS workflows.

The batch keeps `evidenceMode` internal only. Public topic and tags use
customer-facing domain language: AI agents, computer use, GUI agents, workflow
automation, model evaluation, safety, and evals.

## Source Signals Reviewed

- OpenAI, Computer-Using Agent:
  https://openai.com/index/computer-using-agent/
- OpenAI, ChatGPT Atlas:
  https://openai.com/index/introducing-chatgpt-atlas/
- OpenAI API docs, computer use:
  https://platform.openai.com/docs/guides/tools-computer-use
- Anthropic Claude Platform docs, computer use tool:
  https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use-tool
- OSWorld2.0 arXiv benchmark:
  https://arxiv.org/abs/2606.29537
- SaaS-Bench arXiv benchmark:
  https://arxiv.org/abs/2605.15777
- SaaS-Bench GitHub repository, used as public community/discovery signal:
  https://github.com/UniPat-AI/SaaS-Bench
- OSWorld GitHub repository, used as public community/discovery signal:
  https://github.com/xlang-ai/OSWorld
- AgentCIBench arXiv privacy benchmark:
  https://arxiv.org/abs/2606.23189
- DynamicGUIBench arXiv benchmark:
  https://arxiv.org/abs/2604.25380
- Public news/community discovery inputs included recent search results for
  AI browsers, computer-use agents, and GUI-agent benchmarks. Viral or news
  claims were not used as authoritative article claims without primary-source
  confirmation.

## Candidates

Promoted:

- `computer-use-agent-action-gates-2026`: `Gate Computer-Use Agents Before
  SaaS Workflows`
- `measure-computer-use-agent-action-gates`: `Measure Computer-Use Agent
  Action Gates`

Not promoted:

- None. Both generated candidates passed the candidate public-content gate.

Temporary candidate batch:

- `/tmp/blog-ai-article-run-20260709-computer-use-action-gates/`

## Experiment Artifacts

Created internal evidence project:

- `operator/diy-project-blogs/projects/computer-use-agent-action-gates/`

Artifacts:

- `tasks.json`: 18 representative computer-use workflow tasks.
- `run-experiment.mjs`: deterministic JavaScript harness.
- `output.txt`: console summary used in the measured tutorial.
- `results.json`: full per-policy and per-case results.
- `computer-use-agent-action-gates.svg`: generated chart asset.
- `README.md`: reproducibility notes.

No LM Studio/local model inference was used. The local model catalog probe
`curl -s --max-time 2 http://localhost:1234/api/v1/models` failed with exit
code 7, which was recorded here and did not block this deterministic run. No
torch work was introduced, so the MPS-only rule was not triggered.

Measured output:

```output
Computer-use agent action gate experiment
tasks=18
autonomousBrowserAgent: pass_rate=0.111 route_match=0.111 unsafe_submissions=13 destructive_writes=7 confirmation_misses=13 verification_misses=16 dynamic_state_misses=5 false_blocks=0 credential_overexposure=16 app_overreach=50
benchmarkCompletionGate: pass_rate=0.444 route_match=0.444 unsafe_submissions=0 destructive_writes=1 confirmation_misses=0 verification_misses=0 dynamic_state_misses=2 false_blocks=2 credential_overexposure=0 app_overreach=22
workflowActionGate: pass_rate=1.000 route_match=1.000 unsafe_submissions=0 destructive_writes=0 confirmation_misses=0 verification_misses=0 dynamic_state_misses=0 false_blocks=0 credential_overexposure=0 app_overreach=21
```

## Gates And Checks

Passed:

- Candidate public-content gate for 2 articles:
  `node operator/scripts/check-public-content.mjs --articles-dir /tmp/blog-ai-article-run-20260709-computer-use-action-gates/articles --assets-dir /tmp/blog-ai-article-run-20260709-computer-use-action-gates/assets --source-label latest-ai-article-production`
- Committed-source public-content gate for 39 articles.
- Site build with `SITE_URL=https://learn.toolsite.com`, producing 39
  tutorials.
- Generated-site check.
- Generated-output scan for internal evidence labels, private paths, localhost
  model diagnostics, forbidden production-extension wording, deterministic
  fixture language, and hype filler.
- Generated HTML/JSON/manifest/search-index/sitemap/asset spot checks for both
  new slugs.
- `git diff --check`.
- Browser review on local preview:
  - desktop home plus both article pages.
  - 390px mobile home plus both article pages.
  - both article images loaded, TOCs rendered, and no horizontal overflow was
    detected.

Sandbox note:

- The sandboxed preview server failed to bind `127.0.0.1:4173` with `EPERM`.
  Outside-sandbox execution was approved only for
  `node app-scripts/serve-dist.mjs`; it was used for browser review and then
  stopped.

## Git Pipeline

Normal GitHub pipeline path was used.

- Batch commit: `51e1119` (`Add computer-use agent action gate articles`)
- Sandboxed push result: failed DNS resolution for `github.com`.
- Outside-sandbox push result: succeeded, advancing `origin/main` from
  `92c6cd2` to `51e1119`.

## Intervention Needed

None at report time. Pre-existing local edits to `README.md` and
`docs/INFRASTRUCTURE.md` were left unstaged and untouched.
