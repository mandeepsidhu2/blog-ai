---
title: Measure AI Media Provenance Gates
description: Build a JavaScript harness that scores AI media provenance gates for unsafe publishes, disclosure misses, and conflicting evidence.
topic: AI Provenance
level: Advanced
date: 2026-07-09
readingTime: 34
tags: ai-provenance, content-authenticity, watermarking, media-pipelines, model-evaluation, evals
image: /content/v1/assets/measure-ai-media-provenance-gates.svg
imageAlt: Bar chart comparing AI media provenance gate policies by pass rate, unsafe publishes, review misses, and conflict misses
evidenceMode: experiment
---

AI media pipelines need release tests that score provenance evidence before public publishing. A generated banner may have signed content credentials and a watermark. A social reupload may have a visible AI label but no machine-readable evidence. A high-risk video may have no trustworthy provenance at all. A camera image may have valid capture history and no synthetic signal. Treating all of these as a single `aiGenerated` boolean is not enough.

This tutorial builds a compact JavaScript harness for AI media provenance gates. It scores three policies across twenty representative media handoff cases: a metadata-only policy, a watermark-only policy, and a dual-signal provenance gate. The harness measures pass rate, route-match rate, unsafe publishes, disclosure misses, machine-readable misses, conflict misses, review misses, high-risk misses, and unnecessary blocks.

The measured result is intentionally strict. The metadata-only policy passes 0.450 of cases and creates eleven unsafe publishes, two disclosure misses, eight machine-readable misses, three conflict misses, seven review misses, and four high-risk misses. The watermark-only policy also passes 0.450 of cases, with ten unsafe publishes, seven machine-readable misses, three conflict misses, seven review misses, and three high-risk misses. The dual-signal gate passes all twenty cases with zero unsafe publishes, zero disclosure misses, zero machine-readable misses, zero conflict misses, zero review misses, zero high-risk misses, and zero unnecessary blocks. The goal is not to claim that twenty cases cover every media platform. The goal is to show that provenance routing can be measured before weak evidence reaches users.

## Research Question

The question is: can a provenance gate preserve low-friction publishing for aligned evidence while preventing high-risk, missing, or contradictory AI media provenance from being treated as safe?

The `metadataOnlyPolicy` represents a common shortcut. If a valid content credential exists, it trusts the manifest. If no credential exists, it still defaults to trusted publish. This policy performs well only when metadata survives every tool in the pipeline and never contradicts other evidence.

The `watermarkOnlyPolicy` represents another shortcut. It trusts a watermark detector enough to publish labeled AI media, blocks some high-risk AI hits, and otherwise publishes. This is safer for transformed generated media than a manifest-only gate, but it ignores missing machine-readable evidence and treats watermark absence as reassuring.

The `dualSignalProvenanceGate` uses content credentials, watermark state, visible disclosure, machine-readable evidence, registry hits, publisher trust, and risk. It is not an AI detector. It is a release-control harness for deciding whether an asset can publish, needs review, or must be blocked.

## Dataset Design

The case set covers camera-originated news photos, generated campaign images, cropped generated product shots, AI audio ads, civic deepfake risk, conflicting human credentials, AI-assisted text, minor copyediting, stock image re-encodes, synthetic training data, screenshots, forged manifests, transcoded video, internal thumbnails, medical before/after imagery, human video with AI captions, social reuploads, edited press photos, satire voice clones, and agency-supplied generated banners.

Each case records modality, publisher trust, content credential state, watermark state, visible disclosure, machine-readable mark, metadata preservation, registry match, risk, and expected route.

```json
{
  "id": "cropped-synthetic-product-shot",
  "asset": "Cropped generated product image where metadata was stripped but watermark and registry match remain.",
  "modality": "image",
  "publisherTrust": "trusted",
  "contentCredential": "missing",
  "watermark": "ai",
  "visibleDisclosure": true,
  "machineReadableMark": false,
  "metadataPreserved": false,
  "hashRegistryHit": true,
  "risk": "medium",
  "expectedRoute": "provenance-review"
}
```

The expected route is assigned before a policy is evaluated. That separation is important. A convincing asset should not be allowed to choose its own proof threshold. The route comes from publishing risk and evidence quality.

## Route Model

The route model is deliberately small. Each route encodes whether the system can publish publicly, whether visible disclosure is required, whether machine-readable evidence is required, whether review is required, and whether high-risk media is blocked.

```javascript
const routes = {
  "trusted-publish": {
    allowsPublicPublish: true,
    requiresVisibleDisclosure: false,
    requiresMachineReadableMark: true,
    requiresReview: false,
    blocksHighRisk: false,
  },
  "publish-with-ai-disclosure": {
    allowsPublicPublish: true,
    requiresVisibleDisclosure: true,
    requiresMachineReadableMark: true,
    requiresReview: false,
    blocksHighRisk: false,
  },
  "provenance-review": {
    allowsPublicPublish: false,
    requiresVisibleDisclosure: true,
    requiresMachineReadableMark: true,
    requiresReview: true,
    blocksHighRisk: false,
  },
  "block-high-risk": {
    allowsPublicPublish: false,
    requiresVisibleDisclosure: true,
    requiresMachineReadableMark: true,
    requiresReview: true,
    blocksHighRisk: true,
  }
};
```

