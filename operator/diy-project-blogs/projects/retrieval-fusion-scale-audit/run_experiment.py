#!/usr/bin/env python3
"""Audit retrieval-fusion robustness on two public BEIR test sets.

Dependency-free by design. This is a lexical mechanism study, not a claim about
dense retrievers or production latency.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import random
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path


TOKEN_RE = re.compile(r"[a-z0-9]+")


def words(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower())


def terms(text: str, mode: str) -> list[str]:
    tokens = words(text)
    if mode == "unigram":
        return tokens
    return [f"{a}_{b}" for a, b in zip(tokens, tokens[1:])]


def load_dataset(root: Path, name: str):
    base = root / name
    docs = {}
    with (base / "corpus.jsonl").open() as handle:
        for line in handle:
            row = json.loads(line)
            docs[str(row["_id"])] = f"{row.get('title', '')} {row.get('text', '')}"
    queries = {}
    with (base / "queries.jsonl").open() as handle:
        for line in handle:
            row = json.loads(line)
            queries[str(row["_id"])] = row["text"]
    qrels = defaultdict(dict)
    with (base / "qrels" / "test.tsv").open() as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        for row in reader:
            qrels[str(row["query-id"])][str(row["corpus-id"])] = int(row["score"])
    active = {qid: queries[qid] for qid in qrels if qid in queries}
    return docs, active, dict(qrels)


class BM25:
    def __init__(self, docs: dict[str, str], mode: str, k1: float = 1.2, b: float = 0.75):
        self.mode, self.k1, self.b = mode, k1, b
        self.n = len(docs)
        self.lengths = {}
        self.postings = defaultdict(list)
        for doc_id, text in docs.items():
            counts = Counter(terms(text, mode))
            self.lengths[doc_id] = sum(counts.values())
            for term, count in counts.items():
                self.postings[term].append((doc_id, count))
        self.avgdl = sum(self.lengths.values()) / max(1, self.n)

    def search(self, query: str, limit: int = 1000) -> list[tuple[str, float]]:
        scores = defaultdict(float)
        for term in set(terms(query, self.mode)):
            posting = self.postings.get(term, ())
            df = len(posting)
            if not df:
                continue
            idf = math.log(1 + (self.n - df + 0.5) / (df + 0.5))
            for doc_id, tf in posting:
                norm = self.k1 * (1 - self.b + self.b * self.lengths[doc_id] / max(self.avgdl, 1e-9))
                scores[doc_id] += idf * tf * (self.k1 + 1) / (tf + norm)
        return sorted(scores.items(), key=lambda item: (-item[1], item[0]))[:limit]


def rrf(a, b, k):
    scores = defaultdict(float)
    for rank, (doc, _) in enumerate(a, 1):
        scores[doc] += 1 / (k + rank)
    for rank, (doc, _) in enumerate(b, 1):
        scores[doc] += 1 / (k + rank)
    return sorted(scores.items(), key=lambda item: (-item[1], item[0]))


def score_fusion(a, b, scale=1.0, normalize=False):
    def values(rows):
        score_map = dict(rows)
        if not normalize or not score_map:
            return score_map
        lo, hi = min(score_map.values()), max(score_map.values())
        width = hi - lo
        return {doc: (value - lo) / width if width else 0.0 for doc, value in score_map.items()}

    left, right = values(a), values(b)
    docs = set(left) | set(right)
    return sorted(((doc, left.get(doc, 0.0) + scale * right.get(doc, 0.0)) for doc in docs),
                  key=lambda item: (-item[1], item[0]))


def query_metrics(ranking, rels):
    ordered = [doc for doc, _ in ranking]
    gains = [rels.get(doc, 0) for doc in ordered[:10]]
    dcg = sum((2**gain - 1) / math.log2(rank + 2) for rank, gain in enumerate(gains))
    ideal = sorted(rels.values(), reverse=True)[:10]
    idcg = sum((2**gain - 1) / math.log2(rank + 2) for rank, gain in enumerate(ideal))
    relevant = {doc for doc, score in rels.items() if score > 0}
    recall = len(relevant & set(ordered[:100])) / max(1, len(relevant))
    reciprocal = next((1 / rank for rank, doc in enumerate(ordered, 1) if doc in relevant), 0.0)
    return {"ndcg10": dcg / idcg if idcg else 0.0, "recall100": recall, "mrr": reciprocal}


def bootstrap(values, seed, samples=1000):
    rng = random.Random(seed)
    n = len(values)
    means = [sum(values[rng.randrange(n)] for _ in range(n)) / n for _ in range(samples)]
    means.sort()
    return {"mean": statistics.fmean(values), "ci95_low": means[25], "ci95_high": means[974]}


def sha256(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def svg_figure(rows, out: Path):
    datasets = ["scifact", "nfcorpus"]
    methods = ["unigram_bm25", "bigram_bm25", "minmax_sum", "rrf_k60"]
    lookup = {(r["dataset"], r["method"]): r["ndcg10"] for r in rows}
    colors = {"unigram_bm25": "#1d4ed8", "bigram_bm25": "#0f766e", "minmax_sum": "#d97706", "rrf_k60": "#be123c"}
    labels = {"unigram_bm25": "Unigram BM25", "bigram_bm25": "Bigram BM25", "minmax_sum": "Min-max score fusion", "rrf_k60": "RRF (k=60)"}
    x_positions = [210, 630]
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="560" viewBox="0 0 1000 560" data-visual-quality="publication" data-text-fit="bounded">',
        '<title>Retrieval fusion nDCG at 10 on SciFact and NFCorpus</title>',
        '<desc>Grouped bars compare unigram and bigram BM25 with normalized score fusion and reciprocal rank fusion.</desc>',
        '<rect width="1000" height="560" fill="#f8fafc"/>',
        '<text x="60" y="55" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="25" font-weight="700" fill="#0f172a">Fusion gains depend on ranker diversity</text>',
        '<text x="60" y="84" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14" fill="#475569">BEIR test qrels · exact lexical retrieval · higher nDCG@10 is better</text>',
        '<line x1="90" y1="440" x2="910" y2="440" stroke="#64748b" stroke-width="2"/>',
    ]
    for tick in range(0, 8):
        y = 440 - tick * 45
        value = tick / 10
        parts.append(f'<line x1="90" y1="{y}" x2="910" y2="{y}" stroke="#cbd5e1" stroke-width="1"/>')
        parts.append(f'<text x="48" y="{y+5}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="#475569">{value:.1f}</text>')
    for dataset, center in zip(datasets, x_positions):
        for idx, method in enumerate(methods):
            value = lookup[(dataset, method)]
            height = value * 450
            x = center + idx * 62
            y = 440 - height
            parts.append(f'<rect x="{x}" y="{y:.1f}" width="46" height="{height:.1f}" rx="4" fill="{colors[method]}"/>')
            parts.append(f'<text x="{x+23}" y="{y-7:.1f}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" fill="#0f172a">{value:.3f}</text>')
        parts.append(f'<text x="{center+116}" y="470" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" font-weight="700" fill="#0f172a">{dataset.upper()}</text>')
    for idx, method in enumerate(methods):
        x = 85 + idx * 220
        parts.append(f'<rect x="{x}" y="510" width="18" height="18" rx="3" fill="{colors[method]}"/>')
        parts.append(f'<text x="{x+26}" y="524" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="#334155">{labels[method]}</text>')
    parts.append('</svg>')
    out.write_text("\n".join(parts) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, default=Path("."))
    parser.add_argument("--bootstrap-samples", type=int, default=1000)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    summary_rows, per_query_rows = [], []
    dataset_meta = {}
    for dataset_idx, dataset in enumerate(("scifact", "nfcorpus")):
        docs, queries, qrels = load_dataset(args.data_dir, dataset)
        unigram = BM25(docs, "unigram")
        bigram = BM25(docs, "bigram")
        methods = defaultdict(dict)
        overlap100, bigram_unique_relevant100, bigram_unique_relevant10 = [], [], []
        for qid, query in queries.items():
            a, b = unigram.search(query), bigram.search(query)
            a100, b100 = {doc for doc, _ in a[:100]}, {doc for doc, _ in b[:100]}
            a10, b10 = {doc for doc, _ in a[:10]}, {doc for doc, _ in b[:10]}
            relevant = {doc for doc, score in qrels[qid].items() if score > 0}
            overlap100.append(len(a100 & b100) / max(1, len(a100 | b100)))
            bigram_unique_relevant100.append(len((b100 - a100) & relevant))
            bigram_unique_relevant10.append(len((b10 - a10) & relevant))
            methods["unigram_bm25"][qid] = a
            methods["bigram_bm25"][qid] = b
            methods["raw_sum_scale_0p1"][qid] = score_fusion(a, b, 0.1)
            methods["raw_sum_scale_1"][qid] = score_fusion(a, b, 1.0)
            methods["raw_sum_scale_10"][qid] = score_fusion(a, b, 10.0)
            methods["minmax_sum"][qid] = score_fusion(a, b, 1.0, normalize=True)
            methods["rrf_k10"][qid] = rrf(a, b, 10)
            methods["rrf_k60"][qid] = rrf(a, b, 60)
            methods["rrf_k100"][qid] = rrf(a, b, 100)
            methods["duplicate_rrf_control"][qid] = rrf(a, a, 60)
        metric_values = {}
        for method, runs in methods.items():
            metric_values[method] = {metric: [] for metric in ("ndcg10", "recall100", "mrr")}
            for qid in queries:
                measured = query_metrics(runs[qid], qrels[qid])
                per_query_rows.append({"dataset": dataset, "query_id": qid, "method": method, **measured})
                for metric, value in measured.items():
                    metric_values[method][metric].append(value)
            row = {"dataset": dataset, "method": method, "queries": len(queries)}
            for metric, values in metric_values[method].items():
                row[metric] = statistics.fmean(values)
            summary_rows.append(row)
        best_individual = max(("unigram_bm25", "bigram_bm25"), key=lambda m: statistics.fmean(metric_values[m]["ndcg10"]))
        for method in ("minmax_sum", "rrf_k10", "rrf_k60", "rrf_k100", "duplicate_rrf_control"):
            deltas = [x - y for x, y in zip(metric_values[method]["ndcg10"], metric_values[best_individual]["ndcg10"])]
            ci = bootstrap(deltas, 20260718 + dataset_idx * 100 + len(method), args.bootstrap_samples)
            for row in summary_rows:
                if row["dataset"] == dataset and row["method"] == method:
                    row.update({"best_individual": best_individual, "ndcg10_delta_vs_best": ci["mean"], "delta_ci95_low": ci["ci95_low"], "delta_ci95_high": ci["ci95_high"]})
        dataset_meta[dataset] = {
            "documents": len(docs), "queries": len(queries), "qrels": sum(len(x) for x in qrels.values()),
            "mean_top100_jaccard": statistics.fmean(overlap100),
            "queries_bigram_adds_relevant_top100": sum(value > 0 for value in bigram_unique_relevant100),
            "queries_bigram_adds_relevant_top10": sum(value > 0 for value in bigram_unique_relevant10),
            "bigram_unique_relevant_top100_total": sum(bigram_unique_relevant100),
            "corpus_sha256": sha256(args.data_dir / dataset / "corpus.jsonl"),
            "queries_sha256": sha256(args.data_dir / dataset / "queries.jsonl"),
            "test_qrels_sha256": sha256(args.data_dir / dataset / "qrels" / "test.tsv"),
        }
    (args.out_dir / "results.json").write_text(json.dumps({"config": {"bootstrap_samples": args.bootstrap_samples, "seed": 20260718, "rank_depth": 1000}, "datasets": dataset_meta, "results": summary_rows}, indent=2) + "\n")
    with (args.out_dir / "per_query_metrics.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(per_query_rows[0]))
        writer.writeheader(); writer.writerows(per_query_rows)
    with (args.out_dir / "summary.csv").open("w", newline="") as handle:
        fields = sorted({key for row in summary_rows for key in row})
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader(); writer.writerows(summary_rows)
    svg_figure(summary_rows, args.out_dir / "retrieval-fusion-results.svg")
    print(json.dumps({"datasets": dataset_meta, "results": summary_rows}, indent=2))


if __name__ == "__main__":
    main()
