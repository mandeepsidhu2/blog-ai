# Latest AI Article Production — 2026-07-18 Afternoon

Run completed: 2026-07-18 23:19 EDT

## Outcome

Produced and promoted one atomic three-article candidate batch with exactly one
`deep-research` article and two `timely-analysis` articles across three distinct
customer-facing topics. The library contained three July 18 articles before
promotion and six afterward, below the daily maximum of 50.

The versioned workflow's second exemplar path,
`/Users/mandeepsidhu/Desktop/code/policy-verified-agent-tool`, did not exist. The
same project was found at its relocated path under
`/Users/mandeepsidhu/Desktop/code/completed-research/policy-verified-agent-tool`,
where the required README, result summary, reproducibility manifest, statistical
tables, and diagnostics were inspected. Both exemplars informed the use of
matched controls, query-level uncertainty, negative results, explicit claim
boundaries, and reproducible artifact paths.

## Reserved slots and originality decision

1. **Deep research — Retrieval Evaluation:** When does rank-only fusion remain
   robust to score units but reduce relevance because a second ranker adds
   different rather than useful candidates? Evidence path: new public-BEIR,
   dependency-free experiment with paired query metrics and bootstrap intervals.
2. **Timely analysis — Agent Models:** Does Claude Sonnet 5 improve production
   cost per verified task after holding effort, harness, tokenizer, and price
   phase fixed? Evidence path: June 30 release and system card plus cloud,
   benchmark-method, and environment sources.
3. **Timely analysis — AI Code Review:** How should a team migrate agent tools
   when nominally equivalent interfaces change trace behavior? Evidence path:
   GitHub's July 10 failed-then-corrected code-review migration plus harness,
   agent-interface, exploration-benchmark, MCP, and tool-design sources.

The committed 34-article pre-run library and recent reports were searched before
reservation. The run rejected batching/arrival-shape, prompt-cache metrics,
sequential peeking, clustered benchmark uncertainty, multilingual token-cost,
Kimi K3, PyTorch 2.13, and MCP stateless migration because they were already
published. LiteRT.js was researched but rejected because a browser-backend
matrix would repeat the mechanism of the newly committed PyTorch backend matrix.
The chosen RRF, fixed-effort/tokenizer, and tool-interface-attribution questions
do not rename, companion, or reuse the evidence of a committed article.

## Candidates

### Prove Ranker Complementarity Before Enabling RRF

- Slug: `prove-ranker-complementarity-before-rrf`
- Tier/topic: deep research / Retrieval Evaluation
- Experiment: exact unigram and adjacent-bigram BM25 over BEIR SciFact and
  NFCorpus; raw-score scale stress at 0.1x, 1x, and 10x; min-max normalization;
  RRF `k={10,60,100}`; duplicate-ranker negative control; 1,000 paired query
  bootstraps with seed 20260718.
- Scale: 5,183 + 3,633 documents; 300 + 323 queries; 339 + 12,334 judgments;
  6,230 per-query-method rows and 20 aggregate method rows.
- Falsified hypothesis: RRF at `k=60` reduced SciFact nDCG@10 from 0.6605 to
  0.5397, delta -0.1207 with 95% bootstrap interval [-0.1557, -0.0840]. It
  reduced NFCorpus from 0.3081 to 0.2885, delta -0.0195 [-0.0304, -0.0089].
- Control: duplicate-ranker RRF was exactly neutral on both datasets.
- Mechanism audit: mean top-100 Jaccard overlap was only 0.1807 and 0.0828, but
  the bigram ranker added a relevant top-100 result for only 4/300 and 32/323
  queries. Low set overlap did not imply useful complementarity.
- Claim boundary: two small scientific/biomedical test sets and two related
  exact lexical rankers; no claim about dense retrieval, learned fusion, ANN
  recall, latency, or private production corpora.

Evidence project:
`operator/diy-project-blogs/projects/retrieval-fusion-scale-audit/` contains the
version-1 manifest, config, runner, dataset hashes, aggregate JSON/CSV,
per-query metrics, README, and result SVG. Reproduction downloads the official
BEIR archives and runs Python's standard library only.

### Canary Claude Sonnet 5 With Fixed Effort and Token Budgets

- Slug: `claude-sonnet-5-effort-budget-canary`
- Tier/topic: timely analysis / Agent Models
- Current trigger: Anthropic's June 30 Sonnet 5 release remains within the
  permitted 30-day baseline window and is necessary for the current July 18
  adoption decision; AWS and Microsoft availability sources corroborate routes.
- Decision signals: $2/$10 per MTok through August 31 versus $3/$15 standard;
  stated 1.0–1.35x tokenizer expansion; 63.2% versus 58.1% SWE-bench Pro;
  80.4% versus 67.0% Terminal-Bench 2.1; 57.4% versus 46.8% HLE with tools;
  81.2% versus 78.5% OSWorld-Verified.
- Boundary: provider-authored results mix effort, attempts, graders, harnesses,
  tool access, and up to a 10-million-token search budget. The article requires
  fixed-effort, fixed-ceiling, randomized task replay and prices traces at both
  promotional and steady-state rates.

### Trace-Test Agent Tool Migrations Before Trusting Final Scores

