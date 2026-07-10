# Latest AI Article Production Run: AI Media Provenance Gates

Run time: 2026-07-09 20:14 EDT

## Instructions Read

- `AGENTS.md`
- `docs/INDEX.md`
- `docs/CONTENT.md`
- `docs/QUALITY.md`
- `operator/README.md`
- `operator/automations/README.md`
- `operator/automations/latest-ai-article-production.md`
- Automation memory at
  `/Users/mandeepsidhu/.codex/automations/latest-ai-article-production/memory.md`

## Source Signals Reviewed

- C2PA Specifications 2.4:
  https://spec.c2pa.org/specifications/specifications/2.4/index.html
- C2PA implementation guidance:
  https://spec.c2pa.org/specifications/specifications/2.4/guidance/Guidance.html
- Google DeepMind SynthID:
  https://deepmind.google/models/synthid/
- Google AI SynthID Text documentation:
  https://ai.google.dev/responsible/docs/safeguards/synthid
- Public `contentauth/c2pa-rs` repository and implementation activity:
  https://github.com/contentauth/c2pa-rs
- `c2patool` repository:
  https://github.com/contentauth/c2patool
- `Transparency as Architecture: Structural Compliance Gaps in EU AI Act
  Article 50 II`:
  https://arxiv.org/abs/2603.26983
- `Verifying Provenance of Digital Media: Why the C2PA Specifications Fall
  Short`:
  https://arxiv.org/abs/2604.24890
- `Authenticated Contradictions from Desynchronized Provenance and
  Watermarking`:
  https://arxiv.org/abs/2603.02378
- Public/community discovery inputs: GitHub repository activity, open issue and
  pull-request counts, release cadence, CAI community and documentation links,
  and public arXiv discussion surface. These were used as discovery and
  implementation signals, not as replacements for primary sources.

## Candidates

Temporary batch:
`/tmp/blog-ai-article-run-20260709-ai-media-provenance-gates/`

Promoted candidates:

- `ai-media-provenance-gates-2026`:
  `Gate AI Media Provenance Before Publishing`
- `measure-ai-media-provenance-gates`:
  `Measure AI Media Provenance Gates`

No additional candidates were promoted. The run shipped one current-source
article and one measured implementation article because that pair had the
strongest non-overlapping source support and measured evidence.

## Experiment Artifacts

Created:

- `operator/diy-project-blogs/projects/ai-media-provenance-gates/cases.json`
- `operator/diy-project-blogs/projects/ai-media-provenance-gates/run-experiment.mjs`
- `operator/diy-project-blogs/projects/ai-media-provenance-gates/results.json`
- `operator/diy-project-blogs/projects/ai-media-provenance-gates/output.txt`
- `operator/diy-project-blogs/projects/ai-media-provenance-gates/ai-media-provenance-gates.svg`
- `operator/diy-project-blogs/projects/ai-media-provenance-gates/README.md`

Measured output:

```output
AI media provenance gate experiment
cases=20
metadataOnlyPolicy: pass_rate=0.450 route_match=0.450 unsafe_publishes=11 disclosure_misses=2 machine_readable_misses=8 conflict_misses=3 review_misses=7 high_risk_misses=4 unnecessary_blocks=0
watermarkOnlyPolicy: pass_rate=0.450 route_match=0.450 unsafe_publishes=10 disclosure_misses=0 machine_readable_misses=7 conflict_misses=3 review_misses=7 high_risk_misses=3 unnecessary_blocks=0
dualSignalProvenanceGate: pass_rate=1.000 route_match=1.000 unsafe_publishes=0 disclosure_misses=0 machine_readable_misses=0 conflict_misses=0 review_misses=0 high_risk_misses=0 unnecessary_blocks=0
```

No LM Studio or local model inference was used. No torch work was introduced,
so the MPS-only rule was not triggered. The local model catalog probe
`curl -s http://localhost:1234/api/v1/models` failed with exit code 7 and was
not required for this deterministic experiment.

## Gates And Checks

Passed:

- Candidate public-content gate for 2 articles:
  `/Users/mandeepsidhu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node operator/scripts/check-public-content.mjs --articles-dir /tmp/blog-ai-article-run-20260709-ai-media-provenance-gates/articles --assets-dir /tmp/blog-ai-article-run-20260709-ai-media-provenance-gates/assets --source-label latest-ai-article-production`
- Committed-source public-content gate for 41 articles:
  `/Users/mandeepsidhu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node operator/scripts/check-public-content.mjs`
- Site build:
  `SITE_URL=https://learn.toolsite.com /Users/mandeepsidhu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node app-scripts/build-site.mjs`
- Generated-site check:
  `/Users/mandeepsidhu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node app-scripts/check-site.mjs`
- Generated-output scan for internal labels, private paths, local diagnostics,
  AWS profile names, and local fetch failures.
- `git diff --check`
- Article HTML/JSON/manifest/search-index/sitemap spot checks for the two new
  slugs.
- Candidate SVG metadata and dimensions through the public-content gate.

Visual review:

- Dirty-worktree desktop article review confirmed both new article images load,
  are visible, and render with `object-fit: contain`.
- The dirty-worktree home spotlight is currently occupied by pre-existing
  untracked July 10 `hallucinated-dependency-gates` content. That content was
  not created by this run and is not staged by this run. A clean-HEAD visual
  check was run after committing the promoted provenance files so the review
  reflects what the GitHub pipeline will build.
- Clean-worktree validation for commit `df18b19` was run in
  `/tmp/blog-ai-clean-ai-media-provenance-df18b19`. The public-content gate,
  production-URL build, generated-site check, blocked-label/local-diagnostic
  scan, article HTML/JSON/manifest/search-index/sitemap spot checks, and
  `git diff --check` passed there as well.
- Clean-worktree browser review confirmed the home spotlight points to
  `Gate AI Media Provenance Before Publishing`, both article pages render their
  article-specific SVGs, desktop and 390px mobile image boxes are visible, and
  the page-level scroll width stays bounded to the viewport. Overflow findings
  were confined to existing horizontally scrollable code/topic-chip content.

## Worktree Notes

Pre-existing modified files left untouched:

- `README.md`
- `docs/INFRASTRUCTURE.md`

Pre-existing untracked content left untouched:

- `content/articles/hallucinated-dependency-gates-2026.md`
- `content/articles/measure-hallucinated-dependency-gates.md`
- `content/assets/hallucinated-dependency-gates-2026.svg`
- `content/assets/measure-hallucinated-dependency-gates.svg`
- `operator/diy-project-blogs/projects/hallucinated-dependency-gates/`

## Commit And Push

Created commit `df18b19` (`Add AI media provenance gate articles`). Push is
pending. This report will be updated again after `git push origin main`.

## Intervention Needed

None for the AI media provenance batch at report-generation time.
