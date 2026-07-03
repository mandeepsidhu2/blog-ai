---
title: Measure Agent App Manifest Risk Gates
description: Build a reproducible harness that scores MCP app and agent-card manifests by consent clarity, write-action safety, token binding, and trace risk.
topic: Agent Security
level: Advanced
date: 2026-07-03
readingTime: 34
tags: agent-security, mcp, app-security, evals, authorization, guardrails
image: /content/v1/assets/measure-agent-app-manifest-risk-gates.svg
imageAlt: Bar chart comparing agent app manifest gate policies by accuracy, false negatives, and blocked cases
evidenceMode: experiment
---

Agent app reviews need a testable release gate. A reviewer can read a manifest and still miss the dangerous cases: a write action without confirmation, a token accepted by the wrong resource, a third-party proxy for sensitive payments, a UI component with broad network access, raw prompt text in regulated-data logs, or an unsigned agent card that asks another agent to trust its capabilities.

This tutorial builds a deterministic manifest-risk harness for those cases. The harness evaluates fourteen app, MCP server, and A2A-style agent-card records against three policies: metadata-only, consent-only, and boundary-gate. Each record includes provider identity, data class, write action, scopes, consent copy, confirmation behavior, token binding, per-client consent, CSP-style network and frame policy, logging behavior, agent-card controls, and prompt-injection test coverage.

The measured result is direct. Metadata-only review misses all seven expected block cases. Consent-only review catches the missing-confirmation case, but still misses six expected block cases. The boundary gate matches every expected label, blocking seven hard failures, routing three migration cases to review, and allowing four narrow integrations.

## Research Question

The research question is: do boundary checks reduce false negatives compared with reviews that look only at manifest metadata or only at consent and confirmation fields?

The metadata-only baseline checks whether the provider, surface, and scopes are declared. It represents a shallow app-store review: the manifest is syntactically present, and risky write or destructive actions are routed to review instead of being blocked.

The consent-only baseline checks user-facing consent and confirmation. It blocks a write action when confirmation is missing, reviews vague consent, reviews broad admin scopes, and reviews third-party write proxies. This is better than metadata-only review, but it still does not check token binding, logging, network containment, or signed agent-card behavior.

The boundary gate checks the release invariants that should hold before agent apps touch production data: official provider or trusted hosting for sensitive writes, confirmation for write actions, token audience binding, per-client consent for proxy flows, no raw token logs, no raw prompt logs for regulated data, constrained network and frame domains, signed agent cards, authenticated extended-card access, public-card minimization, and enough prompt-injection tests for side-effecting tools.

## Dataset Design

The dataset has fourteen records. Each record is intentionally inspectable, so a release reviewer can debate the label rather than trust an opaque model.

```json
{
  "id": "payments-refund-official",
  "surface": "chatgpt-app",
  "provider": "payments",
  "officialServer": true,
  "userData": "regulated",
  "writeAction": true,
  "destructiveAction": false,
  "scopes": ["refunds.write", "customers.read"],
  "consentCopy": "Refund customer payments and read customer profile fields.",
  "confirmationRequired": true,
  "tokenAudienceBound": true,
  "perClientConsent": true,
  "networkAllowlist": ["https://api.payments.example.com"],
  "frameDomains": [],
  "logsRawPrompt": false,
  "logsTokens": false,
  "signedAgentCard": true,
  "extendedCardRequiresAuth": true,
  "promptInjectionTests": 8,
  "publicCardMinimized": true,
  "expected": "allow"
}
```

The labels are release dispositions. `allow` means the manifest is narrow enough to ship. `review` means the integration may ship only with an owner, expiration date, and migration plan. `block` means a release invariant is missing and the app should not receive production traffic.

The dataset covers safe read-only cases, safe confirmed write cases, broad-scope review cases, open network review cases, low prompt-injection test coverage, missing confirmation, unsigned agent cards, unofficial sensitive write proxies, raw prompt logging for regulated data, token passthrough, public extended cards, and token logging.

## Policy Implementations

The three policies are deliberately short.

