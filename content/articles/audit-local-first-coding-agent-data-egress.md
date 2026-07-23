---
title: Audit Local-First Coding Agents at the Network Boundary
description: Turn the July 2026 Grok Build repository-upload incident and open-source release into a measurable procurement test for coding-agent data egress.
topic: Coding Agent Security
level: Advanced
date: 2026-07-21
readingTime: 21
tags: coding-agents, data-egress, source-code-security, privacy, open-source-audit
image: /content/v1/assets/coding-agent-egress-audit-matrix.svg
imageAlt: Evidence matrix separating coding-agent local execution, outbound payload, retention, source transparency, and independently verified controls
evidenceMode: strategy
qualityTier: timely-analysis
---

“Local-first” does not mean “local-only.” A coding agent can execute tools on the workstation while sending prompts, selected files, traces, repository bundles, or telemetry to remote services. Source availability can reveal those paths, but it does not prove that a downloaded binary matches the repository, that a server-side flag remains fixed, or that retained data was deleted.

The July 2026 Grok Build episode makes those distinctions concrete. Independent testing reported that an early CLI uploaded 5.1 GB for a task needing 192 KB—roughly 26,000 times the necessary payload—and included repository history. SpaceXAI said zero-data-retention organizations were protected, disabled default retention for all users on July 12, committed to delete previously retained coding data, and open-sourced the harness on July 15. The published code is now inspectable and can run against local inference.

Those remediations matter. They do not collapse four separate questions into one: what bytes leave the workstation, what the remote service retains, whether the executing artifact corresponds to reviewed source, and whether the agent possesses authority to read the material at all. Procurement should require evidence for each layer.

## Finding and decision summary

- SpaceXAI introduced Grok Build in May 2026 and open-sourced its agent loop, tools, TUI, and extension system on July 15, 2026.
- The independent incident report focused on Grok Build CLI v0.2.93; do not generalize its wire behavior to every historical or current version without testing.
- One reported reproduction transferred 5.1 GB when the task needed 192 KB, a roughly 26,000× payload ratio.
- The disputed boundary was broader than prompt inference: full Git history can contain deleted secrets and files absent from the working tree.
- SpaceXAI's enterprise documentation describes six data-lifecycle phases, TLS 1.2/1.3 transport, local tool execution, local session history, and no inference-layer persistence for ZDR organizations.
- SpaceXAI said default retention was disabled for all Grok Build users starting July 12 and previously retained coding data would be deleted.
- Open source improves auditability, but server policy, hosted inference, binary provenance, and deletion evidence remain separate trust surfaces.
- Pilot any coding agent in a decoy repository behind recorded egress controls. Approve exact version, artifact hash, destinations, payload classes, retention tier, and credential boundary—not a marketing adjective.

## What happened and what remains unknown

SpaceXAI's [July 15 announcement](https://x.ai/news/grok-build-open-source) says the published repository includes context assembly, tool dispatch, file and shell tools, terminal UI, skills, plugins, hooks, MCP servers, and subagents. It also states that the harness can run local-first with local inference configured in `config.toml`. That is a meaningful source-transparency and deployment option.

