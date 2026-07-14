# Multilingual Token Cost Audit

This controlled, non-model study compares `cl100k_base` and `o200k_base` on
aligned multiple-choice payloads from OpenAI's professionally translated
MMMLU test set. It uses the original English MMLU test items as the matched
baseline and the 164 HumanEval prompts as a code-domain boundary control.

## Hypothesis and analysis population

Before the first successful measurement, the directional hypothesis was that
`o200k_base` would reduce the translated-to-English token ratio in all 14
locales, lower the cross-language median inflation by at least 20 percentage
points, and change HumanEval prompt tokens by less than 5%.

The deterministic sample takes 20 evenly spaced rows from each of 57 subjects,
or all rows for smaller subjects. The alignment audit found 24 answer-key
mismatches involving 16 sampled questions. Those 16 questions were removed
from every locale, leaving 1,124 aligned questions and 15,736 translated
payloads. Three malformed MMMLU `Subject` labels retain source-filename
suffixes; the loader canonicalizes those labels only and checks row counts and
answer keys before analysis.

## Saved evidence

- `raw-results.jsonl`: per-question token counts, character/byte counts,
  aligned English counts, and prompt hashes.
- `results.json`: per-locale ratios, 5,000-repeat paired bootstrap intervals,
  character-proxy errors, subgroup ablations, and HumanEval control results.
- `source-manifest.json`: byte sizes and SHA-256 hashes for all 14 MMMLU CSVs,
  57 original MMLU subject files, and HumanEval.
- `multilingual-token-cost-audit.svg`: result figure rendered from
  `results.json`.

The headline result is a median translated-to-English inflation of 64.27% for
`cl100k_base` and 28.96% for `o200k_base`. All 14 locales used fewer tokens
under `o200k_base`; HumanEval changed by one token out of roughly 21.5k
(+0.005%). These are tokenizer measurements, not model-quality or billing
measurements.

## Data acquisition

Download the 14 locale files from the MIT-licensed
`openai/MMMLU` Hugging Face repository using the stable pattern:

```sh
mkdir -p /tmp/mmmlu-tokenizer-study
curl -L -o /tmp/mmmlu-tokenizer-study/mmlu_DE-DE.csv \
  https://huggingface.co/datasets/openai/MMMLU/resolve/main/test/mmlu_DE-DE.csv
```

Repeat for the locale identifiers in `config.json`. Download and unpack the
original MMLU test archive, then fetch the HumanEval prompt file:

```sh
curl -L -o /tmp/mmmlu-tokenizer-study/mmlu-data.tar \
  https://people.eecs.berkeley.edu/~hendrycks/data.tar
tar -xf /tmp/mmmlu-tokenizer-study/mmlu-data.tar \
  -C /tmp/mmmlu-tokenizer-study data/test data/README.txt
curl -L -o /tmp/mmmlu-tokenizer-study/HumanEval.jsonl.gz \
  https://raw.githubusercontent.com/openai/human-eval/master/data/HumanEval.jsonl.gz
```

Compare the downloads with `source-manifest.json`, install the pinned
tokenizer, and run:

```sh
python3 -m pip install --target /tmp/blog-ai-tiktoken-0130 -r requirements.txt
PYTHONPATH=/tmp/blog-ai-tiktoken-0130 \
TIKTOKEN_CACHE_DIR=/tmp/blog-ai-tiktoken-cache \
python3 run-experiment.py \
  --mmmlu-dir /tmp/mmmlu-tokenizer-study \
  --mmlu-test-dir /tmp/mmmlu-tokenizer-study/data/test \
  --human-eval /tmp/mmmlu-tokenizer-study/HumanEval.jsonl.gz
python3 render-figure.py
```

No Torch, local model, CUDA, CPU model inference, or cloud service is used.
