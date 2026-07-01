---
title: Measure MCP Token Audience Gates for Agent Tools
description: Build a runnable gate harness that catches wrong-audience tokens, issuer drift, prompt-selected resources, and passthrough reuse.
topic: Agent Security
level: Advanced
date: 2026-07-01
readingTime: 32
tags: agent-security, mcp, oauth, authorization, evals, guardrails
image: /content/v1/assets/measure-mcp-token-audience-gates.svg
imageAlt: Bar chart comparing MCP token audience gate policies by accuracy, mean score, and false negatives
evidenceMode: experiment
---

Agent tool access should fail closed when token boundaries are ambiguous. In MCP-style systems, the dangerous case is not only a missing scope. It is a token that was issued for one resource but accepted by another, a token that came from the wrong authorization server, a prompt-injected resource target, or an MCP server that forwards the inbound token to a downstream API.

This tutorial builds a compact release harness for those cases. The harness evaluates fourteen MCP token/request scenarios against three policies: scope-only, audience-only, and resource-bound. The dataset is small enough to inspect line by line, but it covers the failure modes that matter for production agent tools: wrong audience, wrong issuer, query-string token transport, metadata discovery mismatch, prompt-selected resource, downstream passthrough, broad legacy tokens, and refresh-token misuse.

The measured result is decisive for this dataset. Scope-only review catches a missing scope but leaves seven expected block cases as false negatives. Audience-only validation improves the boundary but still misses six expected block cases because it does not check issuer, transport, metadata discovery, prompt-selected resources, or passthrough. The resource-bound policy matches every expected label in the fourteen-case suite.

## Research Question

The question is: does a resource-bound authorization policy reduce false negatives compared with policies that check only scopes or only token audience?

The negative control is scope-only. It verifies that the token grants the requested permission. This is a common baseline because scopes are easy to understand and easy to log. It fails when a token has the right scope but belongs to a different MCP server or authorization server.

The intermediate baseline is audience-only. It verifies required scopes and checks that the token audience contains the requested resource. That catches cross-resource token reuse. It still misses several release-blocking cases because an agent tool boundary also needs issuer validation, transport validation, metadata discovery consistency, token-type checks, and downstream token separation.

The tested policy is resource-bound. It blocks any high-risk request with a missing scope, wrong audience, wrong issuer, unsafe token transport, refresh-token presentation, metadata discovery mismatch, prompt-injected resource, or inbound token passthrough.

## Dataset Design

The dataset has fourteen inspectable request scenarios. Each case contains the resource being called, token audiences, issuer, expected issuer, scopes, token transport, protected resource metadata result, downstream passthrough status, prompt-requested resource, risk level, and expected disposition.

```json
{
  "id": "support-token-reused-at-crm",
  "resource": "https://mcp.crm.example.com",
  "tokenAudience": ["https://mcp.support.example.com"],
  "issuer": "https://auth.support.example.com",
  "expectedIssuer": "https://auth.crm.example.com",
  "scopes": ["customers.write"],
  "requiredScopes": ["customers.write"],
  "transport": "authorization-header",
  "protectedResourceMetadataMatched": true,
  "passthroughAttempt": false,
  "risk": "high",
  "expectedDisposition": "block"
}
```

The labels are release decisions, not abstract severity scores. `allow` means the request has a complete, narrow authorization shape. `review` means the request may be acceptable with a documented migration or owner approval. `block` means the request violates an invariant that should stop production side effects.

The dataset includes only one clear allow case on purpose. Real release suites should over-sample risky cases because the metric that matters most is false negatives on expected block cases. A policy that looks accurate on mostly safe traffic can still be unsafe if it misses the few cases that should stop a connector rollout.

## Policy Implementations

The three policies are intentionally short. They are designed to be understandable during release review.

```javascript
const policies = {
  scopeOnly(event) {
    if (!hasRequiredScopes(event)) return "block";
    if (event.risk !== "low") return "review";
    return "allow";
  },
  audienceOnly(event) {
    if (!hasRequiredScopes(event)) return "block";
    if (!audienceMatchesResource(event)) return "block";
    if (event.tokenAudience.length > 1 || event.risk === "medium") return "review";
    return "allow";
  },
  resourceBound(event) {
    if (!hasRequiredScopes(event)) return "block";
    if (!audienceMatchesResource(event)) return event.risk === "high" ? "block" : "review";
    if (event.issuer !== event.expectedIssuer) return "block";
    if (event.transport !== "authorization-header") return "block";
    if (event.tokenType === "refresh") return "block";
    if (!event.protectedResourceMetadataMatched) return "block";
    if (event.passthroughAttempt || event.downstreamResource) return "block";
    if (event.promptRequestedResource && canonicalize(event.promptRequestedResource) !== canonicalize(event.resource)) {
      return "block";
    }
    if (event.tokenAudience.length > 1 || event.risk === "medium") return "review";
    return "allow";
  },
};
```