- Slug: `trace-test-agent-tool-instruction-migrations`
- Tier/topic: timely analysis / AI Code Review
- Current trigger: GitHub's July 10 account of a shared-tool migration that
  initially increased cost and reduced useful comments, followed by a
  review-shaped instruction treatment reporting about 20% lower production
  review cost without a blocking quality signal.
- Decision signals: three shared tools, a five-stage review flow, 89-task
  TerminalBench context, at least five runs per agent-model configuration, a
  two-hour timeout, 20+ supported models, and reported 7%/4% negative cells for
  two GPT configurations in the wider harness comparison.
- Boundary: GitHub does not publish absolute cost, sample size, confidence
  intervals, exact production prompts, model revision, or quality denominator.
  The 20% result is treated as a mechanism signal, not a portable effect size.
  The article requires a 2x2 tool-by-instruction attribution screen and local
  preregistered noninferiority.

## Source signals

Primary/high-signal sources included BEIR and RRF papers and repository,
Elasticsearch, Azure AI Search, OpenSearch, and Qdrant fusion documentation;
Anthropic's dated release and system card, AWS and Microsoft availability,
SWE-bench, Terminal-Bench, OSWorld, and FrontierCode methods; GitHub's July 10
and June 25 engineering reports, SWE-agent, SWE-Explore, OpenHands, the current
MCP tool specification, and Anthropic tool-design documentation. Exact dates,
versions, settings, and comparability limits remain attached to the relevant
rows in the articles.

## Skeptical editorial pass

Machine-checkable review:
`operator/automations/reports/latest-ai-article-production-2026-07-18-afternoon-editorial-review.json`.

- RRF average 4.57/5. Strongest counterargument: the deliberately weak bigram
  ranker limits transfer to heterogeneous production stacks. Weakest claim:
  treating low overlap as complementarity. Revisions added unique-relevant-yield
  measurements, reran artifacts, replaced the overlap gate, and narrowed the
  conclusion.
- Sonnet 5 average 4.43/5. Strongest counterargument: conservative evaluation
  may delay an obvious low-risk migration. Weakest claim: lower list price means
  lower task cost. Revisions added dual-price/tokenizer arithmetic, separated
  quality and economic decisions, and recorded effort/harness/grader confounds.
- Tool migration average 4.43/5. Strongest counterargument: GitHub's 20% result
  is not independently reproducible. Weakest claim: portable effect size.
  Revisions added the 2x2 attribution design, blinded earliest-sufficient-
  evidence annotation, and the negative CLI-transfer boundary.

All seven rubric dimensions are at least 4 for every article. No score was
raised to hide the stated external-validity and reproduction limitations.

## Visuals

Created three article-specific evidence visuals: an artifact-generated grouped
nDCG chart, a Sonnet effort/tokenizer/price decision surface, and an agent-trace
geometry scorecard. The SVG upgrader initially duplicated the existing
`data-visual-quality` attribute. Mechanical content and SVG-system gates did not
catch the XML violation; browser review showed a broken hero. All three root
attributes were repaired, `xmllint` passed, the site was rebuilt, and desktop
plus 390x844 browser review was repeated successfully. Natural SVG dimensions
were 1000x560 or 1200x675, all images decoded, and page scroll width matched the
viewport. The mobile home spotlight displayed the Sonnet visual without
clipping.

## Gates and checks

- Pre-promotion automation candidate gate with `--quality-profile automation`
  and `--editorial-review`: passed exactly three articles.
- Post-repair candidate asset XML parse: passed. A post-promotion candidate
  rerun correctly reported only reused slugs because the same candidates were
  now in committed source; the required originality check had already passed
  before promotion.
- Committed public-content gate: passed 37 articles.
- Production build: built 37 tutorials.
- Generated-site check: passed.
- SVG visual-system check: passed 37 assets.
- Generated privacy scan for internal metadata, operator paths, local service
  diagnostics, cloud profiles, and state details: passed.
- Generated HTML, JSON, manifest, canonical, image, TOC, and internal-metadata
  spot checks: passed.
- Desktop 1440x900 and mobile 390x844 browser checks for all new articles plus
  mobile home spotlight: passed after the SVG repair.
- `xmllint --noout` for all candidate and promoted SVGs: passed.
- `git diff --check`: passed.

## Runtime and deployment boundary

Local `node` was unavailable; the bundled Codex Node runtime was used. The
official BEIR datasets and Anthropic system card required narrow network access
after sandbox DNS/tooling limits. A temporary `pypdf` install under `/tmp` was
used to extract the official system-card tables after the bundled dependency
lookup timed out and system Poppler was unavailable. The local preview required
a narrow outside-sandbox bind to 127.0.0.1:4173.

No Torch, CPU-Torch, CUDA, MPS experiment, local-model inference, AWS,
Terraform, OpenTofu, S3, or other cloud mutation ran. Publication uses the
authorized Git commit and push path only.

## Git publication

- Batch commit: `8553dea` (`Publish retrieval fusion and agent analysis batch`).
- Push to `origin/main`: succeeded (`e97db59..8553dea`).

This publication evidence was recorded in a follow-up report-only commit so the
batch commit itself remained atomic and reproducible.
