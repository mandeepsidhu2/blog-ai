# Latest AI Article Production — 2026-07-19

Run completed: 2026-07-19 11:22 EDT

## Outcome

Produced and promoted one atomic three-article candidate batch containing exactly
one `deep-research` article and two `timely-analysis` articles on distinct
customer-facing topics. The committed library contained 37 articles before the
run and 40 after promotion; three articles have the July 19 date, below the
daily maximum of 50.

The requested second exemplar path,
`/Users/mandeepsidhu/Desktop/code/policy-verified-agent-tool`, did not exist. Its
relocated project at
`/Users/mandeepsidhu/Desktop/code/completed-research/policy-verified-agent-tool`
was inspected alongside `completed-research/dropout-decay`. Their manifests,
controls, statistical outputs, diagnostics, and claim boundaries informed this
batch.

## Reserved slots and originality decision

1. **Deep research — LLM Capacity Planning:** test whether estimated token-work
   admission protects a heavy-tailed serving system, and whether admission alone
   protects short requests.
2. **Timely analysis — Generative Media:** turn Meta's July 7 Muse Image launch
   and July 10 public-account reference-feature removal into an evaluable,
   consent-aware workflow decision.
3. **Timely analysis — Adversarial AI Evaluation:** determine what OpenAI's July
   15 GPT-Red announcement changes about adaptive agent-security evaluation while
   its promised preprint and attempt budgets remain unavailable.

The 37-article committed library, recent automation reports, memory, and existing
evidence projects were compared before reservation. The run rejected RRF and
retrieval complementarity, model effort/tokenizer/cost canaries, coding-agent
tool migrations, batching arrival shape, Kimi K3, PyTorch 2.13, sequential
peeking, and prompt caching as already-covered mechanisms. None of the selected
articles renames, companions, or repackages committed evidence.

## Deep evidence: token-work admission control

The dependency-free processor-sharing simulation used two workloads, three
arrival rates, six policies, 80 matched repeats per cell, and 2,880
repeat-policy rows. Baselines and controls included request-count admission,
estimated-token FIFO, oracle-token FIFO, an oracle-estimate control,
shortest-estimate-first as a queue-order diagnostic, and a fixed-900-token
negative control. All policies within a repeat shared arrivals and true service
work.

At 4.0 requests/s, request-count admission produced 13.14 s all-request p95,
5.31 s short-request p95, and 51.6% time above the declared 12,000-token work
envelope. Estimated-token FIFO reduced those values to 8.83 s and 4.1%, but
worsened short-request p95 to 7.48 s. Oracle FIFO did not repair that failure.
Shortest-estimate-first reduced all-request p95 to 8.31 s, short-request p95 to
0.73 s, and over-envelope time to 3.3%, while worsening long-request p95 versus
estimated FIFO. The fixed-length control tied at 1.19 s p95, supporting the
heavy-tail mechanism rather than an unconditional scheduler claim.

The hypothesis was therefore partly falsified: admission protects aggregate
overload but is insufficient to protect short jobs. Pure shortest-first remains
a diagnostic, not an adoption recommendation. Confirmation requires an aged or
weighted policy, unseen production traces, hardware service curves, cancellation
behavior, and a predeclared long-job fairness margin.

Evidence project:
`operator/diy-project-blogs/projects/token-work-admission-control/`. Its
version-1 manifest traces the hypothesis, claim boundary, baselines, controls,
80 repeats, reproduction commands, and six artifacts. Artifact SHA-256 values:

- aggregate results: `a65debb6308c4d174389a3b1aed1ae1f6cbfe11c8a2811b383049b2a3bafa229`
- repeat rows: `a8a26048051828482ba8e496b8638d8f71a3a8d081fdf4a8b9f0b924a22d392c`
- workload audit: `28d6e9e0450f4290262dbff5fdcc4012c37560da5105e325ec2cea4a62b2eb4f`
- evidence SVG: `f22ecb03c4245a6219e91a26bf3d29526f6349eaff0622d447396e6b8199e45e`

## Timely evidence and decision boundaries

The Muse article uses dated sources from Meta, Google, OpenAI, AP, C2PA, and
peer-reviewed or archival research. It keeps provider Arena ranks, preview
status, workflow capability, provenance, consent, and production-interface
readiness in separate comparison rows. No local or production Muse API run was
claimed because the launch materials expose no reproducible general API. The
adoption boundary is a consented, human-reviewed interactive pilot; unattended,
regulated, provenance-critical, or interface-unstable work stays on the
incumbent path.

The GPT-Red article separates the 84% versus 13% held-out arena claim, vending
objectives, ten undisclosed Codex cases, chain-of-thought detection, direct
attack rates, public-competition ranges, and ACIArena's 1,356 cases rather than
combining unlike denominators. Sources include OpenAI, Anthropic, NIST, MITRE,
OWASP, ACL, PMLR/OpenReview, and arXiv. It withholds effect-size and procurement
conclusions until the promised protocol discloses search budgets, holdout
construction, dependence, and exact result cells. Lower-consequence systems may
rationally defer an adaptive lane when its expected risk reduction does not
justify the evaluation cost.

## Skeptical editorial pass

Machine-checkable review:
`operator/automations/reports/latest-ai-article-production-2026-07-19-editorial-review.json`.

- Token-work admission averaged 4.57/5. Revisions added a per-trace workload
  audit, narrowed the 12,000-token threshold, and reclassified pure
  shortest-first as a fairness-unresolved diagnostic.
- Muse averaged 4.57/5. Revisions narrowed adoption to a human-reviewed pilot,
  disclosed the absent reproducible API, and made interface changes reset the
  affected evaluation lane.
- GPT-Red averaged 4.57/5. Revisions withheld effect-size claims, made unequal
  search budget an explicit confound, and added a lower-consequence adoption
  boundary.

Every rubric dimension is at least 4. Counterarguments, weakest claims,
reproduction barriers, and three substantive revisions per article are recorded
without inflating scores to conceal limitations.

## Visuals and gates

Three article-specific evidence visuals were built and passed the SVG upgrader:
the admission-policy result surface, the Muse workflow evaluation matrix, and
the adaptive-red-team evidence surface. Candidate XML and promoted XML parse
cleanly.

- Pre-promotion automation gate with `--quality-profile automation` and
  `--editorial-review`: passed exactly three candidates.
- Committed public-content gate: passed 40 articles.
- Production build: built 40 tutorials.
- Generated-site check: passed.
- SVG visual-system check: passed 40 assets.
- Generated privacy scan: passed for internal metadata, operator paths,
  localhost diagnostics, and private filesystem details.
- Generated HTML, JSON, canonical, image, and internal-field spot checks:
  passed.
- Desktop 1440x900 and mobile 390x844 rendered review of all three articles:
  passed with decoded visuals and no horizontal overflow.
- Mobile home spotlight review: passed; the token-work visual and article card
  render without clipping.
- `git diff --check`: passed.

## Runtime and deployment boundary

The bundled application Node runtime was used. Current-source research used the
web, and the local preview required a narrow outside-sandbox bind to
127.0.0.1:4173. The controlled experiment used no model, network, or Torch
runtime. No CPU-Torch, CUDA, MPS experiment, local-model inference, AWS,
Terraform, OpenTofu, S3, or other cloud mutation ran. Publication uses only the
authorized Git commit and push path.

## Git publication

- Batch commit: `0c4a095` (`Publish token admission and AI analysis batch`).
- Push to `origin/main`: succeeded (`94e5b01..0c4a095`).

Publication details will be recorded in a report-only follow-up commit so the
candidate batch remains atomic.
