import json
import math
import pathlib
import random
import statistics


PROJECT = pathlib.Path(__file__).resolve().parent
CONFIG = json.loads((PROJECT / "config.json").read_text())
WORKLOAD = json.loads((PROJECT / "workload.json").read_text())


def percentile(values, probability):
    ordered = sorted(values)
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def bootstrap_interval(values, seed):
    rng = random.Random(seed)
    means = []
    for _ in range(CONFIG["bootstrapRepeats"]):
        sample = [values[rng.randrange(len(values))] for _ in values]
        means.append(statistics.fmean(sample))
    return [percentile(means, 0.025), percentile(means, 0.975)]


def object_weights(sizes, alignment, alpha, seed):
    indices = list(range(len(sizes)))
    if alignment == "large-popular":
        ranked = sorted(indices, key=lambda index: (-sizes[index], index))
    elif alignment == "small-popular":
        ranked = sorted(indices, key=lambda index: (sizes[index], index))
    elif alignment == "independent":
        ranked = indices[:]
        random.Random(seed + 99173).shuffle(ranked)
    else:
        raise ValueError(alignment)

    weights = [0.0] * len(sizes)
    for rank, index in enumerate(ranked, start=1):
        weights[index] = rank ** (-alpha) if alpha else 1.0
    total = sum(weights)
    return [weight / total for weight in weights]


def sample_index(rng, cumulative):
    target = rng.random()
    low = 0
    high = len(cumulative) - 1
    while low < high:
        middle = (low + high) // 2
        if target <= cumulative[middle]:
            high = middle
        else:
            low = middle + 1
    return low


def simulate(
    sizes,
    alignment,
    alpha,
    capacity_fraction,
    ttl_minutes,
    mean_interarrival_seconds,
    seed,
):
    rng = random.Random(seed)
    weights = object_weights(sizes, alignment, alpha, seed)
    cumulative = []
    running = 0.0
    for weight in weights:
        running += weight
        cumulative.append(running)

    capacity = max(max(sizes), round(sum(sizes) * capacity_fraction))
    ttl_seconds = ttl_minutes * 60
    cache = {}
    resident_tokens = 0
    clock = 0.0
    request_hits = 0
    token_hits = 0
    requested_tokens = 0
    billed_input_units = 0.0
    evictions = 0
    expirations = 0

    for _ in range(CONFIG["requestsPerRun"]):
        clock += rng.expovariate(1 / mean_interarrival_seconds)
        expired = [
            index
            for index, entry in cache.items()
            if entry["expiresAt"] <= clock
        ]
        for index in expired:
            resident_tokens -= sizes[index]
            del cache[index]
            expirations += 1

        index = sample_index(rng, cumulative)
        size = sizes[index]
        requested_tokens += size

        if index in cache:
            request_hits += 1
            token_hits += size
            billed_input_units += size * CONFIG["cacheReadMultiplier"]
            cache[index]["lastAccess"] = clock
            cache[index]["expiresAt"] = clock + ttl_seconds
            continue

        billed_input_units += size * CONFIG["cacheWriteMultiplier"]
        if size > capacity:
            continue

        while cache and resident_tokens + size > capacity:
            victim = min(
                cache,
                key=lambda candidate: (
                    cache[candidate]["lastAccess"],
                    candidate,
                ),
            )
            resident_tokens -= sizes[victim]
            del cache[victim]
            evictions += 1

        cache[index] = {
            "lastAccess": clock,
            "expiresAt": clock + ttl_seconds,
        }
        resident_tokens += size

    return {
        "seed": seed,
        "requestHitRate": request_hits / CONFIG["requestsPerRun"],
        "tokenHitRate": token_hits / requested_tokens,
        "hitRateGap": token_hits / requested_tokens
        - request_hits / CONFIG["requestsPerRun"],
        "costRatio": billed_input_units / requested_tokens,
        "savingsRate": 1 - billed_input_units / requested_tokens,
        "requestedTokens": requested_tokens,
        "evictions": evictions,
        "expirations": expirations,
        "capacityTokens": capacity,
    }


def summarize(rows, bootstrap_offset):
    metrics = {}
    for metric in [
        "requestHitRate",
        "tokenHitRate",
        "hitRateGap",
        "costRatio",
        "savingsRate",
        "evictions",
        "expirations",
    ]:
        values = [row[metric] for row in rows]
        metrics[metric] = {
            "mean": statistics.fmean(values),
            "std": statistics.stdev(values),
            "ci95": bootstrap_interval(
                values,
                CONFIG["bootstrapSeed"] + bootstrap_offset,
            ),
        }
        bootstrap_offset += 1
    return metrics


observed_sizes = [article["tokens"] for article in WORKLOAD["articles"]]
median_size = round(statistics.median(observed_sizes))
fixed_sizes = [median_size] * len(observed_sizes)
cells = []
raw_rows = []
cell_index = 0

designs = [
    ("observed-size", observed_sizes, CONFIG["zipfAlpha"]),
    ("fixed-size-control", fixed_sizes, CONFIG["zipfAlpha"]),
    ("uniform-popularity-control", observed_sizes, 0.0),
]

