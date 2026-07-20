#!/usr/bin/env python3
"""Compute paired bootstrap intervals for predeclared retry-policy contrasts."""

from __future__ import annotations

import csv
import json
import random
import statistics
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
rows = list(csv.DictReader((ROOT / "artifacts" / "repeat-results.csv").open()))
index = {
    (int(row["load_per_second"]), row["fault_shape"], row["policy"], int(row["repeat"])): row
    for row in rows
}
rng = random.Random(20260719)


def paired(policy_a: str, policy_b: str, metric: str, shape: str = "correlated", load: int = 85) -> dict:
    repeats = 200 if shape != "none" else 80
    deltas = [
        float(index[(load, shape, policy_a, repeat)][metric])
        - float(index[(load, shape, policy_b, repeat)][metric])
        for repeat in range(repeats)
    ]
    boot = []
    for _ in range(5000):
        boot.append(statistics.fmean(deltas[rng.randrange(repeats)] for _ in range(repeats)))
    boot.sort()
    return {
        "policyA": policy_a,
        "policyB": policy_b,
        "metric": metric,
        "shape": shape,
        "loadPerSecond": load,
        "repeats": repeats,
        "meanDelta": statistics.fmean(deltas),
        "pairedBootstrap95": [boot[124], boot[4874]],
        "wins": sum(delta > 0 for delta in deltas),
        "ties": sum(delta == 0 for delta in deltas),
    }


contrasts = [
    paired("exponential_full_jitter", "no_retry", "success_rate"),
    paired("exponential_full_jitter", "no_retry", "peak_attempts_per_second"),
    paired("exponential_full_jitter", "no_retry", "attempt_amplification"),
    paired("budgeted_full_jitter", "exponential_full_jitter", "success_rate"),
    paired("budgeted_full_jitter", "exponential_full_jitter", "peak_attempts_per_second"),
    paired("budgeted_full_jitter", "exponential_full_jitter", "overload_failures"),
    paired("exponential_full_jitter", "exponential_no_jitter", "peak_attempts_per_second"),
    paired("exponential_full_jitter", "exponential_no_jitter", "p95_latency_seconds"),
    paired("exponential_full_jitter", "no_retry", "peak_attempts_per_second", "none"),
]

output = {
    "version": 1,
    "bootstrapSamples": 5000,
    "bootstrapSeed": 20260719,
    "pairing": "same repeat, arrival trace, and fault trace within load and fault-shape cell",
    "contrasts": contrasts,
}
(ROOT / "artifacts" / "statistical-analysis.json").write_text(json.dumps(output, indent=2) + "\n")
for item in contrasts:
    low, high = item["pairedBootstrap95"]
    print(f"{item['shape']} {item['policyA']} - {item['policyB']} {item['metric']}: {item['meanDelta']:.4f} [{low:.4f}, {high:.4f}]")
