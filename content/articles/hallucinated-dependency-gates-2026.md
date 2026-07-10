---
title: Gate AI Coding Agents Against Hallucinated Dependencies
description: Design release gates that stop AI coding assistants from installing hallucinated, squatted, or unverified packages.
topic: Software Supply Chain
level: Advanced
date: 2026-07-10
readingTime: 34
tags: software-supply-chain, ai-coding, dependency-security, package-management, provenance, guardrails
image: /content/v1/assets/hallucinated-dependency-gates-2026.svg
imageAlt: Dependency release gate architecture for AI coding assistants checking package names, source verification, provenance, script risk, and install decisions
evidenceMode: strategy
---

AI coding assistants increasingly write install commands, edit dependency manifests, clone repositories, and run setup scripts as part of normal software work. That is useful only if the runtime treats every suggested package or repository as a supply-chain decision. A model can produce a plausible package name that never existed, a real package with the wrong maintainer, a newly registered lookalike, or a GitHub URL whose owner does not match the project the user intended. If the assistant can install and execute that suggestion, a language-model mistake becomes a software supply-chain event.

The release control is a dependency gate. The gate sits between the coding assistant and package managers, repository clones, generated setup scripts, and workflow secrets. It checks whether the suggested dependency exists, whether the owner and source match the intended project, whether the artifact has provenance, whether install scripts or native code increase blast radius, and whether the task actually needs secrets. The assistant can still propose packages, but installation authority comes from the gate.

This matters now because the current signal is no longer theoretical. Recent papers show high rates of hallucinated resource identifiers in agentic workflows, fresh mitigation work is targeting package hallucination directly, and registry ecosystems are adding provenance and trusted publishing features that teams can operationalize today. The right question for a production coding agent is not "did the package name resolve?" It is "what evidence makes this dependency safe enough to install in this context?"

## Source Signals And Research Basis

