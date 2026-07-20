#!/usr/bin/env python3
"""Discrete-time retry amplification experiment with matched stochastic traces."""

from __future__ import annotations

import csv
import json
import math
import random
import statistics
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CONFIG = json.loads((ROOT / "config.json").read_text())
ARTIFACTS = ROOT / "artifacts"


def poisson(rng: random.Random, mean: float) -> int:
    threshold = math.exp(-mean)
    product = 1.0
    count = 0
    while product > threshold:
        count += 1
        product *= rng.random()
    return count - 1


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return float("nan")
    index = (len(ordered) - 1) * q
    lo = math.floor(index)
    hi = math.ceil(index)
    if lo == hi:
        return ordered[lo]
    return ordered[lo] * (hi - index) + ordered[hi] * (index - lo)


def mean_ci(values: list[float]) -> tuple[float, float, float]:
    mean = statistics.fmean(values)
    if len(values) < 2:
        return mean, mean, mean
    half = 1.96 * statistics.stdev(values) / math.sqrt(len(values))
    return mean, mean - half, mean + half


def retry_delay_ticks(policy: str, attempt: int, rng: random.Random) -> int:
    if policy == "immediate_three":
        return 1
    base = 5 * (2 ** (attempt - 1))
    if policy == "exponential_no_jitter":
        return base
    return max(1, int(rng.uniform(0, base)))


def build_fault_trace(shape: str, ticks: int, seed: int) -> list[float]:
    rng = random.Random(seed)
    if shape == "none":
        return [0.0] * ticks
    if shape == "independent":
        return [CONFIG["faultShapes"]["independent"]["failureProbability"]] * ticks

    spec = CONFIG["faultShapes"]["correlated"]
    bad = False
    trace = []
    for _ in range(ticks):
        if bad:
            if rng.random() < spec["badToGoodProbabilityPerTick"]:
                bad = False
        elif rng.random() < spec["goodToBadProbabilityPerTick"]:
            bad = True
        trace.append(spec["badStateFailureProbability"] if bad else 0.0)
    return trace


def simulate(load: int, shape: str, policy: str, repeat: int) -> dict[str, float | int | str]:
    tick_seconds = CONFIG["tickSeconds"]
    active_ticks = int(CONFIG["durationSeconds"] / tick_seconds)
    total_ticks = int((CONFIG["durationSeconds"] + CONFIG["drainSeconds"]) / tick_seconds)
    capacity = int(CONFIG["providerCapacityPerSecond"] * tick_seconds)
    deadline_ticks = int(CONFIG["requestDeadlineSeconds"] / tick_seconds)
    seed = CONFIG["seedBase"] + repeat * 1009 + load * 17 + (0 if shape == "independent" else 1_000_003)
    arrivals_rng = random.Random(seed)
    fault_trace = build_fault_trace(shape, total_ticks, seed + 31)
    policy_rng = random.Random(seed + sum(ord(c) for c in policy) * 101)

    scheduled: dict[int, list[tuple[int, int]]] = defaultdict(list)
    requests: dict[int, dict[str, int | None]] = {}
    next_id = 0
    attempt_counts = [0] * total_ticks
    overload_failures = 0
    fault_failures = 0
    retries_denied = 0
    retry_tokens = float(CONFIG["retryBudget"]["capacity"])
    retry_refill = CONFIG["retryBudget"]["tokensPerSecond"] * tick_seconds

    for tick in range(total_ticks):
        retry_tokens = min(float(CONFIG["retryBudget"]["capacity"]), retry_tokens + retry_refill)
        if tick < active_ticks:
            for _ in range(poisson(arrivals_rng, load * tick_seconds)):
                requests[next_id] = {"arrival": tick, "success": None, "attempts": 0}
                scheduled[tick].append((next_id, 1))
                next_id += 1

        attempts = scheduled.pop(tick, [])
        policy_rng.shuffle(attempts)
        attempt_counts[tick] = len(attempts)
        for position, (request_id, attempt) in enumerate(attempts):
            request = requests[request_id]
            if request["success"] is not None:
                continue
            if tick - int(request["arrival"]) > deadline_ticks:
                continue
            request["attempts"] = int(request["attempts"]) + 1
            failed = position >= capacity
            if failed:
                overload_failures += 1
            elif policy_rng.random() < fault_trace[tick]:
                failed = True
                fault_failures += 1
            if not failed:
                request["success"] = tick
                continue
            if policy == "no_retry" or attempt >= 3:
                continue
            if policy == "budgeted_full_jitter":
                if retry_tokens < 1:
                    retries_denied += 1
                    continue
                retry_tokens -= 1
            retry_tick = tick + retry_delay_ticks(policy, attempt, policy_rng)
            if retry_tick < total_ticks and retry_tick - int(request["arrival"]) <= deadline_ticks:
                scheduled[retry_tick].append((request_id, attempt + 1))

    successes = [r for r in requests.values() if r["success"] is not None]
    latencies = [(int(r["success"]) - int(r["arrival"])) * tick_seconds for r in successes]
    attempts_total = sum(int(r["attempts"]) for r in requests.values())
    one_second = int(1 / tick_seconds)
    rolling = [sum(attempt_counts[i:i + one_second]) for i in range(0, total_ticks - one_second + 1)]
    return {
        "load_per_second": load,
        "fault_shape": shape,
        "policy": policy,
        "repeat": repeat,
        "requests": len(requests),
        "success_rate": len(successes) / len(requests),
        "attempt_amplification": attempts_total / len(requests),
        "p95_latency_seconds": percentile(latencies, 0.95),
        "peak_attempts_per_second": max(rolling),
        "overload_failures": overload_failures,
        "fault_failures": fault_failures,
        "retries_denied": retries_denied,
        "bad_tick_fraction": sum(1 for p in fault_trace[:active_ticks] if p > 0) / active_ticks,
    }


