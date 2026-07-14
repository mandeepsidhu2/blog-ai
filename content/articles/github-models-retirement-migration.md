---
title: Migrate GitHub Models Behind a Provider Contract Before July 30
description: Turn GitHub Models' July retirement into a tested provider migration with contract diffing, dual-run evidence, telemetry continuity, and rollback.
topic: AI Platform Engineering
level: Advanced
date: 2026-07-14
readingTime: 15
tags: model-platforms, api-migration, ai-gateways, reliability-engineering
image: /content/v1/assets/github-models-retirement-migration.svg
imageAlt: Migration timeline and contract matrix for GitHub Models brownouts, retirement, replacement endpoints, and rollback readiness
evidenceMode: strategy
qualityTier: timely-analysis
---

GitHub Models will stop serving every customer on July 30, 2026. Before that final date, GitHub will deliberately interrupt the service during brief brownouts on July 16 and July 23. The playground, catalog, inference API, and bring-your-own-key endpoints are all in scope.

This is not a model-name substitution. GitHub Models bundled discovery, prompt storage, evaluation, organization controls, and inference behind GitHub authentication. Microsoft Foundry—the recommended API replacement—uses deployments, Azure resources, regional or global processing choices, quota, content filtering, and a different identity boundary. GitHub Copilot is an alternative for developer workflows, not a drop-in inference backend for your application.

The urgent engineering decision is to move application calls behind a provider-neutral contract before the first brownout, after first proving the failover with synthetic timeouts, disconnects, and ambiguous upstream completion. Then use both brownouts as corroborating live tests. A migration that only changes `base_url` may pass a smoke test while silently changing model versioning, auth, retry semantics, token accounting, safety filters, or data residency.

## Key finding and decision summary

Treat July 16 as the failover-readiness deadline and July 30 as the deletion deadline. GitHub describes the brownouts as brief but does not promise an exact observation window, so the scheduled event must not be your first or only failure test.

- By July 15: inventory every GitHub Models call, stored prompt, evaluation, BYOK dependency, credential, and organizational policy.
- During the July 16 brownout: prove traffic fails over without unsafe duplicate writes or hidden quality regression.
- By July 22: fix the observed gaps and repeat with production-like load.
- During the July 23 brownout: prove the replacement is the primary path and GitHub Models is only a rollback dependency.
- Before July 30: remove runtime dependence, revoke obsolete credentials, export needed prompts/eval artifacts, and retain an auditable migration record.

Do not route to Copilot simply because both products are on GitHub. Copilot’s published plans and surfaces target interactive coding and agent workflows. If your service needs a programmable inference SLA, select a model-serving API and test that contract directly.

## What GitHub actually announced