```javascript
const policies = {
  metadataOnly(record) {
    if (!record.provider || !record.surface || record.scopes.length === 0) return "block";
    if (!record.officialServer && record.writeAction) return "review";
    if (record.destructiveAction) return "review";
    return "allow";
  },
  consentOnly(record) {
    if (record.writeAction && !record.confirmationRequired) return "block";
    if (record.writeAction && vagueConsent(record.consentCopy)) return "review";
    if (record.scopes.some((scope) => scope.includes("admin") || scope.endsWith(".all"))) return "review";
    if (!record.officialServer && record.writeAction) return "review";
    return "allow";
  },
  boundaryGate(record) {
    if (!record.officialServer && record.writeAction) return "block";
    if (record.writeAction && !record.confirmationRequired) return "block";
    if (!record.tokenAudienceBound) return "block";
    if (!record.perClientConsent) return "block";
    if (record.logsTokens) return "block";
    if (record.logsRawPrompt && record.userData === "regulated") return "block";
    if (record.surface === "a2a-agent" && !record.signedAgentCard) return "block";
    if (record.surface === "a2a-agent" && !record.extendedCardRequiresAuth) return "block";
    if (!record.publicCardMinimized && record.surface === "a2a-agent") return "block";
    if (record.networkAllowlist.includes("*") || record.frameDomains.includes("*")) return "review";
    if (record.scopes.some((scope) => scope.includes("admin") || scope.endsWith(".all"))) return "review";
    if (record.writeAction && record.promptInjectionTests < 4) return "review";
    if (record.writeAction && vagueConsent(record.consentCopy)) return "review";
    return "allow";
  },
};
```

The boundary gate is stricter because the app boundary is wider than the consent screen. A user-facing confirmation cannot compensate for token logging. A provider string cannot compensate for an unsigned agent card. A narrow scope cannot compensate for a token that is accepted by the wrong resource. Those are independent release checks.

## Scoring Metrics

The harness scores exact labels and safer mistakes. Reviewing a block-worthy case is not as good as blocking it, but it is safer than allowing it. Blocking a review case is conservative but may create avoidable launch friction.

```javascript
function score(actual, expected) {
  if (actual === expected) return 1;
  if (actual === "review" && expected === "block") return 0.5;
  if (actual === "block" && expected === "review") return 0.75;
  if (actual === "review" && expected === "allow") return 0.5;
  return 0;
}

function summarize(policyName, fn) {
  const decisions = dataset.map((record) => {
    const actual = fn(record);
    return {
      id: record.id,
      expected: record.expected,
      actual,
      score: score(actual, record.expected),
      falseNegative: record.expected === "block" && actual !== "block",
      falsePositive: record.expected === "allow" && actual === "block"
    };
  });
  return aggregate(policyName, decisions);
}
```

Accuracy is useful, but the release-stopping metric is false negatives on expected block cases. A false positive slows a launch. A false negative can let an unsafe app write data, leak tokens, or route authority through the wrong agent.

## Results

The run produced this output:

```output
Agent app manifest risk gate experiment
cases=14
metadataOnly: accuracy=0.286 mean_score=0.357 blocked=0 reviewed=2 allowed=12 false_negatives=7 false_positives=0
consentOnly: accuracy=0.429 mean_score=0.5 blocked=1 reviewed=3 allowed=10 false_negatives=6 false_positives=0
boundaryGate: accuracy=1 mean_score=1 blocked=7 reviewed=3 allowed=4 false_negatives=0 false_positives=0
```

Metadata-only review fails because it treats declaration as evidence. It routes an unofficial write proxy and a destructive action to review, but it allows token passthrough, token logging, raw prompt logging for regulated data, unsigned agent cards, public extended cards, open network access, and low prompt-injection test coverage. It never blocks a case in this dataset, which is not credible for a release gate that covers write-capable integrations.

Consent-only review improves the baseline by blocking `ticket-close-no-confirmation`. That is important because missing confirmation on destructive actions should stop release. But consent-only review still misses token audience failures, raw prompt logs, token logs, unsigned cards, public extended-card access, and the sensitive third-party proxy case. Consent text is necessary, not sufficient.

The boundary gate matches every expected disposition. It blocks seven hard failures, reviews three migration or coverage cases, and allows four narrow integrations. The result does not prove the gate is complete, but it shows why a manifest review should include runtime boundaries rather than only provider metadata and consent copy.

## Error Analysis

The metadata-only baseline is weak against anything that looks normal in a manifest. `mail-send-token-passthrough` declares a provider, surface, and scope, so metadata-only review allows it even though token audience binding is missing. `notes-sync-token-logs` looks like a normal notes write integration, but it logs tokens. A schema that checks only field presence cannot catch those failures.

Consent-only review catches the obvious user-confirmation failure but overestimates the value of confirmation. `third-party-proxy-payments` has confirmation, specific consent, and a write scope, yet it is still a release blocker because a sensitive payment write path is hosted by an unofficial proxy. `repo-agent-unsigned-card` has confirmation and narrow pull-request scope, yet an inter-agent write path should not trust an unsigned capability declaration.

