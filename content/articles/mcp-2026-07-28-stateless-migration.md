---
title: Migrate to Stateless MCP Before the 2026-07-28 Specification
description: Prepare MCP servers for sessionless requests, explicit state handles, Tasks and Apps extensions, OAuth hardening, conformance, and rollback.
topic: Agent Protocols
level: Advanced
date: 2026-07-16
readingTime: 18
tags: model-context-protocol, agent-infrastructure, oauth, distributed-systems, protocol-migration
image: /content/v1/assets/mcp-2026-07-28-migration-surface.svg
imageAlt: Migration matrix showing MCP session removal, explicit state handles, extensions, authorization changes, and validation gates
evidenceMode: strategy
qualityTier: timely-analysis
---

The next Model Context Protocol specification ships on July 28, 2026. Its release candidate removes the initialization handshake and protocol session, requires operation headers for Streamable HTTP, moves long-running Tasks into an extension, formalizes MCP Apps, hardens OAuth behavior, adopts full JSON Schema 2020-12 for tools, and deprecates Roots, Sampling, and Logging.

This is not a header-only upgrade. A server that stored authorization, tenant, workflow, or browser state behind `Mcp-Session-Id` must move that state into explicit application handles or durable backend records. A client that assumes an SSE connection can carry unsolicited server requests must adopt the new input-required round trip. A task implementation built against `2025-11-25` must change lifecycle methods.

The right decision is to dual-stack the old and new protocol versions behind contract tests now, then cut over only after state isolation, authorization issuer binding, cancellation, retries, and conformance pass. Do not wait for July 28 to discover that the session store contained application semantics the protocol no longer carries.

## Key Finding and Decision Summary

The May 21 [release-candidate announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) calls this the largest MCP revision since launch. Six Specification Enhancement Proposals remove the protocol session. The practical promise is attractive: ordinary round-robin load balancing, no sticky route, no shared protocol-session store, routable headers, cacheable list results, and trace propagation.

The migration cost sits in four places:

- state: hidden session state becomes explicit tool arguments or durable handles;
- interaction: server-to-client requests can occur only while processing a client request and may require a reissued call;
- extensions: Tasks and Apps have independent contracts and versioning;
- security: OAuth issuer validation, client type, credential binding, refresh tokens, and discovery rules become stricter.

Build a version matrix, not an in-place rewrite. Keep `2025-11-25` stable while adding `2026-07-28` tests. Pin the protocol version per request and reject mixed header/body semantics.

The release candidate is locked, but the July 28 document and SDK releases are
still future events as of this article's date. Pin tests to a reviewed draft
revision, record the SDK version that passed them, and repeat conformance
against the final artifacts before enabling production traffic. Do not treat
the scheduled final date as proof that every implementation is ready.

## What Changes in the Core Protocol

In `2025-11-25`, the client initializes a session, receives `Mcp-Session-Id`, and sends it on later requests. In `2026-07-28`, each call is self-contained. The request carries `MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name`; client information and capabilities move into `_meta`.

The handshake methods `initialize` and `initialized` are removed. A new `server/discover` method supplies capabilities when a client needs them before a call. The `Mcp-Session-Id` header disappears.

The protocol is stateless, but the application does not have to be. The recommended pattern is an explicit opaque handle:

```text
tools/call create_basket
  -> { basket_id: "bkt_7f..." }

tools/call add_item
  arguments:
    basket_id: "bkt_7f..."
    sku: "A-104"
```

That handle must be scoped to tenant, user, authorization context, and expiry. It must not be a guessable substitute for a session ID.

## Protocol Comparison and Migration Matrix

