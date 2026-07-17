---
title: Separate the EU AI Act August Deadline From High-Risk Deferrals
description: Map the 2026 transparency deadline and the 2027–2028 high-risk deferrals into distinct engineering backlogs, evidence, and rollback plans.
topic: AI Regulation Engineering
level: Advanced
date: 2026-07-17
readingTime: 18
tags: eu-ai-act, ai-transparency, content-provenance, compliance-engineering
image: /content/v1/assets/eu-ai-act-split-deadline-map.svg
imageAlt: EU AI Act timeline separating August 2026 transparency obligations from December 2027 and August 2028 high-risk system deadlines
evidenceMode: strategy
qualityTier: timely-analysis
---

“The EU AI Act was delayed” is now an unsafe engineering summary. The June 29, 2026 Digital Omnibus defers high-risk requirements to December 2, 2027 for stand-alone systems and August 2, 2028 for AI embedded in regulated products. It does not erase the Article 50 transparency obligations that apply from August 2, 2026.

For teams shipping chatbots, synthetic media, deepfake workflows, or public-interest text, the near-term work is still real. Providers may need machine-readable marking and detection support; deployers may need human-visible disclosure. The European Commission and AI Board declared the voluntary Transparency Code an adequate compliance instrument on July 8–9, and the current Commission FAQ lists an initial-signatory deadline of July 27 at 18:00 CEST. A targeted transition to December 2, 2026 may apply to certain pre-existing generative systems if the Omnibus conditions are met, but that is not a blanket four-month holiday.

There is a crucial status boundary as of July 17: the European Parliament's Legislative Observatory lists procedure 2025/0359(COD) as completed but awaiting publication in the Official Journal. The Council approved the text, and Commission/Council implementation pages present the new dates, but the amendment enters into force only after publication under its final terms. Plan engineering to the adopted schedule; before relying on a deferral as law, verify the Official Journal entry and effective date.

This is an engineering interpretation for planning, not legal advice. Confirm scope, operator role, territorial reach, and exceptions with qualified counsel. The technical recommendation is simpler: maintain separate obligation records and dates instead of one `eu_ai_act_ready` flag.

## Finding and decision summary