def main() -> None:
    ARTIFACTS.mkdir(exist_ok=True)
    rows = []
    shapes = ["independent", "correlated"]
    for load in CONFIG["loadsPerSecond"]:
        for shape in shapes:
            for repeat in range(CONFIG["repeats"]):
                for policy in CONFIG["policies"]:
                    rows.append(simulate(load, shape, policy, repeat))

    control_repeats = 80
    for load in CONFIG["loadsPerSecond"]:
        for repeat in range(control_repeats):
            for policy in CONFIG["policies"]:
                rows.append(simulate(load, "none", policy, repeat))

    fieldnames = list(rows[0])
    with (ARTIFACTS / "repeat-results.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    grouped: dict[tuple[int, str, str], list[dict]] = defaultdict(list)
    for row in rows:
        grouped[(int(row["load_per_second"]), str(row["fault_shape"]), str(row["policy"]))].append(row)

    metrics = ["success_rate", "attempt_amplification", "p95_latency_seconds", "peak_attempts_per_second", "overload_failures", "retries_denied", "bad_tick_fraction"]
    aggregates = []
    for (load, shape, policy), group in sorted(grouped.items()):
        item = {"load_per_second": load, "fault_shape": shape, "policy": policy, "repeats": len(group)}
        for metric in metrics:
            mean, low, high = mean_ci([float(row[metric]) for row in group])
            item[metric] = {"mean": mean, "ci95": [low, high]}
        aggregates.append(item)

    result = {
        "config": CONFIG,
        "rowCount": len(rows),
        "aggregateCellCount": len(aggregates),
        "aggregates": aggregates,
    }
    (ARTIFACTS / "aggregate-results.json").write_text(json.dumps(result, indent=2) + "\n")

    focal = [a for a in aggregates if a["load_per_second"] == 85 and a["fault_shape"] == "correlated"]
    lines = ["Focal cell: 85 requests/s, correlated failures, 200 matched repeats"]
    for item in focal:
        lines.append(
            f"{item['policy']}: success={item['success_rate']['mean']:.4f} "
            f"attempts/request={item['attempt_amplification']['mean']:.3f} "
            f"p95={item['p95_latency_seconds']['mean']:.3f}s "
            f"peak={item['peak_attempts_per_second']['mean']:.1f}/s "
            f"overload_failures={item['overload_failures']['mean']:.1f}"
        )
    (ARTIFACTS / "focal-summary.txt").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"rows={len(rows)} aggregate_cells={len(aggregates)}")


if __name__ == "__main__":
    main()