Sources: the May 21 [MCP release candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/), the current [draft specification](https://modelcontextprotocol.io/specification/draft), and the merged [Tasks extension proposal](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2663).

| Surface | `2025-11-25` behavior | `2026-07-28` behavior | Required engineering change |
|---|---|---|---|
| Initialization | `initialize` / `initialized` handshake | removed; optional `server/discover` | move version and capabilities to request metadata |
| Protocol state | `Mcp-Session-Id` may pin an instance | no protocol session | externalize state and remove sticky-routing dependency |
| HTTP routing | gateway may inspect JSON-RPC body | `Mcp-Method` and `Mcp-Name` required | validate header/body agreement and route on headers |
| Server requests | often tied to persistent SSE | only while processing a client request | implement `inputRequired`, `requestState`, and reissue |
| Tasks | experimental core feature | official extension; `get/update/cancel` | replace `tasks/result`; remove `tasks/list` assumptions |
| Tool schemas | restricted schema subset | full JSON Schema 2020-12 | bound depth/time; prevent external `$ref` dereference |
| Missing resource | custom `-32002` | JSON-RPC `-32602` Invalid Params | update literal error matching and telemetry |
| Deprecation | informal | at least 12 months before removal | track feature lifecycle and version support windows |

The table describes contract changes, not implementation maturity. SDK support can lag the release candidate. The project expects Tier 1 SDKs to support the final version within the ten-week validation window, but your language and host combination still needs verification.

## Explicit State Is an Application Contract

Removing protocol sessions improves horizontal scaling only if state ownership becomes clearer. Do not copy the session object into one giant base64 `requestState` blob and call the migration complete.

Separate three kinds of state:

1. protocol metadata: version, capabilities, tracing, and operation identity;
2. workflow state: basket, browser, job, transaction, or document handle;
3. authority: user, tenant, scopes, consent, and policy version.

Workflow handles should be opaque, high entropy, revocable, and bound to authority. Store the authoritative record server-side when the state is sensitive or large. Passing an identifier through the model is useful for composition, but the server must validate that the caller can use it.

Prefer a server-side lookup for high-authority workflows. If a self-contained
handle is unavoidable, authenticate its contents, minimize claims, rotate
signing keys, and reject stale policy versions. A handle appearing in model
context should be treated as disclosed to untrusted text, not as a bearer
credential that grants authority by possession.

Design replay semantics explicitly. If a client retries `add_item` after a network failure, the same request may reach another instance. Use an idempotency key and persist the outcome. Stateless transport increases the importance of application-level deduplication because affinity no longer accidentally suppresses cross-instance duplicates.

## Multi-Round Trips Without Persistent Sessions

Server-initiated requests are now associated with an active client request. When input is required, the server returns an `InputRequiredResult` containing named requests and an opaque `requestState`. The client gathers answers and reissues the original call with `inputResponses`.

Test at least these transitions:

- consent accepted;
- consent denied;
- client abandons the flow;
- `requestState` expires;
- two retries race;
- a response is replayed under another user;
- server version changes between rounds.

The state token must be integrity-protected and bound to the original operation, tenant, tool, and expiry. If it contains sensitive application state, encrypt it or store only a server-side lookup handle.

Do not allow an input-required retry to bypass the original policy decision. Re-run authorization and argument validation on every round.

## Tasks Extension: Replace the Blocking Lifecycle

Tasks move out of the core into an official extension. The merged May 15 [SEP-2663](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2663) defines three methods: `tasks/get`, `tasks/update`, and `tasks/cancel`.

The server decides whether an ordinary `tools/call` becomes a task. The client advertises extension support rather than attaching a fragile per-request task flag. `tasks/result` is removed because its blocking SSE behavior conflicts with sessionless operation. `tasks/list` is removed because safe caller scoping cannot be inferred without an application identity boundary.

A production task needs:

```text
task_id, tenant_id, owner_subject, tool_name
created_at, expires_at, status, progress_version
idempotency_key, cancellation_state
input_requests, final_result_or_error
authorization_snapshot, trace_id
```

Treat `tasks/cancel` as a request, not proof that downstream work stopped. Report `cancelling` until workers and side effects confirm termination. For side-effecting jobs, define whether cancellation means stop-before-commit, compensate-after-commit, or best effort.

## MCP Apps: UI Is Executable Supply Chain

MCP Apps is an official extension for server-provided interactive interfaces. The January 26 [MCP Apps announcement](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) describes predeclared UI resources rendered in sandboxed iframes, with JSON-RPC over `postMessage`.

This improves human interaction for forms, dashboards, document review, and monitoring. It also introduces code from a remote server into the host's UI.

Require:

- immutable or integrity-addressed UI resources;
- content security policy and restrictive iframe sandbox flags;
- explicit consent for UI-initiated tool calls;
- origin and message-schema validation;
- versioned template review before execution;
- audit logs connecting UI action, model context update, and server call.

The host must not trust a UI because the same server also exposes a useful tool. Review code and tool authority separately.

## Authorization Hardening

The draft [authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) aligns more closely with deployed OAuth and OpenID Connect systems.

Clients validate the `iss` authorization-response parameter under [RFC 9207](https://www.rfc-editor.org/rfc/rfc9207). They declare OpenID Connect `application_type` during Dynamic Client Registration so a CLI or desktop app is not accidentally treated as a web client. Registered credentials are bound to the issuing authorization server and must be replaced if a resource moves.

Migration tests should include:

- two authorization servers with similar client IDs to detect mix-up;
- localhost redirect URIs for native clients;
- resource migration to a new issuer;
- step-up scopes and refresh-token issuance;
- protected-resource metadata discovery;
- token audience and resource validation at the MCP server.

Do not persist access tokens inside workflow handles or model-visible state. Keep authority in the server's trusted layer.

## JSON Schema 2020-12 Changes Validation Risk

Tool input and output schemas now use full [JSON Schema 2020-12](https://json-schema.org/draft/2020-12). Inputs retain an object root, while outputs and `structuredContent` can be any JSON value.

Composition, conditionals, `$ref`, and `$defs` make tool contracts more expressive. They also create denial-of-service and interoperability risks. The release candidate says implementations must not automatically dereference external `$ref` URIs and should bound schema depth and validation time.

Add adversarial schema tests:

- recursive local references;
- deeply nested `allOf` and `oneOf`;
- large enums and regexes;
- ambiguous unions;
- output scalars and arrays;
- unknown formats;
- validators from every supported SDK.

A schema accepted by one language's validator can fail or coerce differently in another. Conformance needs cross-SDK fixtures, not one generated type definition.

## Observability and Conformance

`Mcp-Method` and `Mcp-Name` make gateway metrics possible without body inspection. `ttlMs` and `cacheScope` make list and resource caching explicit. W3C trace context travels through `_meta`.

Propagate `traceparent`, `tracestate`, and `baggage` according to the [W3C Trace Context recommendation](https://www.w3.org/TR/trace-context/) and export through [OpenTelemetry](https://opentelemetry.io/). Do not place secrets or raw prompts in baggage.

The [MCP conformance repository](https://github.com/modelcontextprotocol/conformance) is now part of standards governance: a standards-track proposal cannot finalize without a matching scenario. The SDK tier system is scored against the same suite.

Your release gate should add application cases beyond protocol conformance:

- state handle cannot cross tenants;
- duplicate request is idempotent;
- stale `requestState` fails closed;
- task cancellation reaches the worker;
- header/body mismatch is rejected;
- old and new protocol versions produce equivalent safe outcomes;
- Apps UI cannot call undeclared tools.

## Implementation Plan and Acceptance Budget

Protocol conformance is necessary but does not define an application release
budget. A team can begin with explicit, workload-adjusted canary thresholds
such as:

- at least 10,000 requests distributed across three or more server instances;
- zero cross-tenant handle acceptances in 100,000 adversarial attempts;
- duplicate committed side effects below 0.01% of retried writes;
- p95 adapter overhead below 50 ms for ordinary calls;
- p95 input-required resume latency below 500 ms, excluding human response time;
- p99 schema-validation time below 100 ms for the admitted schema budget;
- 100% rejection of deliberately mismatched method and name headers;
- task cancellation acknowledged within 1 second and confirmed by the worker
  within 30 seconds for the tested job class;
- stale request-state rejection after the declared 15-minute expiry, with no
  fallback to an unscoped state lookup;
- terminal task records retained for 24 hours so a retry can recover the
  completed result without re-executing the tool.

These are example engineering budgets, not requirements from the MCP
specification. Replace them with limits derived from the application's harm
model and latency objective, and pre-register them before the canary.

Run both protocol versions in canary. Negotiate or route by `MCP-Protocol-Version`, and preserve a stable `2025-11-25` path until the new path survives production-shaped tests.

Start the canary with read-only or compensatable tools. Expanding directly to
payments, destructive file operations, or privileged administration would make
state-binding and retry defects expensive before the adapter has production
evidence.

Measure:

- percentage of calls requiring explicit state handles;
- cross-instance retry success;
- duplicate-side-effect rate;
- p50/p95 latency for input-required flows;
- task cancellation completion time;
- authorization discovery and registration failures;
- schema-validation errors by SDK;
- cache hit rate for `tools/list` under `ttlMs`.

Roll back the new version when state leakage, duplicate commits, authorization issuer mismatch, unbounded schema validation, or task cancellation failure appears. A latency regression alone may justify rollback if it breaches the user deadline, but correctness failures are immediate blockers.

Keep the migration reversible at the adapter boundary. Do not fork business logic into separate old/new implementations.

## Failure Modes

The first failure is assuming stateless means no state. Hidden workflow state then disappears or becomes globally shared. Make handles explicit and scoped.

The second is using the model as the state authority. A model can copy, omit, or hallucinate a handle. The server validates it every time.

The third is treating cancellation as synchronous. Long-running workers and external APIs may already have committed side effects.

The fourth is accepting any JSON Schema because the new dialect is richer. Bound resources and reject external references.

The fifth is migrating Tasks but retaining `tasks/list`. The extension removed it because safe scoping is not generally available.

The sixth is rendering MCP Apps with broad iframe privileges. UI resources are code and require supply-chain controls.

## Adoption Boundary: When to Wait

Wait if your critical SDK has no release-candidate support or cannot pass the conformance suite. Hand-implementing a large breaking protocol revision days before finalization may create a private dialect.

Wait if application state is undocumented. Inventory what the session store contains before removing it.

Wait before enabling MCP Apps for untrusted servers if the host lacks sandboxing, CSP, origin validation, and user consent.

Do not migrate authorization by copying tokens into request metadata. Complete issuer and resource validation first.

Local stdio-only servers that do not use sessions, Tasks, Apps, or OAuth may have little immediate work. They should still pin supported protocol versions and test error-code and schema changes.

## Source Ledger and Dates

- May 21, 2026 — [MCP 2026-07-28 release candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/): locked RC, breaking changes, July 28 final date.
- Current July 2026 — [draft specification](https://modelcontextprotocol.io/specification/draft): normative core under validation.
- Current July 2026 — [authorization draft](https://modelcontextprotocol.io/specification/draft/basic/authorization): OAuth and OIDC requirements.
- May 15, 2026 — [Tasks extension SEP-2663](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2663): merged lifecycle redesign and conformance link.
- January 26, 2026 — [MCP Apps launch](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/): extension architecture and security model.
- Current — [MCP conformance suite](https://github.com/modelcontextprotocol/conformance): protocol scenarios used for SDK tiering.
- Current — [JSON Schema 2020-12](https://json-schema.org/draft/2020-12): schema dialect adopted by tool contracts.
- October 2022 — [RFC 9207](https://www.rfc-editor.org/rfc/rfc9207): authorization response issuer identification.
- November 2021 — [W3C Trace Context](https://www.w3.org/TR/trace-context/): interoperable distributed trace propagation.
- Current — [OpenTelemetry](https://opentelemetry.io/): trace export and observability ecosystem.

The RC is older than the usual 30-day news window because it is the locked specification that becomes final on July 28. Its age is the validation period, not stale evidence.

## Bottom Line

MCP `2026-07-28` simplifies the transport layer by removing sessions, but it forces applications to make state, authority, retries, and long-running work explicit.

Dual-stack now. Migrate state into scoped handles, replace the old Tasks lifecycle, harden OAuth issuer binding, bound JSON Schema validation, and run both protocol and application conformance. Cut over only when any server instance can safely handle any request without losing context or widening authority.
