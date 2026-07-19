# Retrieval Fusion Scale Audit

This project tests whether reciprocal-rank fusion (RRF) is robust to score-scale
drift and whether that robustness should be interpreted as a relevance gain.
It uses the public BEIR SciFact and NFCorpus test sets, exact lexical retrieval,
paired per-query metrics, and query-level bootstrap intervals.

The study deliberately separates three questions: whether two lexical rankers
are diverse enough to benefit from fusion, whether raw-score addition changes
under a 100x relative-scale sweep, and whether fusing a ranker with an identical
copy produces any gain. It does not evaluate dense retrieval, learned fusion,
ANN recall, production latency, or private corpora.

## Reproduce

```sh
mkdir -p /tmp/beir-data
curl -L https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/scifact.zip -o /tmp/beir-data/scifact.zip
curl -L https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/nfcorpus.zip -o /tmp/beir-data/nfcorpus.zip
unzip -q -o /tmp/beir-data/scifact.zip -d /tmp/beir-data
unzip -q -o /tmp/beir-data/nfcorpus.zip -d /tmp/beir-data
python3 run_experiment.py --data-dir /tmp/beir-data --out-dir . --bootstrap-samples 1000
```

The saved result JSON records dataset hashes. The public article must keep the
claim boundary in `evidence-manifest.json`: these are two small biomedical and
scientific BEIR datasets and two related lexical rankers, not evidence that RRF
will improve arbitrary hybrid or neural retrieval systems.
