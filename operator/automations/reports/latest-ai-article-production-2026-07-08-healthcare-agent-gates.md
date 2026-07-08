# Latest AI Article Production Run: Healthcare Agent Gates

Run time: 2026-07-08 16:11 EDT

## Sources Reviewed

- HealthAgentBench paper: https://arxiv.org/abs/2606.31179
- HealthAgentBench public site and leaderboard: https://microsoft.github.io/HealthAgentBench/
- HealthAgentBench GitHub repository: https://github.com/microsoft/HealthAgentBench
- FDA AI in Software as a Medical Device: https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-software-medical-device
- FDA AI-enabled medical devices list: https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-enabled-medical-devices
- WHO regulatory considerations on AI for health: https://www.who.int/publications/i/item/9789240078871
- WHO ethics and governance of AI for health: https://www.who.int/publications/i/item/9789240029200
- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
- Coalition for Health AI: https://www.chai.org/

Public community/discovery signals reviewed:

- HealthAgentBench GitHub activity, public release notes, issues/contribution hooks, and task documentation.
- CHAI public feedback work groups and public registry/governance materials.
- Search checks for independent Reddit/Hacker News discussion around HealthAgentBench did not surface a reliable thread during this run, so no community claim was treated as evidence.

## Candidates

Promoted candidates:

- `healthcare-agent-workflow-gates-2026` - `Gate Healthcare AI Agents Before Clinical Workflows`
- `measure-healthcare-agent-workflow-gates` - `Measure Healthcare AI Agent Workflow Gates`

No failed candidates were promoted. The two promoted articles plus two pre-existing untracked July 8 scientific-agent articles keep the day below the 50-article cap.

## Experiment Artifacts

Created internal evidence project:

- `operator/diy-project-blogs/projects/healthcare-agent-workflow-gates/`

Artifacts:

- `tasks.json`: 18 representative healthcare-agent workflow tasks.
- `run-experiment.mjs`: deterministic JavaScript harness.
- `output.txt`: console summary used in the measured article.
- `results.json`: full per-policy and per-case metrics.
- `healthcare-agent-workflow-gates.svg`: generated chart copied to article assets.
- `README.md`: run notes and model/tooling boundary.

Measured results:

```text
Healthcare agent workflow gate experiment
tasks=18
autonomousClinicalAgent: pass_rate=0.111 policy_match=0.111 unsafe_actions=10 signoff_misses=10 patient_comms_misses=4 data_mutation_violations=11 modality_failures=0 false_blocks=0 privacy_overexposure=23
benchmarkThresholdGate: pass_rate=0.278 policy_match=0.278 unsafe_actions=3 signoff_misses=1 patient_comms_misses=0 data_mutation_violations=2 modality_failures=0 false_blocks=1 privacy_overexposure=11
clinicalWorkflowGate: pass_rate=1.000 policy_match=1.000 unsafe_actions=0 signoff_misses=0 patient_comms_misses=0 data_mutation_violations=0 modality_failures=0 false_blocks=0 privacy_overexposure=2
```

No LM Studio/local model inference was used. No torch work was introduced, so the MPS-only rule was not triggered.

## Gates And Review

Passed:

- Candidate public content gate for 2 articles:
  `operator/scripts/check-public-content.mjs --articles-dir /tmp/blog-ai-article-run-20260708-healthcare-agent-gates/articles --assets-dir /tmp/blog-ai-article-run-20260708-healthcare-agent-gates/assets --source-label latest-ai-article-production`
- Committed-source public content gate for 37 articles:
  `operator/scripts/check-public-content.mjs`
- Site build:
  `SITE_URL=https://learn.toolsite.com node app-scripts/build-site.mjs`
- Generated-site check:
  `app-scripts/check-site.mjs`
- Generated-output scan for internal labels, local diagnostics, private paths, local model endpoint references, AWS profile references, and hype filler.
- Spot checks for the new tutorial HTML, manifest/search references, article JSON, and SVG assets.
- Browser review on local preview:
  - Desktop article pages loaded expected H1, TOC, and complete SVG hero assets.
  - Home spotlight linked to the healthcare article and loaded the expected SVG.
  - 390px mobile review showed complete SVG assets and no horizontal overflow on both new article pages.

Sandbox note:

- Local `node` was not on PATH; used the bundled Codex Node runtime.
- Sandboxed preview server bind to `127.0.0.1:4173` failed with `EPERM`.
- Outside-sandbox preview was used only for required browser review on `127.0.0.1:4193` and was stopped after review.

## Git Scope

This run intentionally leaves unrelated pre-existing working-tree files untouched:

- Modified `README.md`
- Modified `docs/INFRASTRUCTURE.md`
- Untracked scientific-agent articles, assets, report, and evidence project that existed before this run's promotion step.

The automation commit should stage only the healthcare articles, healthcare assets, healthcare evidence project, this report, and automation memory.

## Intervention Needed

No content-quality intervention is needed. Push result will be recorded after the required commit/push step.
