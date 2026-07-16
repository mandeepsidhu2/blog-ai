# Latest AI Article Production — blocked batch

Run date: 2026-07-11 (America/New_York)

## Outcome

No articles or public assets were promoted. No commit or push was attempted.
The required atomic three-article batch was blocked at the deep-research slot,
so the two timely-analysis slots were not drafted or submitted to the candidate
gate.

## Originality review

The committed library contained 46 articles. Recent batches already covered
dropout pressure schedules, GPT-5.6 routing, AI-science workbenches, media
provenance, hallucinated dependencies, computer-use action gates, healthcare
agents, scientific-agent verifiers, multimodal retrieval, agent payments,
personal-agent access, coding-agent routing, MCP authorization, cybersecurity,
and smart-contract workflows. Renamed gate articles, companion articles, reuse
of the dropout artifacts, and reuse of the MLP-channel intervention evidence
were rejected before topic reservation.

The two required local exemplars were inspected: the dropout-decay README,
reproduction guide, coefficient methodology, and paper result summary; and the
policy-verified-agent-tool README, result summary, reproducibility manifest,
statistical tables, and diagnostic artifact inventory. Their multi-seed,
matched-baseline, uncertainty, negative-control, and claim-narrowing discipline
was used as the acceptance standard.

## Reserved questions

1. Deep research: does heading-aware chunking improve lexical retrieval
   stability over fixed overlapping windows and paragraph chunks on a real
   technical corpus?
2. Timely model/spec analysis: what must engineers measure when comparing
   full-duplex voice models after GPT-Live?
3. Timely systems analysis: how should coding-agent scorecards change when
   contamination, infrastructure noise, and test-only success move headline
   benchmark results?

The questions were distinct from each other and from the committed library.

## Deep-slot experiment

An internal non-Torch experiment was created under
`operator/diy-project-blogs/projects/heading-aware-retrieval/`. It used all 46
committed articles, 12 authored information needs, five fixed perturbations per
query, and three BM25-style chunking treatments:

| Treatment | Observations | Hit@1 | Hit@5 | MRR | Mean rank |
|---|---:|---:|---:|---:|---:|
| 180-word fixed windows, 36-word overlap | 60 | 0.783 | 1.000 | 0.889 | 1.233 |
| Paragraph chunks | 60 | 0.633 | 0.983 | 0.799 | 1.533 |
| Heading-enriched paragraphs | 60 | 0.667 | 0.983 | 0.816 | 1.483 |

The preregistered directional hypothesis was falsified: heading enrichment did
not beat fixed windows. It improved MRR by 0.017 over paragraph-only chunks but
trailed fixed windows by 0.073. The negative result is useful for planning a
larger study, but it is not sufficient for a deep-research public claim.

## Blocking reason

The largest validity problem is query construction. The 12 information needs
were authored from known target articles rather than sampled from held-out user
traffic or independently labeled by multiple assessors. Repeating deterministic
lexical perturbations does not create 60 independent information needs, and the
46-document corpus is too small to establish general chunking behavior. A
skeptical review would score methodological rigor below the required 4/5 and
would treat any general recommendation as overclaiming.

Required evidence before retrying this slot:

- a held-out query set from real or independently authored information needs;
- blinded relevance judgments with agreement reporting;
- multiple corpora or a materially larger corpus;
- uncertainty computed over independent queries, not perturbations presented
  as independent samples;
- a semantic-retrieval treatment and a heading-removal negative control;
- predeclared primary metric and error taxonomy.

Because the deep slot failed, the workflow's atomicity rule prohibited
publishing the otherwise promising timely topics as a partial batch. No
`editorial-review.json` was created with inflated scores, and the automation
quality gate was not invoked on an incomplete batch.

## Current source signals reviewed

- OpenAI, GPT-5.6 general availability, 2026-07-09 (rejected as already
  covered by the committed library).
- OpenAI, GPT-Live launch, 2026-07-08.
- SPEARBench, streaming speech-to-speech naturalness benchmark, 2026-07-06.
- Google, Gemini 3.1 Flash Live, 2026-03-26 (older comparison baseline).
- Full-Duplex-Bench v3, 2026-04-06 (older task/latency baseline).
- OpenAI, coding-evaluation signal analysis and SWE-bench Verified retirement.
- Anthropic, infrastructure noise in agentic coding evaluations, including the
  reported 5.8% to 2.1% infrastructure-error reduction under a 3x resource
  ceiling.
- Terminal-Bench 2.1 audit and proof-oriented coding-evaluation work.

These signals were retained only as research notes; no public claims were
published from them.

## Runtime and safety

Local `node` was unavailable on `PATH`; the bundled Codex Node runtime was used.
No Torch, local-model, AWS, Terraform, OpenTofu, deployment, or cloud-resource
command was run. The local-model catalog was not needed. The public source tree
was not changed, no build output was promoted, and no browser publication review
was required because the batch stopped before candidate drafting.