The key design choice is that resource-bound validation treats authorization as a bundle of invariants. A token with the right scope is still unsafe if the audience is wrong. A token with the right audience is still unsafe if the issuer is wrong. A token with the right issuer is still unsafe if it is placed in a URL or forwarded to a downstream API.

## Canonicalization And Scope Helpers

The harness uses a small canonicalization helper so trailing slashes and host case do not create accidental failures. Production code should use the platform's URL parser and a documented canonical URI policy.

```javascript
function canonicalize(value) {
  try {
    const url = new URL(value);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname === "/") url.pathname = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function hasRequiredScopes(event) {
  return event.requiredScopes.every((scope) => event.scopes.includes(scope));
}

function audienceMatchesResource(event) {
  const resource = canonicalize(event.resource);
  return event.tokenAudience.map(canonicalize).includes(resource);
}
```

The `stale-resource-canonicalization` case is labeled review, not block, because a trailing slash mismatch may be a migration issue rather than an attack. That is deliberate. Release gates should distinguish hard failures from migration cases that need owners, deadlines, and monitoring.

## Scoring Metrics

The scoring function rewards exact matches and gives partial credit to safer mistakes. Reviewing a block-worthy case is weaker than blocking it, but it is safer than allowing it. Blocking a review case is conservative but may create operational friction.

```javascript
function dispositionScore(actual, expected) {
  if (actual === expected) return 1;
  if (actual === "review" && expected === "block") return 0.5;
  if (actual === "block" && expected === "review") return 0.75;
  if (actual === "review" && expected === "allow") return 0.5;
  return 0;
}

function falseNegative(actual, expected) {
  return expected === "block" && actual !== "block";
}
```

Accuracy is useful, but false negatives are the release-stopping metric. A false positive can be reviewed and tuned. A false negative can let a wrong-audience token or passthrough path reach production.

## Results

The runnable harness produced this output:

```output
MCP token audience gate experiment
cases=14
scopeOnly: accuracy=0.5 mean_score=0.75 blocked=1 reviewed=12 allowed=1 false_negatives=7 false_positives=0
audienceOnly: accuracy=0.571 mean_score=0.571 blocked=2 reviewed=5 allowed=7 false_negatives=6 false_positives=0
resourceBound: accuracy=1 mean_score=1 blocked=8 reviewed=5 allowed=1 false_negatives=0 false_positives=0
```

Scope-only fails the release gate. It blocks the missing-scope case and reviews most non-low-risk cases, but review is not enough for wrong-audience, wrong-issuer, token-in-URL, prompt-selected-resource, passthrough, metadata-mismatch, and refresh-token misuse. Those are expected block cases because they violate the authorization boundary before the tool action is safe to execute.

Audience-only catches cross-resource token reuse, but it still allows several requests that should block. In this dataset, audience-only misses query-string token transport, downstream passthrough, metadata discovery mismatch, prompt-injected resource selection, wrong issuer, and refresh-token presentation. It has lower mean score than scope-only because it confidently allows some cases that scope-only at least routes to review.

Resource-bound validation matches every expected disposition. It blocks eight hard failures, reviews five migration or moderate-risk cases, and allows only the exact-resource read case. The result does not prove the policy is complete, but it shows that the release gate has to check more than scopes and audience.

## Error Analysis

The scope-only policy misses block cases because it does not know where a token was issued for use. `support-token-reused-at-crm` has the right write scope, but it is not a CRM token. `write-token-from-wrong-issuer` has the right audience and scope, but it came from a sandbox issuer rather than the authorization server expected for the repository resource.

The audience-only policy misses cases where the token is technically for the resource but the execution path is still unsafe. `downstream-passthrough-to-sheets` presents a valid docs MCP token to the docs MCP server, then tries to reuse it at a spreadsheet API. `prompt-injected-resource` uses a valid payments token but allows untrusted content to request a different resource target. `query-string-token` uses the right audience but the wrong transport.