The boundary gate succeeds because it treats authority as a bundle of invariants. User consent, confirmation, token binding, per-client consent, CSP containment, logging hygiene, signed cards, authenticated extended cards, provider identity, and test coverage are all checked separately. That is the right shape for agent apps because the failure modes are independent.

## Production Readiness

To use this harness in production, replace the static examples with real manifests and release records. Pull fields from app manifests, MCP server registration, A2A agent cards, OAuth configuration, CSP metadata, logging configuration, and security review results. Keep the output deterministic so release reviewers can reproduce every decision.

Run the gate in two places. First, run it in CI whenever a manifest, tool schema, scope request, network allowlist, frame domain, agent card, or logging policy changes. Second, run it against production telemetry after launch. The manifest can say one thing while runtime traffic does another.

Set thresholds by side effect. For read-only apps, require zero token logging, redacted prompt handling for sensitive data, narrow scopes, and constrained network destinations. For write-capable apps, require zero false negatives on expected block cases, confirmation for irreversible operations, token audience binding, per-client consent for proxy flows, server-side input validation, and enough prompt-injection tests to cover malicious content entering tool arguments.

Review dispositions need workflow. A review label should create an owner, expiration date, and migration plan. Broad admin scopes might be acceptable for a short migration, but not as an indefinite production default. Open frame domains might be acceptable for a prototype, but not for a release that handles customer or regulated data.

## Reproducibility

The harness uses a static JSON dataset and a Node script. It does not call external APIs, depend on cloud credentials, or use ML inference. The script writes `results.json`, `output.txt`, and an SVG chart from the same dataset.

Run it with:

```sh
node projects/agent-app-manifest-risk-gates/run-experiment.mjs
```

The expected output is the results block above. If the output changes, inspect the dataset labels, policy thresholds, scoring function, or aggregation logic before using the result in a release review.

For a stronger internal evaluation, add real app records from the last quarter of connector reviews. Keep sensitive values out of the dataset, but preserve the security shape: data class, scopes, side effects, provider hosting, token binding, confirmation behavior, CSP policy, logging policy, card-signature status, prompt-injection test count, and final release decision.

## Guardrails And Rollback Criteria

Block release when a write action lacks confirmation, when a token is logged, when raw prompts are logged for regulated data, when token audience binding is missing, when per-client consent is absent for proxy flows, when sensitive write authority goes through an unofficial proxy, when an inter-agent write path trusts unsigned cards, or when extended agent-card details are public without authentication.

Roll back an already released app when runtime traces violate the manifest. Examples include network calls outside the allowlist, frame domains not declared in the reviewed metadata, write calls that do not include a confirmation trace, token validation failures followed by successful tool execution, or logs that contain tokens or raw sensitive prompts.

Also roll back when trace coverage disappears. If the platform cannot prove provider identity, scopes, side-effect type, confirmation state, token validation result, network destination, logging behavior, and final disposition, it cannot prove the release boundary. Missing traces should pause expansion for write-capable integrations.

## Implementation Plan

Start by defining the release record. A record should include manifest metadata, consent copy, tool side effects, OAuth resource and scope details, CSP/network policy, logging policy, card signature status, extended-card access policy, prompt-injection test count, and expected disposition.

Next, implement at least two baselines and one candidate policy. Baselines are useful because they prevent the team from declaring success without comparison. If the candidate policy does not reduce false negatives compared with simpler baselines, it is not ready.

Then wire the gate to release review. A pull request that changes a write tool, scope, provider host, card declaration, or logging policy should produce a gate summary. Humans should review the consent copy and provider trust calls, while CI checks structured invariants.

Finally, keep the dataset current. Every incident, near miss, review exception, or prompt-injection finding should become a new labeled case. Agent app security will change as hosts, protocols, and model behavior change; the release harness should learn from that evidence.

## Limitations

This is a small release harness, not a complete formal verification system. It does not parse real OAuth tokens, verify real signatures, crawl live CSP headers, inspect implementation code, or prove that a downstream service cannot be abused through another credential.

The labels are policy choices. Some teams may review rather than block unofficial read-only proxies. Some may block all broad scopes. What should not vary is the false-negative threshold for high-risk writes: missing confirmation, token leakage, token boundary failure, and unauthenticated agent capability expansion should stop the release.

The main value is review discipline. A manifest gate forces the team to state what authority an app has, how consent is presented, how runtime controls enforce it, and what evidence would trigger rollback. That is a stronger operating model than approving an app because the demo looked useful.