GitHub’s July 1 [retirement notice](https://github.blog/changelog/2026-07-01-github-models-is-being-fully-retired-on-july-30-2026/) says the July 30 shutdown applies to existing customers as well as new ones. It names four removed surfaces: playground, model catalog, inference API, and BYOK. It also schedules temporary errors on July 16 and July 23.

The preceding June 16 [new-customer closure](https://github.blog/changelog/2026-06-16-github-models-is-no-longer-available-to-new-customers/) confirms that this is a staged retirement, not a speculative future plan. Teams that defer until the last week will have skipped both provider-supplied failure rehearsals.

The current [GitHub Models documentation](https://docs.github.com/en/github-models) describes more than inference: quantitative evaluations, prompt optimization, prompt storage, prototyping, and organization management. Inventory those control-plane features separately. A replacement model endpoint does not automatically migrate a prompt file, evaluator definition, model allowlist, or audit policy.

| Retiring surface | Durable disposition | Evidence required before closure |
|---|---|---|
| Playground | export canonical prompts and owners; retire ad hoc variants | prompt inventory opens outside GitHub Models |
| Model catalog | replace implicit discovery with an approved deployment registry | every production model resolves to a pinned deployment |
| Inference API | route through the versioned provider adapter | synthetic timeout, disconnect, quota, and schema tests pass |
| BYOK endpoints | rotate or revoke credentials and document the new trust boundary | secret scan and credential-owner sign-off pass |

## Replacement comparison: similar syntax is not equivalent behavior

Sources: GitHub’s July 1 [retirement notice](https://github.blog/changelog/2026-07-01-github-models-is-being-fully-retired-on-july-30-2026/), Microsoft’s current [Foundry endpoint contract](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/endpoints), [Foundry deployment overview](https://learn.microsoft.com/en-us/azure/foundry/concepts/foundry-models-overview), GitHub’s current [Copilot product and pricing surface](https://github.com/features/copilot), and the [OpenAI API request-debugging reference](https://platform.openai.com/docs/api-reference/debugging-requests).

| Replacement path | Stable unit and measurable limits | What must change | Not comparable / unknown until tested |
|---|---|---|---|
| Microsoft Foundry OpenAI/v1 route | named deployment; up to 32 deployments per resource and 250 projects per resource in documented default limits | GitHub token → API key or Entra ID; model name → deployment name; region/capacity/filter configuration | catalog availability, quota, price, filter behavior, and latency vary by model/deployment |
| Direct provider API | provider model snapshot; provider request IDs and request/token rate-limit headers | credentials, endpoint, request fields, usage parser, error taxonomy, data controls | no shared model catalog or GitHub prompt/eval control plane |
| GitHub Copilot | user/seat workflow; Free lists 2,000 completions/month, Pro $10/month, Business $19/user/month | application inference becomes a human/developer workflow integration | not a general replacement inference SLA or arbitrary backend endpoint |
| Self-hosted open model | checkpoint/runtime digest, accelerator capacity, local gateway | own serving, patching, scaling, safety, observability, and model evaluation | capability and total cost are workload/hardware dependent |

The numbers in this table describe different units. “32 deployments per Foundry resource” cannot be compared with “2,000 Copilot completions per user.” The purpose is to expose contract shape, not produce a price leaderboard.

Microsoft says Foundry supports a shared endpoint and credentials across deployments, with deployment-level model name, version, capacity type, content filtering, and rate limiting. Its current guidance recommends the generally available OpenAI/v1 route and warns that the Azure AI Inference beta SDK is retiring. Do not migrate from one retiring surface onto another deprecated SDK.

## Build a provider contract before changing providers

Define the application contract at the narrowest useful layer. A text/JSON application might standardize:

```text
request:
  operation_id, tenant_id, model_class, messages, tools
  response_schema, max_output_tokens, deadline_ms, idempotency_key

response:
  provider, requested_model, response_model, request_id
  text, structured_output, tool_calls
  input_tokens, cached_input_tokens, output_tokens, finish_reason
  latency_ms, retry_count, safety_outcome

error:
  category = auth | quota | rate_limit | timeout | invalid | safety | provider
  retryable, retry_after_ms, provider_code, request_id
```

Do not erase provider-specific information to achieve portability. Preserve it in an extension map and raw encrypted logs with an appropriate retention policy. The neutral contract should make routing possible while leaving enough evidence to debug a model-specific incident.

Version the prompt renderer and tool schema separately from the model. GitHub Models may have inserted defaults or accepted fields that a new endpoint ignores. Serialize the exact outbound request after all adapters, and validate structured outputs against your schema rather than trusting a provider “JSON mode” label.

## Authentication and deployment names are semantic changes

GitHub access commonly begins with GitHub identity and repository or organization context. Foundry supports API keys and Microsoft Entra ID. The [Foundry endpoint documentation](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/endpoints) shows an OpenAI-compatible resource host with an `/openai/v1/` path, but requests name a deployment you created—not a universal provider model string.

That indirection is valuable for controlled upgrades, but only if the deployment is immutable enough for your audit. Record deployment name, underlying model name and version, capacity type, region/data zone, content filter, and configuration revision at request time. If an alias can move, store the resolved response model too.

The same document says model deployments can carry their own rate limits and filters. A successful authentication migration can therefore still change refusal rate, quota exhaustion, or output shape. Test identity, policy, and model behavior as separate dimensions.

## Use the brownouts as controlled failure injections

The two brownouts are unusual gifts: scheduled upstream failures before the terminal event. Prepare a scorecard before July 16:

1. failover activation time and percentage of requests successfully rerouted;
2. duplicate side effects caused by retries across providers;
3. p50/p95/p99 latency before, during, and after failover;
4. schema-valid response rate and tool-call parse rate;
5. safety/refusal delta on a pinned sentinel set;
6. input/output token and estimated-cost delta;
7. request IDs preserved for both failed and replacement calls;
8. queue depth, deadline expiry, and user-visible error rate.

Keep failover deterministic. Use a stable request hash or explicit primary/secondary policy rather than random routing that makes an incident irreproducible. For side-effecting tools, fail closed unless the application can prove the original request did not commit. Provider retries and tool retries are different layers.

Predeclare quantitative acceptance thresholds against the application's existing service objective. A concrete starting scorecard is at least 100 requests per synthetic failure mode and 200 requests in each quality stratum, 99% successful rerouting for read-only calls, zero duplicate side effects, activation within 10 seconds, schema-valid responses above 99.5%, added failover overhead below 500 milliseconds, a shadow interval of at least 60 minutes, fewer than 1% unexpected safety-outcome changes, and no more than 5% token-cost regression at the matched task-success floor. These are proposed engineering thresholds, not measurements of GitHub or Foundry; replace them when your current SLO is stricter.

Azure API Management’s [AI gateway guidance](https://learn.microsoft.com/en-sg/azure/api-management/genai-gateway-capabilities) describes priority, weighted, round-robin, and session-aware load balancing plus a circuit breaker that can honor `Retry-After`. Those are useful mechanisms, not a reason to skip application semantics. A gateway cannot infer whether a second “send email” tool call is safe.

## Telemetry continuity is part of the migration

OpenAI’s [API debugging reference](https://platform.openai.com/docs/api-reference/debugging-requests) documents server request IDs, client-supplied request IDs up to 512 ASCII characters, and request/token rate-limit headers. Other providers expose different fields. Normalize the concepts, preserve the originals, and propagate one application operation ID through every attempt.

OpenTelemetry’s [GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/) define attributes for provider, request model, response model, input tokens, cached input tokens, output tokens, and reasoning tokens. They also warn that prompts, tool arguments, and system instructions may contain sensitive material. Turn on identity and usage attributes by default; treat content capture as opt-in with redaction and access controls.

For each attempt, store:

```text
operation_id → attempt_id → provider_request_id
provider.name, request.model, response.model
server.address, region, deployment_revision
input_tokens, cached_input_tokens, output_tokens
status, retry_after, latency, finish_reason
prompt_renderer_version, tool_schema_version, policy_version
```

Without that continuity, a post-migration cost or quality shift becomes an argument about dashboards rather than an explainable change.

## Evaluation and comparability limits

Run the same frozen request set against GitHub Models and the replacement while the old service remains available. Stratify by task type, language, prompt length, tool use, response schema, and risk. Use deterministic validators where possible; reserve judge models for dimensions that cannot be mechanically checked, and blind human review to provider identity.

Do not assume the same named model means the same snapshot across hosts. Hosting layer, system defaults, content filters, context limits, tool parser, and update cadence can differ. Even OpenAI-compatible JSON does not establish behavioral equivalence.

Cost comparisons also need returned usage from each host. Tokenizers and cached-input accounting can differ. Compare accepted task completion per dollar at matched quality thresholds; do not multiply one provider’s token count by another provider’s price.

The migration window is short, so separate blocking evidence from desirable evidence. Blocking: authentication, schema/tool correctness, safety sentinel results, quota under expected load, data-region acceptability, and tested failover. Desirable: long-horizon quality studies and perfect price optimization. The latter can continue after runtime dependence is removed.

## Failure modes and rollback

Common failures include:

- deployment aliases pointing at a different version than the evaluation;
- content filters changing refusal or tool-call behavior;
- retries duplicating non-idempotent application actions;
- rate-limit headers not mapped into the common backoff policy;
- usage fields interpreted with the old provider’s tokenizer assumptions;
- stored GitHub prompts or evaluators discovered only after inference moves;
- region or Marketplace terms blocking the chosen model at cutover;
- a “compatible” SDK silently dropping provider-specific reasoning or tool fields.

Before July 30, rollback can mean returning traffic to GitHub Models. After July 30, that path disappears. The durable rollback is therefore another validated provider/model deployment or a reduced-function mode, not the retiring service.

Keep a feature flag that can disable generation, switch to a smaller validated model, or degrade to retrieval/templates for high-value flows. Roll back when schema-valid rate or task success crosses the declared floor, p99 latency breaches the user deadline, safety sentinels regress, or quota produces sustained user-visible errors.

## Adoption boundary: what not to migrate

Do not preserve a low-value prototype merely because a replacement endpoint exists. If it has no accountable owner, production user, or decision-changing evaluation, export any reusable prompt and shut the runtime down. Reduced-function mode is a successful migration outcome when it removes risk more cheaply than rebuilding an unused path.

Do not migrate a GitHub Models inference workload to Copilot when the application needs unattended API calls, custom end-user product behavior, or a service-level inference contract. Copilot is appropriate when the true requirement is developer assistance inside GitHub, an IDE, or the CLI.

Do not choose Foundry solely because GitHub recommended it. It is a strong default for organizations already using Azure identity, policy, and regional controls, but model availability, Marketplace terms, region, quota, and total cost must be verified. Microsoft’s [Foundry deployment overview](https://learn.microsoft.com/en-us/azure/foundry/concepts/foundry-models-overview) distinguishes standard, provisioned, batch, data-zone, regional, and developer deployment types; those choices affect compliance and operations.

Self-hosting is not the emergency default unless a validated runtime already exists. A rushed open-model deployment can introduce more availability and safety risk than the retirement removes.

## Migration checklist and production readiness

Export or version every prompt and evaluator needed after shutdown. Replace implicit catalog lookups with an approved deployment registry. Create quota alerts and a load test in the chosen region. Validate content-filter behavior, structured output, tool cancellation, and streaming disconnects. Rotate credentials and remove GitHub Models scopes after cutover.

Make the July 23 brownout a go/no-go event. A team is ready when the replacement serves all in-scope traffic without GitHub Models, every request is attributable through telemetry, and the fallback does not rely on the retiring endpoint. If that test fails, reduce scope rather than hiding the error behind retries.

## Source ledger and dates

- July 1, 2026 — [GitHub final retirement notice](https://github.blog/changelog/2026-07-01-github-models-is-being-fully-retired-on-july-30-2026/): July 16/23 brownouts, July 30 shutdown, and affected surfaces.
- June 16, 2026 — [GitHub new-customer closure](https://github.blog/changelog/2026-06-16-github-models-is-no-longer-available-to-new-customers/): staged retirement evidence.
- Current July 2026 — [GitHub Models documentation](https://docs.github.com/en/github-models): prompt, evaluation, catalog, inference, and organization features to inventory.
- Current July 2026 — [Microsoft Foundry endpoints](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/endpoints): deployment semantics, OpenAI/v1 route, identity, filters, and rate limits.
- March 5, 2026 update — [Foundry Models overview](https://learn.microsoft.com/en-us/azure/foundry/concepts/foundry-models-overview): deployment types, hosting responsibility, and billing boundaries.
- Current 2026 — [Foundry quotas and limits](https://learn.microsoft.com/en-us/azure/ai-foundry/model-inference/quotas-limits): 100 resources/region/subscription, 250 projects/resource, 32 deployments/resource, and 10-header boundary.
- Current July 2026 — [GitHub Copilot plans](https://github.com/features/copilot): interactive product surfaces, plan prices, completions, and credit units.
- Current 2026 — [Azure API Management AI gateway](https://learn.microsoft.com/en-sg/azure/api-management/genai-gateway-capabilities): routing and circuit-breaker mechanisms.
- Current conventions — [OpenTelemetry GenAI attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/): portable provider/model/token telemetry and content-sensitivity warnings.
- Current API reference — [OpenAI request debugging](https://platform.openai.com/docs/api-reference/debugging-requests): request IDs and rate-limit headers for a direct-provider comparison.

The deadline is close, but the right migration is not heroic. Make the provider boundary explicit, preserve evidence, and use the scheduled failures to prove the path you will still have on July 31.
