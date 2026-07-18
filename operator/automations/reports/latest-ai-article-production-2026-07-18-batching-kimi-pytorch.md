# Latest AI Article Production — 2026-07-18

## Outcome

Produced and promoted one atomic three-article candidate batch after comparing
all 31 committed articles, recent successful and blocked automation reports,
the existing evidence-manifest inventory, automation memory, and both required
completed-research exemplars. The resulting committed library contains 34
articles and three articles dated July 18, below the daily maximum of 50.

| Slot | Article | Topic | Status |
|---|---|---|---|
| Deep research | `tune-inference-batching-arrival-shape` | Inference Systems | Passed and promoted |
| Timely model analysis | `kimi-k3-api-first-evaluation` | Frontier Models | Passed and promoted |
| Timely ecosystem analysis | `pytorch-2-13-upgrade-matrix` | ML Infrastructure | Passed and promoted |

The reserved reader questions were:

- Can two inference services with the same mean request rate require opposite
  batch-fill decisions because their arrival shapes differ?
- Does Kimi K3 justify an API pilot before its 2.8T-parameter, 64+-accelerator
  recommended self-hosting path is sufficiently specified?
- Which PyTorch 2.13 workload/backend cells justify a canary, and which build,
  ABI, correctness, or rollback gates block a broad upgrade?

These mechanisms are distinct from the library's prompt-cache accounting,
sequential optional stopping, clustered benchmark resampling, multilingual token
costs, dropout scheduling, model routing, Inkling deployment economics, and
agent gate articles. Kimi K3 was not treated as an Inkling/Hy3 companion: the
decision centers on mixed agent harnesses, preserved thinking history, API
economics, and the provider's 64+-accelerator topology recommendation. PyTorch
2.13 concerns framework/backend migration rather than model selection.

## Deep evidence project

Created `operator/diy-project-blogs/projects/inference-batching-tail-latency/`
with a version-1 evidence manifest, frozen configuration, Node runner, renderer,
84 aggregate cells, 5,040 seed-policy rows, and a result figure.

The non-Torch discrete-event design used 60 independent 60-second traces per
cell, a 10-second warm-up, offered loads of 90/140/220 requests per second,
matched Poisson and synchronized 16-request bursts, seven batching policies, a
100 ms queue timeout, a 25 ms SLO, and a no-batch-efficiency negative control.

The initial hypothesis was falsified. Added fill delay did not worsen the
synchronized-burst tail: at 90 requests per second, single service produced
96.4 ms p95 and 25.0% SLO attainment, while maximum-16/10 ms produced 18.1 ms
p95 and 100% SLO attainment. Under Poisson traffic at the same mean rate,
maximum-16/10 ms was slower than immediate maximum-four batching: 17.5 versus
12.6 ms p95. The article classifies this as exploratory mechanism evidence and
requires preregistration on unseen timestamp traces and empirical hardware
service curves.

The linear-service negative control removed the gain. At 220 Poisson requests
per second, single and immediate maximum-four policies both completed about
156.3 requests per second and dropped 28.9%; maximum-four worsened p95 from
106.0 to 124.4 ms.

Artifact hashes:

| Artifact | SHA-256 |
|---|---|
| `artifacts/aggregate-results.json` | `014844a4429b091a515dcf7f6652f5b017a55a9a28ef7b2cd4b40933bfe9536d` |
| `artifacts/raw-seed-results.csv` | `5d5690811e5f406d6f9dff205e4eb54b8488bc7bb18e22d952a6fa8cc7292f16` |
| `artifacts/batching-tail-latency.svg` | `636306e5ef10cdb75188b56a11c87ac5d7ad692e3ae2848a7508b4070ed64c0d` |
| published batching SVG | `2deed9bb59ae4e8fb9fc0d1d1957684092916bb1db7dc8dab2462593e0dd07b0` |
| published Kimi SVG | `ea5c4d3710d0ee33e69bc711619e9117fbbacc50101d04e0b0d3be64889e325e` |
| published PyTorch SVG | `37419ab21482f03b4cd18e1788ed4ef2cb64152f5b7002e820c97c0b37d9a035` |

## Timely source signals

Kimi K3 sources included the July 16 Moonshot technical blog and benchmark
footnotes, Kimi API pricing/context, Kimi Code availability, DataCurve DeepSWE,
Artificial Analysis Terminal-Bench 2.1, Vals Program Bench, FrontierSWE, vLLM,
OpenAI's July 9 comparison source, and an independent Kimi-family safety paper.
The article preserves harness differences and does not treat the 64-accelerator
recommendation as a hard minimum.

PyTorch 2.13 sources included the July 8 PyTorch Foundation release blog, signed
GitHub release notes, PyPI release record, July 15 Triton extension update,
FlexAttention paper, Apple Metal/MPS guidance, AMD ROCm compatibility, Intel XPU
documentation, Python free-threading documentation, and the `torch.compile`
contract. The article keeps the 12.3x sparse-MPS and up-to-4x loss-memory claims
attached to their reported shapes and does not claim a local benchmark.

## Skeptical editorial pass

The separate review is stored in
`latest-ai-article-production-2026-07-18-editorial-review.json`.

| Article | Average | Strongest counterargument | Main revisions |
|---|---:|---|---|
| Batching arrival shape | 4.71 | Synthetic regular bursts and a declared service curve may not survive production sequence heterogeneity. | Reclassified as exploratory after hypothesis failure; added numeric negative-control results; corrected artifact accounting. |
| Kimi K3 | 4.43 | Managed-API users may benefit before self-host evidence is complete. | Narrowed 64 accelerators from floor to recommendation; added randomized incumbent control; changed open-model release to commitment. |
| PyTorch 2.13 | 4.43 | A full matrix can slow adoption and launch measurements were not independently rerun. | Restricted advice to cell-specific canaries; added checkpoint/rollback-reader compatibility; included utility hosts because of the tracked ROCm regression. |

Every rubric dimension is at least 4 and each average exceeds 4.3. The largest
barriers are production timestamp/hardware traces, cross-provider harness parity,
and access to the required backend/compiler/checkpoint matrix.

## Visual and content validation

The SVG upgrader modified all three candidate assets. XML parsing passed, and
the publication SVG check passed for all 34 assets. Generated HTML and JSON were
scanned for internal evidence fields, operator paths, localhost diagnostics, and
AWS-profile material; none was emitted.

The candidate automation gate passed for exactly one deep-research and two
timely-analysis articles across three topics. After promotion, these gates
passed:

- committed public-content gate for 34 articles;
- production build for 34 tutorials;
- generated-site checks;
- SVG visual-system check for 34 assets;
- XML parsing for the three new SVGs;
- generated HTML/JSON asset and privacy spot checks;
- `git diff --check`.

Rendered browser review covered the home page and all three article pages at
1440x900 and 390x844. All images completed, desktop articles had 1440 px client
and scroll widths, mobile articles had 390 px client and scroll widths, images
scaled to 336x189 on mobile, and no labels, axes, titles, or page content were
clipped. The Kimi spotlight asset resolved locally at desktop and mobile sizes.

The local preview required a narrow outside-sandbox bind to 127.0.0.1 because
the sandbox returned `EPERM`. Local `node` was unavailable on `PATH`, so the
bundled Codex Node runtime was used. No Torch, CPU-Torch, CUDA, MPS experiment,
local-model inference, AWS, Terraform, Tofu, S3, or cloud mutation ran.

## Publication transaction

Publication commit and push results will be recorded immediately after the
authorized Git transaction completes.
