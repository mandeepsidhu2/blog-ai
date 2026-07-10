# Latest AI Article Production Run: Hallucinated Dependency Gates

Run time: 2026-07-10 00:49 EDT

## Summary

Produced and promoted two passing software-supply-chain articles about gating
AI coding assistant dependency suggestions before package installation,
repository cloning, setup-script execution, or secret-bearing workflows.

The batch keeps `evidenceMode` internal only. Public topic and tags use
customer-facing domain language: software supply chain, AI coding, dependency
security, package management, provenance, evals, and guardrails.

## Source Signals Reviewed

- HalluSquatting arXiv paper, submitted July 8, 2026:
  https://arxiv.org/abs/2607.07433
- BOUND package-hallucination mitigation paper, submitted July 2, 2026:
  https://arxiv.org/abs/2607.02052
- 2026 frontier-model package hallucination replication, revised June 11,
  2026:
  https://arxiv.org/abs/2605.17062
- PyPI similar-package security paper, submitted June 29, 2026:
  https://arxiv.org/abs/2606.29785
- npm provenance documentation:
  https://docs.npmjs.com/generating-provenance-statements/
- PyPI trusted publishing documentation:
  https://docs.pypi.org/trusted-publishers/
- GitHub dependency review documentation:
  https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review
- OpenSSF Scorecard:
  https://openssf.org/projects/scorecard/
- SLSA specification:
  https://slsa.dev/spec/v1.1/
- Public security/news discovery signal for HalluSquatting coverage:
  https://www.tomshardware.com/tech-industry/cyber-security/hallusquatting-is-the-latest-agentic-ai-exploit-where-models-dream-up-potentially-malicious-urls-in-tool-calls-attack-exploits-a-fundamental-weakness-in-every-available-model

Public/community signals were used for discovery only. Article claims rely on
the arXiv papers and official registry/security documentation above.

## Candidates

Promoted:

- `hallucinated-dependency-gates-2026`: `Gate AI Coding Agents Against
  Hallucinated Dependencies`
- `measure-hallucinated-dependency-gates`: `Measure Hallucinated Dependency
  Gates for AI Coding`

Not promoted:

- None. Both generated candidates passed the candidate public-content gate.

Temporary candidate batch:

- `/tmp/blog-ai-article-run-20260710-hallucinated-dependency-gates/`

## Experiment Artifacts

Created internal evidence project:

- `operator/diy-project-blogs/projects/hallucinated-dependency-gates/`

Artifacts:

- `tasks.json`: 20 representative PyPI, npm, and GitHub-style dependency
  suggestions.
- `run-experiment.mjs`: deterministic JavaScript scoring harness and SVG chart
  generator.
- `output.txt`: console summary used in the measured tutorial.
- `results.json`: full per-policy and per-case results.
- `hallucinated-dependency-gates.svg`: generated chart asset.
- `README.md`: reproducibility notes.

No LM Studio/local model inference was used. The local model catalog was not
needed for this deterministic run. No torch work was introduced, so the
MPS-only rule was not triggered.

Measured output:

```output
Hallucinated dependency gate experiment
tasks=20
blindAssistantInstall: pass_rate=0.050 route_match=0.050 unsafe_installs=13 squatted_accepts=9 provenance_misses=6 script_risk_misses=10 source_verification_misses=19 false_blocks=0 secret_overexposure=60
registryNameGate: pass_rate=0.350 route_match=0.350 unsafe_installs=3 squatted_accepts=0 provenance_misses=5 script_risk_misses=3 source_verification_misses=0 false_blocks=0 secret_overexposure=7
dependencyReleaseGate: pass_rate=1.000 route_match=1.000 unsafe_installs=0 squatted_accepts=0 provenance_misses=0 script_risk_misses=0 source_verification_misses=0 false_blocks=0 secret_overexposure=4
```

## Gates And Checks

Passed:

- Candidate public-content gate for 2 articles:
  `node operator/scripts/check-public-content.mjs --articles-dir /tmp/blog-ai-article-run-20260710-hallucinated-dependency-gates/articles --assets-dir /tmp/blog-ai-article-run-20260710-hallucinated-dependency-gates/assets --source-label latest-ai-article-production`
- Committed-source public-content gate for 43 articles.
- Site build with `SITE_URL=https://learn.toolsite.com`, producing 43
  tutorials.
- Generated-site check.
- New-slug generated-output scan for blocked internal labels, private paths,
  local diagnostics, forbidden production-extension wording, deterministic
  fixture language, and hype filler.
- Generated HTML/JSON/manifest/asset spot checks for both new slugs.
- `git diff --check`.
- Browser review on local preview:
  - desktop home plus both article pages.
  - 390px mobile home plus both article pages.
  - both article images loaded, TOCs rendered, code blocks remained scrollable
    on mobile, no horizontal overflow was detected, and mobile hero screenshots
    showed no overlap or clipped visuals.

Notes:

- A broad generated-output scan still finds pre-existing localhost text in the
  older `llm-context-boundary-evaluation` tutorial. The current run did not
  modify that article, and the committed-source public-content gate passed.
- Local `node` was unavailable on `PATH`; the bundled Codex Node runtime was
  used for the harness and validation commands.

Sandbox note:

- The sandboxed preview server failed to bind `127.0.0.1:4173` and
  `127.0.0.1:4193` with `EPERM`. Outside-sandbox execution was approved only
  for `env PORT=4193 node app-scripts/serve-dist.mjs`; it was used for browser
  review and then stopped.
- Port `4173` was already in use when the outside-sandbox preview was first
  attempted, so browser review used `127.0.0.1:4193`.

## Git Pipeline

Normal GitHub pipeline path was used.

- Batch commit: `e48b746` (`Add hallucinated dependency gate articles`)
- Pre-existing unpushed local commit included by the required default-branch
  push: `df18b19` (`Add AI media provenance gate articles`)
- Sandboxed push result: failed DNS resolution for `github.com`.
- Outside-sandbox push result: succeeded, advancing `origin/main` from
  `17952d5` to `e48b746`.

## Intervention Needed

None at report time. Pre-existing local edits to `README.md` and
`docs/INFRASTRUCTURE.md` were left unstaged and untouched.