Resource-bound validation succeeds because it treats those as separate invariants. Audience, issuer, transport, metadata discovery, token type, prompt-selected resource, and downstream token boundary are all independently checked before the tool call can proceed.

## Production Readiness

To turn this harness into a production release check, replace the synthetic cases with captured connector traces and red-team cases. Keep raw tokens out of logs, but preserve claim shape, issuer, audience, token type, validation result, required scopes, granted scopes, transport, resource selection source, downstream target, and final disposition.

Run the suite for every side-effecting MCP connector before rollout. The release threshold should be strict: zero false negatives on expected block cases, complete trace coverage for token validation fields, and an owner plus expiration date for every review case.

Add the gate at two layers. The MCP gateway should validate tokens before tool code executes. The release harness should replay labeled cases in CI whenever connector configuration, authorization server metadata, scopes, prompt routing, or downstream API access changes. If the runtime supports tool guardrails or trace processors, record the same disposition there so production incidents can be explained from traces.

## Reproducibility

The project uses a deterministic JavaScript script and a static JSON dataset. It does not call a local model service, and it does not use torch, CUDA, CPU ML execution, or MPS. The script writes `results.json`, `output.txt`, and `chart.svg` from the same dataset.

Run it with:

```sh
node run-experiment.mjs
```

If your shell does not have `node` on `PATH`, use the Node runtime bundled with your development environment. The expected output should match the results block above unless you change the dataset, policy rules, scoring function, or canonicalization behavior.

For production evidence, store the dataset, results, and chart with each connector release review. When a connector starts using a new authorization server, adds a new downstream API, changes token transport, or accepts a new resource URI, rerun the suite before increasing traffic.

## Guardrails And Rollback Criteria

Block before execution when a high-risk tool call has a missing required scope, wrong audience, wrong issuer, unsafe token transport, refresh token presentation, metadata discovery mismatch, prompt-injected resource target, or inbound token passthrough. Route broad legacy tokens and stale canonicalization cases to review with an owner, expiration date, and migration plan.

Roll back a connector when a production trace shows token passthrough, when a token issued for one MCP server is accepted by another, when protected resource metadata disagrees with the issuer used by the client, or when trace coverage drops below the fields needed to reproduce the decision.

Also roll back when review volume becomes unmanageable. High review volume is a signal that the platform is issuing broad tokens, accepting ambiguous resource URIs, or allowing too many connector-specific exceptions. The fix is narrower resource binding, not reviewer fatigue.

## Implementation Plan

Start with the side-effecting tools: email send, ticket update, repository comment, customer record write, payment action, deployment action, and shared-memory write. For each tool, add a labeled case for exact-resource success and at least one case for wrong audience, wrong issuer, unsafe transport, prompt-selected target, and downstream passthrough.

Next, require the resource-bound gate in connector CI. The policy should run without network access by replaying captured claims and metadata decisions. That keeps the release check fast and reproducible while still testing the invariants that matter.

Then connect CI failures to rollout policy. A connector with any false negative on expected block cases should not receive production write authority. A connector with review cases can ship only when the owner records why the exception exists, what metric watches it, and when it expires.

Finally, keep the suite current. Agent workflows change when models, prompts, tools, and provider SDKs change. Authorization tests should be rerun for those changes because the risk is a workflow property, not a one-time token validation function.

## Limitations

This is a small release harness, not a formal OAuth conformance suite. It does not parse real JWTs, validate signatures, test dynamic client registration, simulate every protected resource metadata edge case, or prove that a downstream API cannot be abused through a separate credential.

The labels are also policy choices. Some teams may block all multi-audience tokens. Others may review them during a migration. What should not vary is the false-negative rule: a token boundary violation on a high-risk side effect should stop the release.

The final limitation is observability. If the MCP server, gateway, or agent runtime cannot expose issuer, audience, resource URI, transport, token type, downstream target, and validation result, this harness cannot score the real production path. Treat missing authorization trace fields as a product defect for side-effecting tools.

## What To Watch Next

MCP adoption makes connector authorization a shared platform concern. Teams should expect more dynamic discovery, more remote servers, more agent-selected tools, and more pressure to reuse credentials across systems. The release gate should make that pressure visible.

The next step is to add real connector traces to the dataset. Keep the policy deterministic, keep the false-negative threshold strict, and require every side-effecting tool to prove that the token it accepts was issued for the resource it serves.