`trusted-publish` does not mean "true." It means the provenance evidence is aligned with the route. A signed camera photo can still need editorial review. A generated banner can still need brand review. This harness only scores provenance-release authority.

`provenance-review` is a productive route. It catches missing metadata, stripped machine-readable marks, registry-only evidence, uncertain transformations, and disclosure mismatches. In production, this route should preserve enough evidence for a reviewer to make a consistent decision.

## Policy Implementations

The policies are intentionally short enough to inspect in a review.

```javascript
const policies = {
  metadataOnlyPolicy(item) {
    if (item.contentCredential === "invalid") return "block-high-risk";
    if (item.contentCredential === "valid-ai") return "publish-with-ai-disclosure";
    if (credentialClaimsHuman.has(item.contentCredential)) return "trusted-publish";
    return "trusted-publish";
  },
  watermarkOnlyPolicy(item) {
    if (item.watermark === "ai" && item.visibleDisclosure) return "publish-with-ai-disclosure";
    if (item.watermark === "ai" && item.risk === "high") return "block-high-risk";
    return "trusted-publish";
  },
  dualSignalProvenanceGate(item) {
    if (item.risk === "high" && (!hasValidCredential(item) || signalsConflict(item))) return "block-high-risk";
    if (signalsConflict(item)) return "provenance-review";
    if (item.contentCredential === "valid-ai" && item.visibleDisclosure && item.machineReadableMark) {
      return "publish-with-ai-disclosure";
    }
    if (credentialClaimsHuman.has(item.contentCredential) && item.machineReadableMark && item.watermark !== "ai") {
      return "trusted-publish";
    }
    return "provenance-review";
  }
};
```

The single-signal policies fail for different reasons. Metadata-only publishing misses transformed assets where manifests were stripped and misses contradictions where an AI signal conflicts with a human-authorship claim. Watermark-only publishing misses cases where metadata is required for downstream verification and where watermark absence says little about human origin.

The dual-signal policy succeeds on this task set because it treats aligned evidence, missing evidence, and conflicting evidence as different states. It can publish an approved generated banner with disclosure. It can review a social reupload with a visible label but no machine-readable evidence. It can block high-risk content with missing or contradictory proof.

## Conflict Detection

Conflict detection is the core of the harness. The simplest version checks for human credentials with AI watermark evidence, AI credentials without required disclosure, and invalid credentials.

```javascript
function signalsConflict(item) {
  const humanCredentialWithAiSignal =
    credentialClaimsHuman.has(item.contentCredential) && item.watermark === "ai";
  const aiCredentialWithoutDisclosure =
    credentialClaimsAi.has(item.contentCredential) &&
    (item.visibleDisclosure === false || item.machineReadableMark === false);
  const invalidCredential = item.contentCredential === "invalid";
  return humanCredentialWithAiSignal || aiCredentialWithoutDisclosure || invalidCredential;
}
```

A production version should add detector confidence, signer trust, certificate validity, transformation lineage, channel-specific disclosure rules, registry match confidence, supported file types, and reviewer labels. The point is the shape: contradiction is not a lower confidence publish. It is a different route.

## Scoring Function

The scorer compares the selected route with the expected route and counts release blockers. A case passes only when the selected route matches and avoids unsafe publish, disclosure miss, machine-readable miss, conflict miss, review miss, high-risk miss, and unnecessary block.

```javascript
function scoreCase(item, routeName) {
  const route = routes[routeName];
  const routeMatch = routeName === item.expectedRoute;
  const conflictMiss = signalsConflict(item) && route.allowsPublicPublish;
  const unsafePublish =
    route.allowsPublicPublish &&
    (item.expectedRoute === "provenance-review" || item.expectedRoute === "block-high-risk" || conflictMiss);
  const disclosureMiss =
    route.allowsPublicPublish &&
    item.contentCredential === "valid-ai" &&
    (route.requiresVisibleDisclosure && !item.visibleDisclosure);
  const machineReadableMiss =
    route.allowsPublicPublish &&
    (route.requiresMachineReadableMark && (!item.machineReadableMark || !item.metadataPreserved));
  const reviewMiss = item.expectedRoute === "provenance-review" && !route.requiresReview;
  const highRiskMiss = item.expectedRoute === "block-high-risk" && !route.blocksHighRisk;
  const unnecessaryBlock = routeName === "block-high-risk" && item.expectedRoute !== "block-high-risk";
  const pass =
    routeMatch &&
    !unsafePublish &&
    !disclosureMiss &&
    !machineReadableMiss &&
    !conflictMiss &&
    !reviewMiss &&
    !highRiskMiss &&
    !unnecessaryBlock;
  return { routeMatch, unsafePublish, disclosureMiss, machineReadableMiss, conflictMiss, reviewMiss, highRiskMiss, unnecessaryBlock, pass };
}
```

This scoring function treats a successful public publish as a failure when evidence is incomplete. That is the correct stance for provenance. The user-facing risk is not only that content is synthetic. The risk is that the publishing system makes a stronger provenance claim than the evidence supports.