The [independent disclosure](https://schulz.dk/2026/07/13/your-repository-has-left-the-building-why-you-should-never-trust-grok-build/) identifies v0.2.93 and distinguishes confirmed transfer behavior from unsupported claims about model training. [Axios reported](https://www.axios.com/newsletters/axios-future-of-cybersecurity-9168e100-7af2-11f1-bc32-bbfb768a7518) the 5.1 GB versus 192 KB test, the apparent server-side stop without a client update, and unresolved questions about affected users, versions, storage duration, access, and deletion verification. The [OECD AI incident record](https://oecd.ai/en/incidents/2026-07-13-acb3) records the event as a data and property-harm incident signal, not a forensic report.

SpaceXAI's response, reproduced in public reporting and its communications, says ZDR was respected, retention was on by default for non-ZDR early-beta users, default retention changed on July 12, and prior retained coding data would be deleted. The exact affected population and independently verifiable deletion evidence were not public in the sources reviewed on July 21.

Treat that uncertainty explicitly. “No evidence of access” is not “evidence of no access.” Conversely, evidence of over-broad transfer does not establish that data trained a model. An engineering response should preserve both limits.

## Comparison: claims by control plane

The table is sourced from the [July 13 independent analysis](https://schulz.dk/2026/07/13/your-repository-has-left-the-building-why-you-should-never-trust-grok-build/), [July 14 reporting](https://www.axios.com/newsletters/axios-future-of-cybersecurity-9168e100-7af2-11f1-bc32-bbfb768a7518), [SpaceXAI lifecycle documentation](https://docs.x.ai/build/enterprise), and the [published source](https://github.com/xai-org/grok-build). Rows are not interchangeable: transport, retention, source provenance, and authorization answer different questions.

| Control plane | Public signal as of July 21 | Verification test | Comparability limit |
|---|---|---|---|
| Local tool execution | Enterprise docs say tool execution occurs locally | Trace process/file/network activity during a fixed decoy task | Local execution does not imply local context or telemetry |
| Outbound payload | v0.2.93 reproduction reported 5.1 GB for a 192 KB task | Capture destination, bytes, request class, and archive members | One version/account test does not characterize all tiers |
| Retention | ZDR skips inference logging; default retention said disabled July 12 | Contract review, admin-state export, deletion exercise, provider evidence | Retention controls do not prevent transmission |
| Transport | Docs specify TLS 1.2/1.3 to inference proxy | Verify destinations, certificate chain, proxy policy, and plaintext before encryption | Encryption protects transit, not payload minimization |
| Source transparency | Harness open-sourced July 15 under an inspectable repository | Build from pinned commit; produce SBOM, hash, and behavior diff | Source does not attest downloaded binary or server code |
| Upload path status | Public source retains upload-related code while reporting paths disabled | Test current binary/account with server flags captured | Disabled today does not prove removal or future immutability |
| Git history exposure | Incident reports include full repository history | Seed tracked, deleted, ignored, and untracked canary secrets | Working-tree scans alone miss committed history |
| Local session data | Docs say history is stored locally in `~/.grok/` | Inspect permissions, encryption, backup, and cleanup | Local persistence can still leak through endpoint backup or logs |

This comparison explains why a privacy toggle is not a sufficient acceptance test. A server can retain nothing and still receive an unnecessarily broad secret-bearing payload. A client can transmit only necessary context and still retain it too long. Both can behave correctly while a compromised extension reads outside the intended repository.

## Engineering decision: require a wire-level acceptance test

Create a disposable repository containing four classes of canary data: a tracked harmless token, a token committed and then deleted, an ignored `.env` token, and a file outside the repository root. None should be a real credential. Give the agent a task whose necessary context is one small file with a measured byte count.

Run the exact distributable in a disposable account and machine profile. Record binary hash, source commit if claimed, version, account tier, privacy/ZDR state, config, server-returned feature flags, DNS destinations, connections, total bytes, request payload classes, file reads, subprocesses, and local state writes. Decrypt traffic only in a lawful controlled environment with test credentials and a configured inspection proxy; otherwise use endpoint instrumentation and byte/destination telemetry.

Run two artifacts when a source build is offered: the vendor-distributed binary and a locally built binary from the pinned public commit. A clean local build cannot exonerate a different download; a dirty vendor capture does not prove the public source has the same path. Compare file reads, destinations, bytes, and server responses rather than relying only on binary similarity.

Predeclare gates. A high-assurance pilot could require zero reads outside the allowed root, zero appearance of all four canaries in unauthorized request classes, outbound destinations restricted to an allowlist, payload bytes within a task-specific multiplier, zero transmission before explicit consent, verifiable retention tier, reproducible source build, and a clean uninstall/state-removal test. The multiplier must reflect protocol framing and model context; 1× is not realistic, but 26,000× is an obvious investigation trigger.

Repeat tests across at least three task types: read-only explanation, targeted edit, and repository-wide refactor. Include canceled tasks, denied permissions, offline mode, expired authentication, malformed server flags, extension loading, MCP access, and subagent invocation. A single happy-path capture cannot establish the boundary.

Replay after a controlled server-policy change if the vendor exposes one. The July report that behavior appeared to stop without a client update makes server state part of the tested version. Archive the effective flag response with every capture and fail closed when it is absent, malformed, or less restrictive than the approved value.

## Source availability changes the audit, not the result

The [Grok Build repository](https://github.com/xai-org/grok-build) allows teams to trace context assembly and tool dispatch and to build a local artifact. Public analysis of the source notes that upload-related modules remain visible while at least one session-state function returns an unavailable error in [Simon Willison's July 15 review](https://simonwillison.net/2026/Jul/15/grok-build/). Retaining disabled code is not proof of active transfer; it is a reason to bind acceptance to behavior and version.

Generate a software bill of materials, run dependency and license scans, inspect install/update code, and compare a reproducible local build with the vendor binary where possible. Record compiler, lockfile, features, commit, and hash. If byte-for-byte reproduction is unavailable, compare network/file behavior and require signed provenance from the vendor.

External contributions and open licensing do not guarantee independent maintenance or timely security response. Evaluate release signing, vulnerability reporting, branch protection, dependency automation, and maintainer policy. [OpenSSF Scorecard](https://scorecard.dev/) can surface repository practices, but a score is a triage signal rather than a behavioral privacy test.

## Retention is not minimization

SpaceXAI's [enterprise deployment documentation](https://docs.x.ai/build/enterprise), updated June 16, describes six lifecycle phases: local input assembly, TLS transport, inference proxying, local tool execution, response streaming, and session end. It says ZDR organizations skip inference logging and store session history locally. The [API security FAQ](https://docs.x.ai/developers/faq/security), updated July 14, says ZDR availability depends on account and administrative state.

Use those documents to write testable contract fields: data categories, destinations, purpose, retention duration, training use, human access, subprocessors, deletion timing, logs, and incident notice. Export the actual tenant setting rather than accepting a salesperson's description. Test with the same identity and organization configuration intended for production.

Payload minimization must be enforced before encryption. Build a context manifest that records path, selection reason, byte count, sensitivity class, and destination request. Deny `.git`, secret files, generated artifacts, customer dumps, and files outside the workspace unless an explicit task-scoped approval expands access.

Git-aware agents need special handling. A secret deleted from the working tree can remain in objects, refs, reflogs, stashes, or patches. The [Git book's data-recovery discussion](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery) explains why repository history is more than visible files. Secret rotation, not deletion alone, is the safe incident response when history may have crossed a boundary.

## Production readiness and operating model

Run coding agents inside a least-privilege workspace identity. Mount only the target repository, exclude personal home directories and SSH configuration, inject short-lived task credentials through a broker, and deny ambient cloud credentials. Network policy should allow only required provider and package endpoints, with package access separated from model inference when possible.

Create three telemetry budgets: file-read scope, outbound destination/bytes, and side effects. Log denials as well as successes. A model trace cannot substitute for operating-system or proxy evidence because the agent may not describe telemetry and extension activity in its conversational transcript.

Extensions, hooks, skills, MCP servers, and subagents expand the trusted computing base. Inventory each component, pin its version, declare its file/network permissions, and run the same decoy suite with it enabled. “The core client passed” says nothing about an extension that can independently read and transmit files.

Align incident response before rollout. Preserve binary hashes, configs, server-setting exports, network logs, endpoint events, and the list of accessible repositories. If unapproved transfer occurs, stop the agent, revoke tokens, rotate any secret that may exist in current or historical repository content, notify data owners, and assess contractual or regulatory reporting.

## Failure modes

The main failure mode is semantic conflation: teams equate ZDR, encrypted transit, local tools, and open source with the same guarantee. The matrix above keeps them separate. Second is configuration drift: an account moves tiers or a server flag changes while the client version stays constant. Monitor effective settings and run a scheduled canary.

Third is unmeasured history. A scanner checks the current tree but the uploader packages Git objects. Seed history canaries and monitor archive members. Fourth is opaque auto-update. A previously approved binary replaces itself. Disable or gate updates in managed environments and re-run acceptance on every hash.

Fifth is excess privilege. Even perfect payload selection cannot protect a secret the task genuinely sends to an unauthorized provider. Classify repositories and providers, and block workloads whose contracts prohibit external processing. Sixth is false exoneration from a clean single run. Server-side rollout, account tier, region, task shape, and enabled extensions can all change behavior.

## Rollback and migration guidance

Rollback means more than uninstalling the CLI. Revoke its tokens, remove local session state according to retention policy, restore network denies, disable extensions and hooks, and rotate exposed secrets. Preserve forensic artifacts before cleanup. If a repository contains customer or regulated data, involve the data owner rather than treating the event as a developer-tool bug only.

For migration, pin the replacement agent and run the same decoy suite. Compare destinations, payload ratio, path reads, local persistence, install/update channel, ZDR contract, and source provenance. A competitor's claim should face identical evidence. Keep a non-agent editor and local test workflow available so rollback does not halt engineering.

## Adoption boundary and when not to use it

Use an open, local-inference-capable harness when your team can build, inspect, constrain, and operate it and when local models meet task quality. Use the hosted model path when the data contract permits it and the measured quality benefit justifies the external boundary.

Do not run any coding agent in a repository containing secrets, export-controlled code, sensitive customer data, or contractual restrictions until exact egress and retention controls are approved. Do not rely on natural-language instructions such as “do not read `.env`”; enforce access in the filesystem and network layers. Do not treat open source as permission to skip binary provenance or server-behavior testing.

## Rollout plan

Day one inventories candidate versions, account tiers, source commits, binaries, extensions, and destinations. Day two executes the decoy repository suite offline and online. Day three reviews source, SBOM, install/update behavior, tenant settings, and contracts. Day four runs a small internal repository with no production credentials. Week two expands only after repeated captures match the declared boundary.

Recheck after every binary hash, server-policy notice, privacy-setting change, extension update, and provider incident. A quarterly test is too slow for a client whose behavior can change server-side without installation.

## Source ledger

- [SpaceXAI open-source announcement](https://x.ai/news/grok-build-open-source), July 15, 2026: published component scope and local-inference claim.
- [Grok Build launch](https://x.ai/news/grok-build-cli), May 25, 2026: original product and subscription availability.
- [Grok Build source](https://github.com/xai-org/grok-build), accessed July 21, 2026: inspectable client implementation, license, and build surface.
- [Independent v0.2.93 analysis](https://schulz.dk/2026/07/13/your-repository-has-left-the-building-why-you-should-never-trust-grok-build/), July 13, 2026: version-bounded reproduction and claim limits.
- [Axios incident report](https://www.axios.com/newsletters/axios-future-of-cybersecurity-9168e100-7af2-11f1-bc32-bbfb768a7518), July 14, 2026: 5.1 GB/192 KB comparison, response, and unresolved facts.
- [OECD AI incident record](https://oecd.ai/en/incidents/2026-07-13-acb3), July 14, 2026: incident classification and reported scope.
- [SpaceXAI enterprise deployment docs](https://docs.x.ai/build/enterprise), updated June 16, 2026: six-phase lifecycle, TLS, ZDR, and local session storage.
- [SpaceXAI API security FAQ](https://docs.x.ai/developers/faq/security), updated July 14, 2026: account-specific ZDR boundary.
- [Simon Willison source review](https://simonwillison.net/2026/Jul/15/grok-build/), July 15, 2026: source-level observations and disabled-path caution.
- [CISA software supply-chain guidance](https://www.cisa.gov/sites/default/files/2023-12/ESF_SECURING_THE_SOFTWARE_SUPPLY_CHAIN_DEVELOPERS.pdf), retained as the primary control reference for monitored leakage and restricted build-system network access.
- [OpenSSF Scorecard](https://scorecard.dev/), accessed July 21, 2026: repository-practice triage.
- [Git data recovery internals](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery), accessed July 21, 2026: why deleted working-tree secrets may remain in history.

The durable lesson is not to distrust one vendor forever or to trust source release automatically. It is to turn “local-first” into a versioned, observable contract that can fail a test.