for design, sizes, alpha in designs:
    for alignment in CONFIG["alignments"]:
        if design == "uniform-popularity-control" and alignment != "independent":
            continue
        for mean_interarrival_seconds in CONFIG["meanInterarrivalSeconds"]:
            for capacity_fraction in CONFIG["capacityFractions"]:
                for ttl_minutes in CONFIG["ttlMinutes"]:
                    rows = []
                    for seed in range(1, CONFIG["seeds"] + 1):
                        row = simulate(
                            sizes,
                            alignment,
                            alpha,
                            capacity_fraction,
                            ttl_minutes,
                            mean_interarrival_seconds,
                            seed,
                        )
                        row.update(
                            {
                                "design": design,
                                "alignment": alignment,
                                "alpha": alpha,
                                "meanInterarrivalSeconds": mean_interarrival_seconds,
                                "capacityFraction": capacity_fraction,
                                "ttlMinutes": ttl_minutes,
                            }
                        )
                        rows.append(row)
                        raw_rows.append(row)

                    cells.append(
                        {
                            "design": design,
                            "alignment": alignment,
                            "alpha": alpha,
                            "meanInterarrivalSeconds": mean_interarrival_seconds,
                            "capacityFraction": capacity_fraction,
                            "ttlMinutes": ttl_minutes,
                            "repeats": len(rows),
                            "capacityTokens": rows[0]["capacityTokens"],
                            "metrics": summarize(rows, cell_index * 20),
                        }
                    )
                    cell_index += 1

result = {
    "generatedAt": "2026-07-16",
    "workload": {
        "revision": WORKLOAD["revision"],
        "tokenizer": WORKLOAD["tokenizer"],
        "articleCount": WORKLOAD["articleCount"],
        "totalTokens": sum(observed_sizes),
        "minimumTokens": min(observed_sizes),
        "medianTokens": median_size,
        "maximumTokens": max(observed_sizes),
    },
    "design": {
        "seedsPerCell": CONFIG["seeds"],
        "requestsPerRun": CONFIG["requestsPerRun"],
        "meanInterarrivalSeconds": CONFIG["meanInterarrivalSeconds"],
        "zipfAlpha": CONFIG["zipfAlpha"],
        "cacheWriteMultiplier": CONFIG["cacheWriteMultiplier"],
        "cacheReadMultiplier": CONFIG["cacheReadMultiplier"],
        "slidingTtl": True,
        "eviction": "whole-prefix LRU",
    },
    "cells": cells,
}

(PROJECT / "raw-results.json").write_text(json.dumps(raw_rows, indent=2) + "\n")
(PROJECT / "results.json").write_text(json.dumps(result, indent=2) + "\n")

primary = [
    cell
    for cell in cells
    if cell["design"] == "observed-size"
    and cell["meanInterarrivalSeconds"] == 30
    and cell["capacityFraction"] == 0.2
    and cell["ttlMinutes"] == 30
]
control = next(
    cell
    for cell in cells
    if cell["design"] == "fixed-size-control"
    and cell["alignment"] == "large-popular"
    and cell["meanInterarrivalSeconds"] == 30
    and cell["capacityFraction"] == 0.2
    and cell["ttlMinutes"] == 30
)
uniform = next(
    cell
    for cell in cells
    if cell["design"] == "uniform-popularity-control"
    and cell["meanInterarrivalSeconds"] == 30
    and cell["capacityFraction"] == 0.2
    and cell["ttlMinutes"] == 30
)

lines = [
    "prompt cache metric audit",
    (
        f"articles={WORKLOAD['articleCount']} tokenizer={WORKLOAD['tokenizer']} "
        f"seeds_per_cell={CONFIG['seeds']} requests_per_run={CONFIG['requestsPerRun']}"
    ),
    "design alignment cadence_seconds request_hit token_hit gap savings cost_ratio",
]
for cell in primary:
    metrics = cell["metrics"]
    lines.append(
        " ".join(
            [
                cell["design"],
                cell["alignment"],
                f"{cell['meanInterarrivalSeconds']:.0f}",
                f"{metrics['requestHitRate']['mean']:.3f}",
                f"{metrics['tokenHitRate']['mean']:.3f}",
                f"{metrics['hitRateGap']['mean']:+.3f}",
                f"{metrics['savingsRate']['mean']:.3f}",
                f"{metrics['costRatio']['mean']:.3f}",
            ]
        )
    )
lines.append(
    "fixed-size-control "
    f"request_hit={control['metrics']['requestHitRate']['mean']:.3f} "
    f"token_hit={control['metrics']['tokenHitRate']['mean']:.3f} "
    f"gap={control['metrics']['hitRateGap']['mean']:+.3f}"
)
lines.append(
    "uniform-popularity-control "
    f"request_hit={uniform['metrics']['requestHitRate']['mean']:.3f} "
    f"token_hit={uniform['metrics']['tokenHitRate']['mean']:.3f} "
    f"gap={uniform['metrics']['hitRateGap']['mean']:+.3f}"
)
(PROJECT / "output.txt").write_text("\n".join(lines) + "\n")
print("\n".join(lines))