## Results

The run produced this output:

```output
AI media provenance gate experiment
cases=20
metadataOnlyPolicy: pass_rate=0.450 route_match=0.450 unsafe_publishes=11 disclosure_misses=2 machine_readable_misses=8 conflict_misses=3 review_misses=7 high_risk_misses=4 unnecessary_blocks=0
watermarkOnlyPolicy: pass_rate=0.450 route_match=0.450 unsafe_publishes=10 disclosure_misses=0 machine_readable_misses=7 conflict_misses=3 review_misses=7 high_risk_misses=3 unnecessary_blocks=0
dualSignalProvenanceGate: pass_rate=1.000 route_match=1.000 unsafe_publishes=0 disclosure_misses=0 machine_readable_misses=0 conflict_misses=0 review_misses=0 high_risk_misses=0 unnecessary_blocks=0
```

The metadata-only policy fails because missing metadata becomes trusted publish. That is exactly the path created by ordinary re-encoding, screenshots, social reuploads, thumbnails, and toolchains that do not preserve manifests.

The watermark-only policy fails because watermark absence is not evidence of human origin. It also publishes assets that need machine-readable disclosure for downstream systems. A watermark detector can be useful, but it is not enough to satisfy a route that requires signed provenance and preserved markers.

The dual-signal gate succeeds because it evaluates the combination. Aligned AI credential plus visible and machine-readable disclosure can publish. Aligned human or human-assisted credential with no AI-watermark conflict can publish. Missing, stripped, registry-only, or partially disclosed assets move to review. High-risk unresolved or contradictory assets block.

## Error Analysis

The largest failure class is unsafe publish. Both single-signal policies publish more than half of the cases that should review or block. This is the release risk that a content team should measure first. A publish pipeline that relies on one signal will eventually turn missing evidence into public confidence.

Machine-readable misses are also prominent. A visible label can survive where metadata does not, and metadata can survive where the visible label is omitted in a preview. The gate needs to score both because human transparency and automated verification serve different consumers.

Conflict misses are small in count but high in severity. A human-authorship credential with an AI watermark, an invalid manifest, or an AI credential without required disclosure should not be allowed to pass as a normal publish. Nonzero conflict misses are a rollback signal.

The dual-signal gate has zero unnecessary blocks in this task set, but that does not prove it will never block too much. Production systems should review false blocks separately and split routes when teams find legitimate publishing workflows that need a narrower allow path.

## Implementation Plan

Start with a shadow dashboard. For each media asset, record credential state, signer, watermark result, disclosure state, machine-readable mark, metadata preservation after export, registry hit, risk, selected route, reviewer label, and final publish decision.

Then enforce review for missing machine-readable evidence on public channels. This catches the most common pipeline regression without requiring every team to solve high-risk policy on day one.

Add conflict blocking for high-risk media after reviewer labels stabilize. Civic persuasion, medical media, financial evidence, legal evidence, and identity-linked voice should fail closed when evidence is missing or contradictory.

Finally, connect the gate to continuous tests. Run the harness when the CMS export path changes, when a new generation tool is added, when thumbnailing changes, when a distribution platform is added, or when detector thresholds change.

## Reproducibility

The harness uses one static JSON case file and one JavaScript script. It does not require model inference, external APIs, GPUs, or cloud services.

Run the harness with Node:

```sh
node run-experiment.mjs
```

The script writes `results.json`, `output.txt`, and an SVG chart. Results should match the output block above unless the case records, route definitions, policy functions, or scoring criteria change.

For production evaluation, replace the representative cases with your own media handoff traces and reviewer labels. Keep the same structure: expected route first, policy decision second, release-blocker metrics third.

## Production Readiness

Use the harness as a release gate, not as a public accusation engine. The gate should decide whether the system can publish, review, or block. It should not claim that a person lied, that an image is fake, or that a detector is certain unless the evidence and policy support that language.

Preserve evidence across the whole output path. Test the original asset, transformed derivatives, public HTML, JSON payloads, feeds, thumbnails, and downloadable files. The route should be based on the artifact users and partner systems actually receive.

Treat thresholds as versioned policy. Detector confidence, signer trust, registry match confidence, and risk classes should be logged with the policy version that made the decision. Without versioning, incident review cannot explain why an asset published.

Require rollback when unsafe publishes, high-risk misses, or conflict misses are nonzero. Require review when machine-readable marks disappear after transformation. Monitor unnecessary blocks so the gate remains usable enough that teams do not bypass it.

## Limitations

This harness has twenty representative cases and simplified fields. It does not model every media format, detector confidence curve, certificate chain, platform transform, privacy rule, regional disclosure obligation, or human editorial policy.

The harness also assumes that reviewer labels for expected routes are available and consistent. In production, route labels will need calibration. Reviewers may disagree about satire, assistive editing, screenshots, registry-only evidence, and low-risk internal publishing.

Those limits are acceptable for a release-control pattern. The harness is not a universal provenance benchmark. It is a way to stop teams from turning one metadata field or one watermark result into broad publishing authority without measuring unsafe publishes, disclosure misses, machine-readable misses, and conflict misses.