- Article 50(2), (4), and (5) transparency obligations become applicable on August 2, 2026 ([Commission code page, updated July 2026](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)).
- The adopted Omnibus text sets December 2, 2027 for stand-alone high-risk requirements and August 2, 2028 for product-embedded high-risk requirements; Official Journal publication is still pending as of July 17 ([Council timeline](https://www.consilium.europa.eu/en/policies/artificial-intelligence-act/timeline-artificial-intelligence/); [procedure status](https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2025%2F0359%28COD%29)).
- The code is voluntary; the underlying Article 50 duties are not. Non-signatories must demonstrate compliance through other adequate means.
- Initial code signatures are requested by July 27, 2026 at 18:00 CEST. Signing later remains possible, and not signing is not itself a violation ([Commission FAQ](https://digital-strategy.ec.europa.eu/en/faqs/signing-code-practice-transparency-ai-generated-content)).
- The code has two sections: provider-side machine-readable marking/detection and deployer-side labeling of deepfakes and certain public-interest text.
- Treat C2PA or watermarking as candidate mechanisms, not automatic legal compliance. Reliability, interoperability, alteration survival, exceptions, user disclosure, and evidence retention must be tested separately.
- Continue high-risk classification and evidence work during the deferral. The Commission's draft classification guidelines are non-binding, open for feedback until July 23, and expected to guide enforcement.

## What changed and what did not

The Council's June 29 final approval adopts fixed dates for requirements that had been approaching an August 2026 start without all supporting standards in place. Once published and in force, the change separates stand-alone Annex III-style high-risk uses—such as certain systems in biometrics, education, employment, essential services, migration, and law enforcement—from AI safety components embedded in regulated products such as machinery and medical devices.

The same package also changes implementation details. The Council timeline records December 2, 2027 for national regulatory sandboxes, a December 2, 2026 transition for certain transparency solutions, restored database registration when a provider claims a high-risk exemption, and mechanisms to reduce overlap with sectoral product law. Those are different obligations with different subjects.

Article 50 remains the immediate customer-facing boundary. The enacted AI Act requires disclosure when people interact with an AI system unless that is obvious in context. It also addresses machine-readable marking of synthetic outputs and human-facing disclosure for deepfakes and certain AI-generated text. The authoritative starting point is [Regulation (EU) 2024/1689 on EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en), not a generalized compliance checklist.

## Deadline and obligation comparison

| Track | Current key date | Primary operator / artifact | What the date does not mean |
|---|---|---|---|
| Article 50 general transparency | 2026-08-02 | Providers and deployers; interaction notice, marking/detection, deepfake or public-interest disclosure as applicable | Not every AI output requires the same label; scope and exceptions differ |
| Existing-system marking transition under Omnibus | 2026-12-02, condition-dependent | Certain providers of systems placed on market before 2026-08-02 | Not a universal deferral of chatbot or deployer disclosure |
| Stand-alone high-risk systems | 2027-12-02 in adopted Omnibus; verify OJ entry | Providers/deployers; classification, risk, data, logs, documentation, oversight, monitoring | Not permission to stop inventory or evidence collection |
| Product-embedded high-risk systems | 2028-08-02 in adopted Omnibus; verify OJ entry | Product/AI economic operators under AI and sectoral law | Not proof that sectoral safety obligations are paused |
| Initial Transparency Code signatory list | 2026-07-27 18:00 CEST | Authorized senior signatory and chosen code section(s) | Signing is voluntary and not conclusive proof of compliance |

Sources: [Council implementation timeline](https://www.consilium.europa.eu/en/policies/artificial-intelligence-act/timeline-artificial-intelligence/), [Commission Article 50 code page](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content), [Commission signing FAQ](https://digital-strategy.ec.europa.eu/en/faqs/signing-code-practice-transparency-ai-generated-content), and the [official regulation](https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en). The dates are comparable; the obligation rows are not interchangeable.

The table is a planning map, not a representation that the unpublished amendment is already the consolidated law. Release gates should include an authoritative-source check so a publication delay, correction, or changed entry-into-force term cannot leave the system relying on an anticipated date.

## Comparability limits and unresolved interpretation

The word “transparency” hides multiple controls. A chatbot disclosure is a user-interface event. A machine-readable mark is an artifact property. A deepfake label is a publication/display decision. A high-risk technical file is lifecycle evidence. One green check cannot cover all four.

The Commission's July 9 opinion says the code adequately facilitates compliance but explicitly states that adherence is not conclusive evidence. Market-surveillance authorities can still assess the implementation. Conversely, non-signatories can comply by other adequate means. A code commitment is therefore a structured evidence path, not a safe harbor that replaces system behavior.

The Commission's high-risk classification guidelines are drafts and non-binding. They reflect the Commission's interpretation, provide examples, and are expected to guide enforcement, but the final text can change after the July 23 consultation. Product classification also depends on intended purpose, whether AI is a safety component, listed harmonization law, and third-party conformity assessment. Do not convert examples into an immutable rules engine.

Technical marking has its own limits. The [C2PA 2.2 specification](https://spec.c2pa.org/specifications/specifications/2.2/index.html) provides cryptographically bound provenance structures, manifests, assertions, trust, and validation behavior. It does not by itself decide whether content is in Article 50 scope, whether a visible label is required, or whether a transformed asset remains detectable. ISO/IEC work on [JPEG Trust media-asset watermarking](https://www.iso.org/es/contents/data/standard/09/02/90209.html) is another signal that the mechanism layer is evolving. A current standards candidate is not automatically the legally sufficient implementation.

## Engineering decision: create an obligation ledger

Model compliance as data that can be reviewed, versioned, and tested:

```json
{
  "surface": "public-image-generator",
  "operatorRole": ["provider", "deployer"],
  "market": ["EU"],
  "capabilities": ["image-generation", "image-editing"],
  "article50": {
    "interactionDisclosure": "not-applicable",
    "machineReadableMarking": "required-review",
    "humanDisclosure": "context-dependent",
    "effectiveDate": "2026-08-02",
    "transitionClaim": null
  },
  "highRisk": {
    "classification": "not-determined",
    "basisRevision": "commission-draft-2026-06",
    "nextReview": "2026-08-15"
  },
  "evidence": [
    "marking-conformance-report.json",
    "disclosure-ui-screenshots/",
    "transformation-survival.csv"
  ]
}
```

The field values are illustrative. The important properties are separate operator roles, a cited legal/guidance revision, explicit unknowns, and evidence paths. Never infer `not-applicable` from “not high-risk.” Article 50 and high-risk classification are separate tracks.

Create one record per user surface and output type, not one per foundation model. The same model can power a support chatbot, an internal drafting tool, a public image generator, and a hiring screen; operator role and obligations can differ at each boundary.

## Build the August transparency path

### Interaction disclosure

Test whether a reasonable user encounters the AI disclosure before or at the start of interaction, including embedded widgets, voice calls, handoffs from a human, resumed sessions, and third-party channels. Preserve localized strings, UI screenshots, timestamps, and release identifiers. Accessibility review matters: a disclosure hidden from screen readers is weak evidence.

### Machine-readable marking and detection

Define a format matrix for JPEG, PNG, WebP, video containers, audio, and plain text. For every supported transformation—resize, crop, recompress, transcode, screenshot, metadata stripping, social upload—measure whether the mark remains embedded, recoverable through soft binding, or lost. Record false-positive and false-negative rates for any detector. “We add metadata” is not a reliability result.

Use C2PA when it fits the media workflow, but test trust-list behavior, certificate rotation, revocation, clock failure, missing manifests, and assets with unknown provenance. The [C2PA implementation guidance](https://spec.c2pa.org/specifications/specifications/2.2/guidance/_attachments/Guidance.pdf) distinguishes implementer choices that a product team must make.

### Human-visible disclosure

Treat labels as a rendering contract. Verify placement, persistence, language, creative-work handling, deepfake context, public-interest text, exports, embeds, and downstream API responses. The Commission code provides EU icons, but an icon alone may not convey the right scope to every user.

## Keep the high-risk backlog alive

The deferral buys sequencing time, not a reason to delete evidence. Start with intended-purpose and operator-role inventory. Capture training/validation data lineage where you control it, third-party model documentation where you do not, risk-management decisions, human-oversight design, event logs, performance slices, incident handling, and post-market monitoring.

Use the Commission's [draft high-risk guidelines](https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-high-risk-systems) as a versioned classification input. Record which example, Article 6 condition, Annex category, product law, or exception supports each decision. Flag decisions that depend on draft language for mandatory re-review after final guidance.

For embedded products, involve the product-safety and conformity teams now. The Council's [June 29 adoption notice](https://www.consilium.europa.eu/en/press/press-releases/2026/06/29/artificial-intelligence-council-gives-final-green-light-to-simplify-and-streamline-rules/pdf/) describes a mechanism for overlap with sectoral harmonization law and special treatment for machinery. That is a reason to unify evidence, not build an AI-only compliance silo.

## Implementation plan and measurable acceptance signals

Translate the legal review into testable service objectives. The values below are illustrative engineering thresholds, not requirements stated by the regulation or code; owners and counsel should approve the production values.

- Render the required interaction disclosure in 100% of 10,000 synthetic session starts across supported channels and locales.
- Keep missing machine-readable marks below 0.1% across 10,000 untransformed supported-media exports.
- Measure at least 1,000 assets per declared resize, crop, recompression, transcode, and metadata-strip transformation; publish recovery rate and 95% intervals.
- Keep signing-service availability at or above 99.9% or fail the generation route closed into a disclosed, queued state.
- Rotate a test signing certificate within 24 hours and demonstrate revocation propagation within the approved trust path.
- Detect a missing or invalid manifest within 5 minutes in synthetic monitoring and page the owning service when loss exceeds 0.1% for 15 minutes.
- Complete scope review for a new output modality or publication channel before any external traffic, with a 72-hour emergency path for urgent restrictions.
- Retain the obligation decision, UI evidence, conformance output, transformation matrix, and release hash for 100% of production revisions in scope.

These signals do not prove legal compliance. They turn vague claims such as “we watermark outputs” into falsifiable operational evidence that reviewers and authorities can inspect.

## Adoption boundary: when not to sign or standardize prematurely

Do not sign the voluntary code merely to appear on the initial list. The FAQ says a senior executive with authority must bind the organization, sections are signed as wholes, and signatories should implement the commitments. Run a gap assessment first and retain the decision record.

Do not hard-code the July draft classification examples as law. They are non-exhaustive, can be updated, and remain under consultation. Maintain a reviewable decision table with source revision and counsel sign-off.

Do not mandate one provenance technology across text, image, audio, and video without transformation tests. C2PA, watermarking, embedded metadata, and human labels solve overlapping but different problems. Some channels strip or re-encode evidence; some output types have no mature interoperable carrier.

Do not use the high-risk deferral to postpone basic safety engineering. Existing consumer, product, privacy, cybersecurity, sectoral, and contractual obligations continue independently of the AI Act timetable.

## Production readiness, controls, and failure modes

The highest-risk implementation failure is silent evidence loss downstream. A generator may emit a valid manifest while the CDN optimizer, thumbnailer, messaging platform, or customer export removes it. Put provenance checks after each transformation boundary and in synthetic monitoring. Alert on missing mark rate by format and route.

The second failure is role confusion. A platform may be a provider for one branded model surface and a deployer for a third-party model used in publishing. Keep role assignment in configuration and require review when branding, fine-tuning, hosting, or distribution changes.

The third is stale scope. New features—voice cloning, face editing, public auto-publication, ranking, hiring recommendations—can change the obligation record. Make regulatory-impact review part of capability launch, not an annual spreadsheet exercise.

The fourth is an unverifiable transition claim. If relying on the December 2, 2026 transition for a pre-existing system, record the system's market/service date, version identity, applicable Omnibus text, counsel interpretation, and remediation schedule. A database timestamp without identity and scope is weak evidence.

## Rollback and migration guidance

Ship disclosure and marking behind versioned policy, but do not make them optional feature flags that can be disabled without audit. A rollback should move to a previously validated disclosure/marking implementation, pause the affected generation route, or restrict distribution—not silently remove transparency.

Maintain a dual-write period when changing provenance formats. Generate old and new evidence, validate both after real transformations, and compare detector coverage before retiring the old path. Preserve the signing and certificate rotation plan.

If final guidance changes classification, re-run the obligation ledger and produce a diff: affected surfaces, old/new basis, missing artifacts, owner, deadline, and traffic restriction until remediation. If a code commitment cannot be met, escalate before signature or launch; do not retroactively narrow the recorded scope.

## Source ledger

- 2026-06-29 — Council of the EU, [final approval of the Digital Omnibus on AI](https://www.consilium.europa.eu/en/press/press-releases/2026/06/29/artificial-intelligence-council-gives-final-green-light-to-simplify-and-streamline-rules/pdf/).
- Current 2026-07-17 — European Parliament Legislative Observatory, [procedure completed, awaiting Official Journal publication](https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2025%2F0359%28COD%29).
- Updated July 2026 — Council of the EU, [AI Act timeline and fixed 2027/2028 dates](https://www.consilium.europa.eu/en/policies/artificial-intelligence-act/timeline-artificial-intelligence/).
- 2026-07-09 — European Commission, [opinion on the Transparency Code's adequacy](https://digital-strategy.ec.europa.eu/en/library/commission-opinion-assessment-code-practice-transparency-ai-generated-content).
- Updated July 2026 — European Commission, [Transparency Code scope and August 2 date](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content).
- Updated July 2026 — European Commission, [signing FAQ and July 27 deadline](https://digital-strategy.ec.europa.eu/en/faqs/signing-code-practice-transparency-ai-generated-content).
- Updated July 2026 — European Commission, [draft high-risk classification guidelines and July 23 consultation](https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-high-risk-systems).
- Official consolidated source — EUR-Lex, [Regulation (EU) 2024/1689, especially Article 50](https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en).
- 2026-06-16 — European Parliament, [approval of simplification measures](https://www.europarl.europa.eu/news/ro/press-room/20260611IPR45207/).
- Current specification — C2PA, [Content Credentials 2.2 and implementation documents](https://spec.c2pa.org/specifications/specifications/2.2/index.html).
- Current 2026 standards work — ISO/IEC, [JPEG Trust Part 3 media-asset watermarking](https://www.iso.org/es/contents/data/standard/09/02/90209.html).
- 2026-07-14 — Valcke and Hacker, [domain-specific high-risk standardization analysis](https://arxiv.org/abs/2607.12588), useful scholarly context but not legal authority.

The consequential decision is to stop treating “EU AI Act” as one milestone. Build an August 2026 transparency release, a separately evidenced transition decision where applicable, and a 2027/2028 high-risk program. The dates changed; the need for auditable system boundaries did not.
