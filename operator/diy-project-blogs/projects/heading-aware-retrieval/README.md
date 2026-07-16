# Heading-aware retrieval experiment

This controlled lexical-retrieval study compares fixed overlapping windows,
paragraph chunks, and heading-enriched paragraph chunks over the committed
technical article corpus. Twelve information needs each receive five fixed
query perturbations. Run `node run-experiment.mjs` from the repository root.

The authored queries are a limitation: they are reproducible but not sampled
from production traffic. The negative controls test lexical robustness, not
semantic generalization. No Torch or local-model inference is used.
