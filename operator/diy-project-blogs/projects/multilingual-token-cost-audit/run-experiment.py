#!/usr/bin/env python3
"""Paired token-cost audit over aligned MMLU/MMMLU prompts.

This script performs no model inference. It compares two pinned OpenAI BPE
encodings on professionally translated, question-aligned payloads and uses the
HumanEval prompts as a code-domain boundary control.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import math
import random
import statistics
from collections import defaultdict
from pathlib import Path

import tiktoken


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mmmlu-dir", type=Path, required=True)
    parser.add_argument("--mmlu-test-dir", type=Path, required=True)
    parser.add_argument("--human-eval", type=Path, required=True)
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("config.json"))
    parser.add_argument("--out-dir", type=Path, default=Path(__file__).parent)
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_english(root: Path) -> dict[str, list[dict[str, str]]]:
    grouped: dict[str, list[dict[str, str]]] = {}
    for path in sorted(root.glob("*_test.csv")):
        subject = path.name.removesuffix("_test.csv")
        rows = []
        with path.open(newline="", encoding="utf-8") as handle:
            for row in csv.reader(handle):
                if len(row) != 6:
                    raise ValueError(f"Unexpected English row width in {path}: {len(row)}")
                rows.append({"Question": row[0], "A": row[1], "B": row[2], "C": row[3], "D": row[4], "Answer": row[5]})
        grouped[subject] = rows
    if len(grouped) != 57:
        raise ValueError(f"Expected 57 English subjects, found {len(grouped)}")
    return grouped


def read_translation(path: Path) -> dict[str, list[dict[str, str]]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    with path.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            # Three published MMMLU rows groups retain source-filename suffixes
            # in the Subject field (Swahili/Yoruba college mathematics and
            # Swahili security studies). Canonicalize metadata only; the text,
            # row order, and answer key remain untouched and are checked below.
            subject = row["Subject"].split("_test", 1)[0]
            grouped[subject].append(row)
    return dict(grouped)


def spaced_indices(size: int, target: int) -> list[int]:
    if size <= target:
        return list(range(size))
    return sorted({round(i * (size - 1) / (target - 1)) for i in range(target)})


def render_prompt(row: dict[str, str]) -> str:
    return (
        f"Question: {row['Question']}\n"
        f"A. {row['A']}\nB. {row['B']}\nC. {row['C']}\nD. {row['D']}\nAnswer:"
    )


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * q
    low = math.floor(position)
    high = math.ceil(position)
    if low == high:
        return ordered[low]
    return ordered[low] * (high - position) + ordered[high] * (position - low)


def bootstrap_ratio(pairs: list[tuple[int, int]], repeats: int, rng: random.Random) -> tuple[float, float]:
    estimates = []
    n = len(pairs)
    for _ in range(repeats):
        sampled = [pairs[rng.randrange(n)] for _ in range(n)]
        estimates.append(sum(x for x, _ in sampled) / sum(y for _, y in sampled))
    return percentile(estimates, 0.025), percentile(estimates, 0.975)


def summarize_locale(records: list[dict], encoding: str, repeats: int, rng: random.Random) -> dict:
    pairs = [(row[encoding], row[f"english_{encoding}"]) for row in records]
    ratio = sum(x for x, _ in pairs) / sum(y for _, y in pairs)
    low, high = bootstrap_ratio(pairs, repeats, rng)
    proxy_errors = [abs(row["char4"] - row[encoding]) / row[encoding] for row in records]
    return {
        "items": len(records),
        "tokens": sum(row[encoding] for row in records),
        "englishTokens": sum(row[f"english_{encoding}"] for row in records),
        "ratioToAlignedEnglish": ratio,
        "ratioCi95": [low, high],
        "inflationPercent": (ratio - 1) * 100,
        "characterRatioToAlignedEnglish": sum(row["chars"] for row in records) / sum(row["english_chars"] for row in records),
        "utf8ByteRatioToAlignedEnglish": sum(row["utf8Bytes"] for row in records) / sum(row["english_utf8Bytes"] for row in records),
        "charactersPerToken": sum(row["chars"] for row in records) / sum(row[encoding] for row in records),
        "utf8BytesPerToken": sum(row["utf8Bytes"] for row in records) / sum(row[encoding] for row in records),
        "char4MapePercent": statistics.mean(proxy_errors) * 100,
    }


def load_humaneval(path: Path) -> list[str]:
    prompts = []
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        for line in handle:
            prompts.append(json.loads(line)["prompt"])
    if len(prompts) != 164:
        raise ValueError(f"Expected 164 HumanEval prompts, found {len(prompts)}")
    return prompts


def main() -> None:
    args = parse_args()
    config = json.loads(args.config.read_text())
    args.out_dir.mkdir(parents=True, exist_ok=True)
    encoders = {name: tiktoken.get_encoding(name) for name in config["encodings"]}
    english = read_english(args.mmlu_test_dir)
    translations = {
        locale: read_translation(args.mmmlu_dir / f"mmlu_{locale}.csv")
        for locale in config["locales"]
    }

    alignment = {
        "subjects": len(english),
        "answerMismatchesInInitialSample": 0,
        "excludedQuestionsForAnswerMismatch": 0,
        "rowCountMismatches": [],
    }
    raw_records = []
    selected = []
    for subject, english_rows in sorted(english.items()):
        for locale, grouped in translations.items():
            translated_rows = grouped.get(subject, [])
            if len(translated_rows) != len(english_rows):
                alignment["rowCountMismatches"].append({
                    "locale": locale, "subject": subject,
                    "english": len(english_rows), "translated": len(translated_rows),
                })
        for row_index in spaced_indices(len(english_rows), config["samplePerSubject"]):
            selected.append((subject, row_index))

    if alignment["rowCountMismatches"]:
        raise ValueError(f"Alignment failed: {alignment['rowCountMismatches'][:3]}")

    mismatched_items = set()
    for locale, grouped in translations.items():
        for subject, row_index in selected:
            if grouped[subject][row_index]["Answer"] != english[subject][row_index]["Answer"]:
                alignment["answerMismatchesInInitialSample"] += 1
                mismatched_items.add((subject, row_index))
    selected = [item for item in selected if item not in mismatched_items]
    alignment["excludedQuestionsForAnswerMismatch"] = len(mismatched_items)

    english_tokens = {}
    for subject, row_index in selected:
        row = english[subject][row_index]
        prompt = render_prompt(row)
        english_tokens[(subject, row_index)] = {
            **{name: len(encoder.encode(prompt)) for name, encoder in encoders.items()},
            "chars": len(prompt),
            "utf8Bytes": len(prompt.encode()),
        }

    for locale, grouped in translations.items():
        for subject, row_index in selected:
            source = english[subject][row_index]
            row = grouped[subject][row_index]
            prompt = render_prompt(row)
            record = {
                "itemId": f"{subject}:{row_index}",
                "locale": locale,
                "subject": subject,
                "promptSha256": hashlib.sha256(prompt.encode()).hexdigest(),
                "chars": len(prompt),
                "utf8Bytes": len(prompt.encode()),
                "char4": math.ceil(len(prompt) / 4),
                "english_chars": english_tokens[(subject, row_index)]["chars"],
                "english_utf8Bytes": english_tokens[(subject, row_index)]["utf8Bytes"],
            }
            for name, encoder in encoders.items():
                record[name] = len(encoder.encode(prompt))
                record[f"english_{name}"] = english_tokens[(subject, row_index)][name]
            raw_records.append(record)

    rng = random.Random(config["seed"])
    by_locale = defaultdict(list)
    for row in raw_records:
        by_locale[row["locale"]].append(row)
    locale_results = {}
    for locale in config["locales"]:
        summaries = {
            name: summarize_locale(by_locale[locale], name, config["bootstrapRepeats"], rng)
            for name in config["encodings"]
        }
        cl_ratio = summaries["cl100k_base"]["ratioToAlignedEnglish"]
        o_ratio = summaries["o200k_base"]["ratioToAlignedEnglish"]
        summaries["treatment"] = {
            "ratioPointReduction": cl_ratio - o_ratio,
            "inflationReductionPercent": ((cl_ratio - o_ratio) / (cl_ratio - 1) * 100) if cl_ratio > 1 else None,
            "o200kUsesFewerTokens": summaries["o200k_base"]["tokens"] < summaries["cl100k_base"]["tokens"],
        }
        locale_results[locale] = summaries

    code_prompts = load_humaneval(args.human_eval)
    code_control = {}
    for name, encoder in encoders.items():
        counts = [len(encoder.encode(prompt)) for prompt in code_prompts]
        code_control[name] = {
            "prompts": len(counts),
            "tokens": sum(counts),
            "medianTokens": statistics.median(counts),
            "charactersPerToken": sum(map(len, code_prompts)) / sum(counts),
        }
    code_control["o200kVsCl100kTokenChangePercent"] = (
        code_control["o200k_base"]["tokens"] / code_control["cl100k_base"]["tokens"] - 1
    ) * 100

    latin = set(config["latinScriptLocales"])
    reductions = [locale_results[x]["treatment"]["ratioPointReduction"] for x in config["locales"]]
    results = {
        "generatedAt": "2026-07-14",
        "runtime": {"python": "3.14", "tiktoken": "0.13.0", "modelInference": False, "torch": False},
        "design": {
            "translatedLocales": len(config["locales"]),
            "subjects": len(english),
            "selectedQuestions": len(selected),
            "pairedTranslatedPrompts": len(raw_records),
            "bootstrapRepeats": config["bootstrapRepeats"],
            "sampling": f"{config['samplePerSubject']} evenly spaced rows per subject (or all rows when smaller)",
        },
        "alignment": alignment,
        "localeResults": locale_results,
        "aggregate": {
            "languagesImproved": sum(value["treatment"]["o200kUsesFewerTokens"] for value in locale_results.values()),
            "languagesTotal": len(locale_results),
            "medianRatioPointReduction": statistics.median(reductions),
            "medianCl100kInflationPercent": statistics.median(
                value["cl100k_base"]["inflationPercent"] for value in locale_results.values()
            ),
            "medianO200kInflationPercent": statistics.median(
                value["o200k_base"]["inflationPercent"] for value in locale_results.values()
            ),
            "latinMedianRatioPointReduction": statistics.median(
                locale_results[x]["treatment"]["ratioPointReduction"] for x in latin
            ),
            "nonLatinMedianRatioPointReduction": statistics.median(
                locale_results[x]["treatment"]["ratioPointReduction"] for x in config["locales"] if x not in latin
            ),
        },
        "codeControl": code_control,
        "claimBoundary": (
            "Token counts for pinned cl100k_base and o200k_base encodings on a deterministic, subject-stratified "
            "sample of professionally translated MMLU multiple-choice payloads. This does not measure model quality, "
            "provider billing wrappers, chat-template overhead, latency, or other tokenizers."
        ),
    }

    source_paths = sorted(args.mmmlu_dir.glob("mmlu_*.csv")) + sorted(args.mmlu_test_dir.glob("*_test.csv")) + [args.human_eval]
    provenance = {
        "generatedAt": "2026-07-14",
        "sources": [{"name": path.name, "bytes": path.stat().st_size, "sha256": sha256(path)} for path in source_paths],
    }
    with (args.out_dir / "raw-results.jsonl").open("w", encoding="utf-8") as handle:
        for row in raw_records:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    (args.out_dir / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    (args.out_dir / "source-manifest.json").write_text(json.dumps(provenance, indent=2) + "\n")

    print(f"selected_questions={len(selected)}")
    print(f"paired_translated_prompts={len(raw_records)}")
    print(f"initial_answer_mismatches={alignment['answerMismatchesInInitialSample']}")
    print(f"excluded_questions={alignment['excludedQuestionsForAnswerMismatch']}")
    print(f"languages_improved={results['aggregate']['languagesImproved']}/{results['aggregate']['languagesTotal']}")
    print(f"median_cl100k_inflation_percent={results['aggregate']['medianCl100kInflationPercent']:.3f}")
    print(f"median_o200k_inflation_percent={results['aggregate']['medianO200kInflationPercent']:.3f}")
    print(f"median_ratio_point_reduction={results['aggregate']['medianRatioPointReduction']:.4f}")
    print(f"humaneval_o200k_change_percent={results['codeControl']['o200kVsCl100kTokenChangePercent']:.3f}")


if __name__ == "__main__":
    main()
