# Library Quality Audit - 2026-07-15

## Scope

This audit reviews the 43 articles that predate the tiered automation quality contract. The review treats the library as a senior software engineer or empirical scientist would: the article must answer a worthwhile question, expose evidence that supports its claims, avoid duplicating a stronger article, and use a visual that communicates more than a decorative flow.

The public library started with 52 articles. This change removes 27 legacy articles and their 27 article-specific assets, leaving 25 public articles: 16 retained legacy articles and nine tiered articles published under the stronger workflow.

## Decision Rubric

Each legacy article was assessed on five dimensions:

1. Question value: does the central question change a real engineering or research decision?
2. Evidence integrity: are claims supported by primary sources, real model runs, or auditable artifacts?
3. Method validity: do measurements test an external behavior, or merely score hand-authored labels with hand-authored formulas?
4. Redundancy: is the useful material already covered by a stronger and more specific article?
5. Visual value: does the asset expose a system boundary, measured result, comparison, or failure?

A long article was not automatically retained. Word count and heading count are anti-thinness checks, not proof of insight.

## Removed: Deterministic Policy Fixtures

All 20 measure-prefixed articles were removed. They used small static datasets, policies and expected labels written by the same author, and deterministic scoring formulas that generally rewarded the proposed policy. They contained runnable code, but the code demonstrated a policy rather than generating independent evidence. The clean scores therefore looked empirical without supporting a scientific claim.

- measure-agent-app-manifest-risk-gates
- measure-agent-concurrency-budget-gates
- measure-agent-delegation-release-gates
- measure-agent-trace-completeness-gates
- measure-agentic-commerce-payment-gates
- measure-ai-media-provenance-gates
- measure-coding-agent-rollout-gates
- measure-coding-agent-task-routing-gates
- measure-computer-use-agent-action-gates
- measure-covert-channel-agent-traces
- measure-cybersecurity-agent-release-gates
- measure-hallucinated-dependency-gates
- measure-healthcare-agent-workflow-gates
- measure-mcp-token-audience-gates
- measure-mcp-tool-catalog-gates
- measure-multimodal-retrieval-routing
- measure-personal-agent-access-gates
- measure-scientific-agent-verifier-gates
- measure-smart-contract-agent-patch-gates
- measure-token-budget-routing

The internal project folders remain available as historical operator artifacts. They are no longer presented as customer-facing experiments.

## Removed: Redundant Or Generic Guides

| Removed article | Decision |
| --- | --- |
| agent-delegation-release-gates-2026 | Broad delegation controls duplicate the more actionable coding-task route map and the agent operating-system guide. |
| agent-trace-contracts-2026 | Trace fields and release criteria are already integrated into the operating-system, concurrency, and coding-task guides; the standalone article did not add a distinct method. |
| coding-agent-rollout-gates-2026 | Cohort and adoption guidance substantially overlaps the stronger task-routing article, which now includes a machine-readable route contract. |
| cybersecurity-agent-release-gates-2026 | The generic dual-use taxonomy is weaker than the retained concrete security articles on dependency provenance, smart-contract replay, MCP authorization, and covert channels. |
| inference-cost-release-gates-2026 | The general route advice is superseded by current model-routing, token-budget, price, latency, and uncertainty analysis in the tiered library. |
| mcp-tool-catalog-gates-2026 | Capability review and consent are covered more precisely by the agent-app manifest guide; token and resource security are covered by the MCP authorization guide. |
| personal-agent-access-gates-2026 | Its private-tool boundary duplicates the more concrete app-consent and computer-use action guides. |

## Improved

### Local RAG Context Boundary

llm-context-boundary-evaluation was retained because it contains raw responses from an actual local Qwen model run, explicit model-loading control, per-case outputs, and a reproducible harness. It was revised to avoid presenting eight cases as a benchmark:

- renamed as a regression harness.
- added primary research context from RAGAs, ALCE, RAGChecker, and RAGVUE.
- added all eight case outcomes, citation recall values, and latencies.
- added Wilson intervals showing how little 8/8, 5/5, and 3/3 establish.
- documented the lack of repeats, prompt/model ablations, and portable latency evidence.
- replaced the perfect-bar hero with a case-level failure matrix and uncertainty panel.

### Coding-Agent Task Routing

coding-agent-task-routing-gates-2026 remains the canonical coding-agent rollout article. It now includes a machine-readable route contract with tool, write-scope, evidence, token, wall-time, review, and rollback boundaries. This preserves the actionable control from the removed delegation and cohort articles without keeping three overlapping guides.

### Visual Repairs

Four retained diagrams had light panels combined with a global light-text theme, which made labels nearly disappear. The computer-use review route, covert-channel containment route, scientific expert-review route, and smart-contract replay route now use dark high-contrast panels.

## Retained Legacy Set

The retained legacy articles have distinct questions and either source-backed engineering guidance or real empirical evidence:

- agent-app-consent-gates-2026
- agent-concurrency-release-gates-2026
- agentic-commerce-payment-gates-2026
- ai-agent-operating-systems-2026
- ai-media-provenance-gates-2026
- budgeted-guardrails-mlp-channel-interventions
- coding-agent-task-routing-gates-2026
- computer-use-agent-action-gates-2026
- covert-channel-agent-gates-2026
- hallucinated-dependency-gates-2026
- healthcare-agent-workflow-gates-2026
- llm-context-boundary-evaluation
- mcp-resource-authorization-gates-2026
- multimodal-retrieval-gates-2026
- scientific-agent-verifier-gates-2026
- smart-contract-agent-audit-gates-2026

Retention is not permanent approval. These pieces should be re-audited when protocol specifications, product capabilities, benchmark evidence, or stronger replacement articles materially change their decision value.