[HalluSquatting](https://arxiv.org/abs/2607.07433), submitted on July 8, 2026, reframes hallucinated names as an adversarial surface for agentic applications. The paper reports that hallucinated resource generation can reach high rates in repository cloning and skill installation scenarios, and that attackers can pre-register likely hallucinations to host adversarial prompts or code. The actionable lesson is that repository and skill URLs need the same gate treatment as package names.

[BOUND](https://arxiv.org/abs/2607.02052), submitted on July 2, 2026, targets package hallucination through model editing and reports large reductions in package-level hallucination rates on edited and unseen prompts. That is useful model-side work, but it does not remove the need for runtime checks. A production gate should assume even improved models can still emit invalid or attacker-controlled names.

[The Range Shrinks, the Threat Remains](https://arxiv.org/abs/2605.17062), revised on June 11, 2026, replicated earlier package-hallucination work on a newer model cohort. It measured hallucination rates in a narrower band than older studies but still found a shared set of invented package names across models, including names that remained registrable after disclosure. The operational signal is important: lower average error rates do not eliminate common, reusable attack surface.

[Uncovering Similar but Different Packages in PyPI](https://arxiv.org/abs/2606.29785), submitted on June 29, 2026, studies replicated and similar packages in PyPI. Its findings reinforce that source verification and maintainer identity matter even when a package exists. Name existence is a weak signal if the package is a newly registered copy, near-copy, or unrelated project with a plausible name.

[npm provenance documentation](https://docs.npmjs.com/generating-provenance-statements/) describes provenance and publish attestations, including Sigstore-backed public transparency logs, and notes that provenance does not prove code is benign. That distinction is exactly right for a gate: provenance is evidence about source and build path, not a malware verdict.

[PyPI trusted publishing](https://docs.pypi.org/trusted-publishers/) gives Python maintainers an OIDC-based path that avoids long-lived upload tokens. [GitHub dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review), [OpenSSF Scorecard](https://openssf.org/projects/scorecard/), and the [SLSA specification](https://slsa.dev/spec/v1.1/) provide additional controls for dependency changes, project security posture, and build provenance. Public security coverage of HalluSquatting surfaced the same issue as a developer-facing risk; the article claims here use the papers and official docs as the primary evidence.

## Why Name Resolution Is Not Enough

A registry lookup answers only one question: does a package with this name exist right now? It does not answer whether the assistant meant that package, whether the maintainer is trusted, whether the source repository matches the artifact, whether the artifact was built by the expected workflow, whether the package is old enough to have a reputation signal, or whether install scripts can execute before review.

This is where AI-generated dependencies differ from ordinary dependency updates. A developer who chooses a package often brings context: project website, documentation, prior use, maintainers, release notes, issue history, and ecosystem reputation. A coding assistant may produce a name because it looks semantically correct. An attacker can exploit that predictability by registering names that fit model output patterns.

The gate should therefore separate three facts:

```json
{
  "suggestedName": "llm-vector-cache",
  "nameExists": true,
  "sourceVerified": false,
  "maintainerMatchesIntent": false,
  "installAuthority": "blocked"
}
```

The existence of `llm-vector-cache` is not the same as authority to install it. The gate should preserve that distinction in logs and user-facing review surfaces.

## Define Dependency Routes

Use routes that map to install authority and review burden.

`pinned-install` is for established packages whose source and maintainer match the intended project, whose version is pinned, and whose lockfile or checksum change is visible in review. This route can run in normal CI for low-risk packages.

`provenance-required` is for packages used in paths that touch secrets, production credentials, release artifacts, or provider API clients. These dependencies need source verification plus provenance or an equivalent trusted-publishing signal before install.

`sandbox-review` is for packages with native code, install scripts, binary downloads, generated postinstall behavior, or uncertain build paths. The dependency may be legitimate, but it should run first in an isolated environment without secrets.

`verify-package` is for plausible names that exist but do not yet have enough evidence. The assistant can collect documentation, source links, maintainer identity, release history, and alternatives, but it cannot install the package.

`blocked` is for non-existent packages, hallucinated repository owners, newly registered lookalikes, maintainer mismatches, install scripts combined with low reputation, and any dependency that requests secrets without a verified need.

These routes are intentionally simple. A team can add more nuance later, but the first release should make it impossible for a model-generated install command to jump directly from suggestion to execution.

## Build The Gate Contract

The gate should run before package-manager commands, repository clone commands, generated setup scripts, and workflow changes that add dependencies. A compact contract can look like this:

```json
{
  "ecosystem": "npm",
  "suggestedName": "openai-client-js",
  "requestedUse": "install the OpenAI SDK from a generated command",
  "route": "blocked",
  "evidence": {
    "registryExists": true,
    "sourceVerified": false,
    "maintainerMatchesIntent": false,
    "provenance": false,
    "ageDays": 19,
    "downloadsPerWeek": 73,
    "installScript": false
  },
  "releaseBlockers": ["source-verification", "maintainer-match", "secret-scope"]
}
```

Keep this contract outside the prompt. The model can explain why it suggested a package, but a deterministic policy should decide whether the install is allowed. That policy should be enforced by the runtime, CI, package-manager wrapper, or repository automation before code execution happens.

## Evidence To Require Before Install

Start with source identity. The package manager record should link to the expected source repository, and the repository owner should match the project the user intended. For GitHub clones, the owner and repository path are the dependency identity; do not let the model infer them from a display name alone.

Require age and adoption only as supporting evidence. High downloads do not prove safety, and low downloads do not prove malice. They are useful for routing: mature packages can proceed to pinned review faster, while new packages require more scrutiny.

Use provenance where it is available. npm provenance, PyPI trusted publishing, GitHub dependency review, Scorecard checks, and SLSA-style provenance all answer different parts of the question. The gate should record which evidence was present and which evidence was missing.

Treat install scripts and native code as blast-radius multipliers. A package with postinstall behavior can execute during installation, before the application imports it. Native code and binary downloads add platform-specific risk. These dependencies should go through `sandbox-review` unless the team already has a stronger allowlist.

Limit secret scope. A dependency install rarely needs production API keys, cloud credentials, package-publishing tokens, SSH keys, or browser cookies. The gate should run dependency discovery and sandbox installs without secrets by default.

## Operational Signals

Track metrics that distinguish productivity loss from supply-chain risk:

- unsafe installs: packages installed when the expected route was block, verify, or sandbox.
- squatted accepts: installs where source or maintainer evidence does not match the intended project.
- provenance misses: installs in routes that require provenance but lack it.
- script-risk misses: installs with native code or install scripts outside sandbox review.
- source-verification misses: installs without verified source and maintainer evidence.
- secret overexposure: installs that ran with broader credentials than the route needed.
- false blocks: safe dependencies that the gate blocked and reviewers later approved.

Unsafe installs and squatted accepts should be release blockers. False blocks deserve review, but they are not symmetric with unsafe installs. A false block costs engineering time. An unsafe install can compromise code, secrets, CI, developer laptops, or release artifacts.

## Implementation Plan

Begin in audit mode. Wrap dependency-changing commands such as `npm install`, `pip install`, lockfile edits, GitHub clone commands, and generated setup scripts. Log the package name, route, evidence, command, source file, assistant trace, and whether secrets were present.

Move to enforcement for the highest-risk routes first. Block non-existent names, maintainer mismatches, newly registered packages with install scripts, GitHub owner mismatches, and any dependency change that would run with secrets. These rules have a low false-positive cost relative to the risk they remove.

Then require review for native code and install scripts. The review should include source repository, package metadata, provenance status, maintainer identity, recent releases, install behavior, and the exact lockfile diff.

Finally, connect the gate to CI. A pull request that adds a dependency should show the route and evidence next to the dependency diff. Reviewers should not have to reconstruct why an assistant added a package.

## Failure Modes And Rollback Criteria

Roll back a coding-agent release when unsafe installs are nonzero, when a package installs without source verification, when a package with install scripts runs outside a sandbox, when a dependency change touches secrets, or when reviewers find maintainer mismatch after merge.

Watch for name laundering. An assistant may first propose a hallucinated package, then later switch to a real package with a similar name after a failed install. The trace should preserve the original suggestion and the recovery path.

Watch for repository-owner confusion. Hallucinated GitHub URLs can look plausible because owner and repository names often follow repeated patterns. Verify the project home page, release artifacts, and maintainer identity before clone or script execution.

Watch for provenance overconfidence. Provenance proves more about where and how an artifact was built than whether the code is safe. A signed malicious package is still malicious. Provenance should open a route to review, not remove review.

## Limitations

Dependency gates do not replace secure package registries, code review, malware scanning, lockfiles, sandboxing, SCA tools, provenance, or maintainer education. They connect those controls to the specific moment when an AI coding assistant tries to turn a package suggestion into executable code.

The current research signal is moving quickly. HalluSquatting and package-hallucination mitigation work provide useful evidence, but every team needs local traces from its own coding agents, languages, registries, CI workflows, and secret-management model. Start with strict routes, measure false blocks, and relax only when the evidence shows that a narrower route is safe.
