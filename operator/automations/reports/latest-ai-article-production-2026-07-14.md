# Latest AI Article Production — 2026-07-14

## Outcome

Produced and promoted one atomic three-article candidate batch:

1. `deep-research`: **Measure Multilingual Token Budgets Before Pricing LLM Features** (`multilingual-token-budget-audit`)
2. `timely-analysis`: **Pilot Hy3 Where 590 GB of Weights Makes Operational Sense** (`hy3-open-model-deployment-boundary`)
3. `timely-analysis`: **Migrate GitHub Models Behind a Provider Contract Before July 30** (`github-models-retirement-migration`)

The committed library comparison rejected recent or repeated mechanisms involving clustered coding-benchmark uncertainty, full-duplex voice evaluation, proof engineering, generic deployment gates, and repackaged evidence. The selected topics span multilingual capacity planning, open-model serving, and AI platform migration.

## Deep evidence project

Evidence project: `operator/diy-project-blogs/projects/multilingual-token-cost-audit`

- Pinned `tiktoken==0.13.0`; no model inference and no Torch.
- Used OpenAI MMMLU translations, the aligned MMLU English test archive, and HumanEval as an out-of-domain negative control.
- Subject-stratified 1,124 aligned questions across 57 subjects and 14 locales, yielding 15,736 translated prompts.
- Excluded 16 question IDs across every locale after detecting 24 answer-key mismatches.
- Compared `cl100k_base` with `o200k_base` and ran 5,000 question-clustered bootstrap repeats per interval.
- Median translated-to-English inflation fell from 64.270% to 28.964%; all 14 locales improved.
- HumanEval changed from 21,537 to 21,538 tokens (+0.005%), so multilingual compression did not transfer to the code control.
- Added character- and byte-ratio decomposition after skeptical review to prevent translation length from being misrepresented as pure tokenizer causality.
- Version-1 evidence manifest records hypothesis, baselines, controls, repeats, claim boundaries, reproduction commands, and nine existing artifacts.
- Result SHA-256: `cf030fc9716cc305739c2dd8ede3ba97e54c85515240db8e5da215cfa6d3dea5`.
- Raw-record SHA-256: `6db30394b1daa77b783dd87aa09c5a22087d9a545a51a850647689c44c76e660` (5,199,530 bytes).

## Timely evidence boundaries

The Hy3 analysis uses Tencent's July 6, 2026 release and model card, vLLM and SGLang serving recipes, Apache 2.0, SWE-bench, MRCR, and Tencent kernel sources. It attributes the roughly 590 GB BF16 footprint and 4–8 large-memory-GPU recipes to those sources, explicitly reports that no local Hy3 deployment was possible, and requires cost-matched smaller-model and hosted-API baselines.

The GitHub Models analysis uses GitHub's July 1 and June 16 retirement notices, current GitHub Models and Copilot documentation, Microsoft Foundry endpoint/deployment/limit documentation, Azure API Management guidance, OpenTelemetry GenAI conventions, and OpenAI request-debugging documentation. It treats July 16 as a failover-readiness deadline, requires synthetic failures before the provider brownouts, and includes explicit shutdown boundaries for low-value prototypes.

## Editorial review and revisions

The separate skeptical pass is recorded in `operator/automations/reports/latest-ai-article-production-2026-07-14-editorial-review.json`. Every article records the strongest counterargument, weakest claim, reproduction barrier, at least two substantive revisions, and honest rubric scores. All three verdicts are `publish-ready` with averages above 4.3.

Material revisions included:

- decomposing translation-length and segmentation effects and replacing causal “tokenizer tax” language with a capacity-demand claim;
- removing an unmeasured Hy3 cost-efficiency claim and adding explicit local-measurement and baseline boundaries;
- changing the first GitHub brownout from a deterministic test deadline to a readiness checkpoint, adding synthetic failure thresholds, and adding a four-surface decommission ledger;
- replacing one unbreakable inline endpoint example after the 390 px browser review exposed document overflow.

## Visuals and validation

Built one article-specific SVG per article and ran the repository SVG upgrader. Final public asset hashes:

- multilingual token audit: `65237c748ed9f0c4e44510e3fbfd4d2df2e02e87bf18309da6d78bbb38fcbfd3`
- Hy3 deployment surface: `fcf199de4922d00fad6f7a902762a9deaf8cdf9d814057c863abaf0061fb5609`
- GitHub Models migration: `1f3a1237efcb491e31614a1dc59fc5ddba4abf5d586f34c7f9c19ac0a0320000`

Passed:

- candidate automation profile with editorial review: 3 articles;
- committed public-content gate: 52 articles;
- SVG visual-system check: 52 assets;
- production build at `SITE_URL=https://learn.toolsite.com`: 52 tutorials;
- generated-site checks, sitemap XML parse, manifest/search/sitemap slug checks, privacy/internal-metadata scan, and `git diff --check`;
- browser QA at 1280×720 and 390×844 for the home page and all three articles: no broken images, no console warnings/errors, SVGs use `object-fit: contain`, tables use contained horizontal scrolling, and final document width equals viewport width.

The first sandboxed preview-server bind returned `EPERM`; the same repository-local preview command was rerun with approved local-bind escalation. The initial dependency download required approved network escalation after sandbox DNS failure. No AWS, Terraform, Tofu, cloud-resource, CUDA, CPU-Torch, or MPS experiment command was run.

## Repository hygiene

Pre-existing untracked blocked reports and `operator/diy-project-blogs/projects/heading-aware-retrieval/` were not modified or staged. Only this batch's three articles, three assets, evidence project, editorial review, and durable report are in scope for the automation commit.

Run report written at 2026-07-14T14:11:43Z.

## Version control

- Batch commit: `e494311` (`Publish multilingual token, Hy3, and GitHub Models articles`)
- Push: successful to `origin/main` (`ecd1443..e494311`)
- The initial sandboxed push failed DNS resolution; the authorized network retry succeeded.
