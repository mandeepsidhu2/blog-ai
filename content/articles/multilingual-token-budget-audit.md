---
title: Measure Multilingual Token Budgets Before Pricing LLM Features
description: Reproduce a paired 14-language tokenizer audit, quantify where character proxies fail, and turn token inflation into safer capacity and cost decisions.
topic: Multilingual AI
level: Advanced
date: 2026-07-14
readingTime: 21
tags: tokenization, multilingual-systems, llm-costs, capacity-planning
image: /content/v1/assets/multilingual-token-cost-audit.svg
imageAlt: Paired bar chart of cl100k base and o200k base token ratios to aligned English across fourteen languages
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/multilingual-token-cost-audit
evidenceManifest: operator/diy-project-blogs/projects/multilingual-token-cost-audit/evidence-manifest.json
---

An LLM feature priced from English traces can exceed its budget before model quality enters the discussion. The same question and answer choices may occupy radically different fractions of a context window after translation, and a four-characters-per-token estimate can fail most severely on the scripts where the budget is already tight.

We measured that effect with two pinned OpenAI tokenizers on professionally translated, aligned evaluation payloads. The study covers 1,124 questions from all 57 MMLU subjects, 14 translated locales, 15,736 paired non-English prompts, and 5,000 paired bootstrap repeats per reported interval. The treatment was a tokenizer change from `cl100k_base` to `o200k_base`; every translated payload was compared with its aligned English source under the same tokenizer.

The result is consequential but not absolute. Median translated-to-English token inflation fell from 64.27% under `cl100k_base` to 28.96% under `o200k_base`. All 14 locales used fewer tokens relative to their aligned English payloads. Yet Yoruba still required 2.12 times as many `o200k_base` tokens as aligned English, and Bengali required 1.54 times as many. These ratios combine natural translation-length differences with tokenizer segmentation; they measure capacity demand, not a purely causal “tokenizer tax.” A newer vocabulary reduced that demand, but it did not make an English capacity plan multilingual.

The engineering decision is simple: replay representative payloads through the exact tokenizer attached to the deployed model, stratify budgets by language, and bill from provider usage—not from characters. Use character proxies only as deliberately loose admission controls with measured error margins.

## Finding and decision summary

The directional hypothesis had three parts: `o200k_base` would reduce the translated-to-English token ratio in every MMMLU locale, lower the median inflation by at least 20 percentage points, and leave the HumanEval code control within 5% of `cl100k_base`. All three were supported.

- The median reduction was 35.31 percentage points, from 64.27% to 28.96% inflation.
- Every locale improved, but the remaining `o200k_base` ratio ranged from 1.12× for Simplified Chinese to 2.12× for Yoruba.
- The non-Latin-script subgroup had a median ratio reduction of 0.950, versus 0.210 for the Latin-script subgroup.
- HumanEval changed from 21,537 to 21,538 tokens, a +0.005% negative result: the multilingual improvement did not generalize into code compression.
- The `ceil(characters / 4)` proxy had mean absolute percentage error from 14.0% to 65.4% under `o200k_base`, depending on locale.

Do not translate those numbers into claims about answer accuracy. Tokenizer fertility can influence cost and available context, but this experiment did not run a model. It cannot show that the newer encoding understands any language better.

## Why a paired multilingual audit is necessary

OpenAI’s [MMMLU dataset](https://huggingface.co/datasets/openai/MMMLU) uses professional human translations of the MMLU test set in 14 locales, including Arabic, Bengali, Hindi, Swahili, Yoruba, Japanese, Korean, and Chinese. That makes it more defensible than comparing unrelated web samples: each translated item has an English source with the same task and answer structure.

The original [MMLU paper](https://arxiv.org/abs/2009.03300) spans 57 subjects from elementary knowledge to professional law and physics. Subject stratification matters because mathematical notation, legal prose, and short factual questions tokenize differently. A news-only sample can make a tokenizer look better than it is on the payloads that dominate a real product.

The tokenizer boundary is also versioned. OpenAI’s current [`tiktoken` model mapping](https://github.com/openai/tiktoken/blob/main/tiktoken/model.py) maps older GPT-4-era models to `cl100k_base` and newer families to `o200k_base`; the study pins [`tiktoken` 0.13.0](https://pypi.org/project/tiktoken/). A model name is not a durable token-counting contract unless the encoding and package version are recorded beside it.

Prior research gives the result a plausible mechanism but not its numeric answer. The 2025 [Token Tax study](https://arxiv.org/abs/2509.05486) linked higher fertility to cost and accuracy disparities across African languages. The 2026 [Script Tax study](https://arxiv.org/abs/2602.11174) found large efficiency differences between orthographic variants. Those papers cover different models, corpora, and outcomes. They motivate measurement; they do not substitute for replaying your own request mix.

## Methodology

### Hypothesis, datasets, and scale

The analysis used the original English MMLU test archive as the paired baseline and all 14 professionally translated MMMLU CSVs as treatments. It selected 20 evenly spaced rows from every subject, or all rows if a subject contained fewer than 20. This produced an initial 1,140-question panel.

The alignment gate found 24 answer-key mismatches involving 16 unique questions. Those questions were excluded from every locale, rather than assuming that a changed key represented a harmless correction. The confirmatory panel therefore contains 1,124 questions × 14 translations = 15,736 non-English payloads. Three malformed `Subject` values in the published Swahili and Yoruba metadata retained filename suffixes; the loader canonicalized those labels only, then checked per-subject row counts and answer keys.

Each payload concatenated the question, four choices, and a constant `Answer:` suffix. Both tokenizers saw the same Unicode string. The primary metric was a ratio of summed translated tokens to summed aligned-English tokens. Summing before division weights the result by actual capacity consumed; a mean of per-item ratios would over-weight very short questions.

The analysis ran on a local Python 3.14 process with `tiktoken` 0.13.0. It used no neural inference, accelerator, hosted API, or timing measurement. Hardware is therefore not a treatment variable.

### Sampling and alignment implementation

The first excerpt constructs the subject-stratified panel and refuses row-count drift. The canonicalization handles known filename suffixes in metadata without rewriting prompt text.

```python
def read_translation(path):
    grouped = defaultdict(list)
    with path.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            subject = row["Subject"].split("_test", 1)[0]
            grouped[subject].append(row)
    return dict(grouped)

def spaced_indices(size, target):
    if size <= target:
        return list(range(size))
    return sorted({
        round(i * (size - 1) / (target - 1))
        for i in range(target)
    })

selected = []
for subject, english_rows in sorted(english.items()):
    for locale, grouped in translations.items():
        if len(grouped.get(subject, [])) != len(english_rows):
            raise ValueError(f"row-count mismatch: {locale}/{subject}")
    for row_index in spaced_indices(len(english_rows), sample_per_subject):
        selected.append((subject, row_index))
```

The answer-key exclusion is applied at question level. If one locale differs, that English item and all 14 translations leave the panel. This preserves a rectangular paired design.

```python
mismatched_items = set()
for locale, grouped in translations.items():
    for subject, row_index in selected:
        translated = grouped[subject][row_index]
        source = english[subject][row_index]
        if translated["Answer"] != source["Answer"]:
            mismatched_items.add((subject, row_index))

selected = [
    item for item in selected
    if item not in mismatched_items
]
assert len(selected) == 1124
```

### Treatment and metrics

The treatment is deliberately small: count exactly the same prompt with two named encodings. The raw artifact stores token counts, Unicode code-point counts, UTF-8 byte counts, aligned English counts, locale, subject, item ID, and a SHA-256 prompt digest. It does not store model outputs because none exist.

```python
encoders = {
    name: tiktoken.get_encoding(name)
    for name in ["cl100k_base", "o200k_base"]
}

record = {
    "itemId": f"{subject}:{row_index}",
    "locale": locale,
    "subject": subject,
    "promptSha256": hashlib.sha256(prompt.encode()).hexdigest(),
    "chars": len(prompt),
    "utf8Bytes": len(prompt.encode()),
    "char4": math.ceil(len(prompt) / 4),
}
for name, encoder in encoders.items():
    record[name] = len(encoder.encode(prompt))
    record[f"english_{name}"] = english_tokens[item_id][name]
```

## Baselines, controls, and ablations

`cl100k_base` is the matched tokenizer baseline. The second baseline is the familiar `ceil(characters / 4)` estimate. It is intentionally weak but operationally relevant: spreadsheets, quotas, and UI counters often use a character proxy before server usage arrives.

The aligned English payload is the control for semantic content and subject. It does not make translations byte-identical, but it removes the much larger confound of comparing unrelated questions. The HumanEval code prompts form an out-of-domain negative control using OpenAI’s [published 164-problem dataset](https://github.com/openai/human-eval). The hypothesis expected multilingual compression to improve without a material code-token change.

The script-family ablation splits eight Latin-script locales from six non-Latin-script locales. That grouping is coarse: Yoruba diacritics, German compounds, Arabic morphology, and Chinese segmentation are not reducible to two bins. Its purpose is to test whether the aggregate improvement is concentrated, not to propose a linguistic taxonomy.

The bootstrap resamples question IDs, keeping each translated/English pair together. Five thousand repeats estimate a 95% percentile interval for each locale and encoding.

```python
def bootstrap_ratio(pairs, repeats, rng):
    estimates = []
    n = len(pairs)
    for _ in range(repeats):
        sampled = [pairs[rng.randrange(n)] for _ in range(n)]
        translated = sum(x for x, _ in sampled)
        english = sum(y for _, y in sampled)
        estimates.append(translated / english)
    return percentile(estimates, 0.025), percentile(estimates, 0.975)

pairs = [
    (row[encoding], row[f"english_{encoding}"])
    for row in locale_records
]
ratio = sum(x for x, _ in pairs) / sum(y for _, y in pairs)
ci_low, ci_high = bootstrap_ratio(pairs, 5000, rng)
```

## Results

The figure is generated from the saved aggregate JSON. The table below uses the same artifact; English is normalized separately under each tokenizer, so the ratios compare capacity within an encoding rather than raw token IDs across vocabularies. Dataset provenance: [OpenAI MMMLU](https://huggingface.co/datasets/openai/MMMLU) and the [MMLU authors’ release](https://github.com/hendrycks/test). Tokenizer provenance: [OpenAI tiktoken](https://github.com/openai/tiktoken).

| Locale | Character ratio to English | `cl100k_base` ratio (95% CI) | `o200k_base` ratio (95% CI) | Ratio-point reduction | `char/4` MAPE vs o200k |
|---|---:|---:|---:|---:|---:|
| Bengali | 0.97 | 4.69 (4.61–4.77) | 1.54 (1.52–1.55) | 3.16 | 34.7% |
| Hindi | 0.98 | 3.86 (3.80–3.93) | 1.42 (1.41–1.43) | 2.45 | 28.7% |
| Yoruba | 1.03 | 2.83 (2.77–2.88) | 2.12 (2.08–2.16) | 0.71 | 46.3% |
| Arabic | 0.86 | 2.48 (2.45–2.52) | 1.24 (1.23–1.25) | 1.24 | 27.5% |
| Japanese | 0.48 | 2.01 (1.98–2.03) | 1.55 (1.53–1.56) | 0.46 | 65.4% |
| Korean | 0.53 | 1.96 (1.93–1.98) | 1.30 (1.29–1.31) | 0.66 | 55.7% |
| Swahili | 1.03 | 1.75 (1.73–1.77) | 1.40 (1.39–1.41) | 0.35 | 23.4% |
| Chinese | 0.37 | 1.53 (1.52–1.55) | 1.12 (1.11–1.13) | 0.41 | 62.9% |
| German | 1.15 | 1.48 (1.47–1.49) | 1.25 (1.25–1.26) | 0.23 | 14.0% |
| French | 1.16 | 1.46 (1.45–1.48) | 1.28 (1.27–1.29) | 0.18 | 14.6% |
| Italian | 1.11 | 1.44 (1.43–1.45) | 1.31 (1.30–1.32) | 0.13 | 14.3% |
| Indonesian | 1.05 | 1.41 (1.39–1.42) | 1.17 (1.16–1.18) | 0.23 | 14.0% |
| Spanish | 1.12 | 1.36 (1.35–1.37) | 1.20 (1.19–1.20) | 0.16 | 15.3% |
| Portuguese | 1.05 | 1.35 (1.34–1.36) | 1.15 (1.15–1.16) | 0.19 | 15.1% |

The intervals are narrow because the panel has more than a thousand paired questions spanning 57 subjects. They quantify sampling variation over this panel; they do not cover translator choice, another tokenizer release, or a different product corpus.

```output
selected_questions=1124
paired_translated_prompts=15736
initial_answer_mismatches=24
excluded_questions=16
languages_improved=14/14
median_cl100k_inflation_percent=64.270
median_o200k_inflation_percent=28.964
median_ratio_point_reduction=0.3839
```

The largest reduction occurred for Bengali, but “largest improvement” is not “smallest remaining budget.” Bengali still consumed 53.7% more `o200k_base` tokens than aligned English. Yoruba had the largest remaining ratio at 2.12×. If a service admits 100k English-equivalent prompt tokens, a Yoruba payload mix resembling this panel would need a substantially smaller character allowance to preserve the same model-side token headroom.

The character-ratio column exposes the main causal limit. German and French translations were 15–16% longer than English by Unicode code points, so some token inflation is expected from added text. Conversely, Japanese and Chinese used only 48% and 37% as many code points while still consuming 1.55× and 1.12× the `o200k_base` tokens. Character counts are not linguistically comparable across scripts, but the decomposition shows why neither translation verbosity nor segmentation alone explains the capacity result. The safe claim is operational: these aligned payloads consume different token budgets.

## Statistical analysis and uncertainty

The treatment comparison is paired at the prompt level, and uncertainty is clustered at the question level through resampling. That is preferable to treating every character or token as an independent observation. The tokenizer is deterministic; repeated encoding would create no new information. Bootstrap repeats estimate panel uncertainty rather than runtime randomness.

All 14 point estimates favored `o200k_base`, and each locale’s two ratios are far enough apart that their reported intervals do not overlap. That pattern is stronger than the median alone. Still, the study was not designed for a family-wise hypothesis test over languages, and the intervals should not be read as a guarantee about all future inputs in each locale.

The code control supplies the negative result:

```output
control=HumanEval prompts=164
cl100k_base_tokens=21537 median_tokens=117
o200k_base_tokens=21538 median_tokens=117
absolute_change_tokens=1
relative_change_percent=0.005
characters_per_token_cl100k=3.4312
characters_per_token_o200k=3.4311
multilingual_gain_transfers_to_code=false
```

That result narrows the mechanism. The newer vocabulary appears to allocate capacity more effectively to the studied languages, especially non-Latin scripts, but does not universally compress text. Code-heavy agents should maintain a separate token-budget stratum.

## Error analysis and limitations

MMMLU is professionally translated, but translation is not semantic identity at the byte or wording level. Translators can expand explanations, reorder choices, or choose a more natural phrase. Excluding answer-key mismatches reduces one visible alignment risk; it cannot prove that every remaining pair has identical nuance.

The sample is subject-stratified rather than traffic-weighted. It deliberately gives small academic subjects representation, which is useful for coverage but may not resemble support chats, code reviews, legal documents, or medical notes. A production estimate should repeat the method over consented, redacted traces and report traffic-weighted and tail distributions.

The prompt template adds English labels—`Question`, `Answer`, and A–D—to every locale. This constant overhead pulls ratios toward one, especially for short items. Fully localized scaffolding could move the results. Provider chat templates, special tokens, tool schemas, images, cached-input accounting, and reasoning tokens are also absent.

`cl100k_base` and `o200k_base` are only two encodings. The result cannot rank Anthropic, Google, Meta, Mistral, Tencent, or another provider. Even within OpenAI-compatible services, an API wrapper can report tokens differently from a local approximation. The [OpenAI API request-debugging guidance](https://platform.openai.com/docs/api-reference/debugging-requests) is a reminder to keep provider request IDs and returned usage in production telemetry.

Finally, lower token count is not automatically lower latency or higher accuracy. Vocabulary size, embedding lookup, model architecture, batching, hardware, output length, and cache policy all intervene. The study measures one boundary: how many tokenizer units represent the input.

## Production readiness: budget by stratum

Build a token ledger with at least `locale`, `model_snapshot`, `encoding`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `tool_schema_tokens`, and `request_id`. Record Unicode character and byte counts as diagnostic features, not billing truth. OpenTelemetry’s [GenAI attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/) provide portable names for provider, request model, response model, and usage fields, while warning that prompt content can be sensitive.

Set admission budgets from high quantiles, not means. If the target context limit is 128k, reserve explicit headroom for the system prompt, tools, retrieval, output, and retries. Then compute per-locale p95 input tokens on the intended model. A safe envelope might be expressed as:

```python
def admissible(user_tokens, fixed_tokens, output_reserve, context_limit):
    total_reserved = user_tokens + fixed_tokens + output_reserve
    return total_reserved <= context_limit

budget = {
    "fixed_system_and_tools": measured_fixed_tokens,
    "retrieval_p95": measured_retrieval_tokens[locale],
    "user_p95": measured_user_tokens[locale],
    "output_reserve": output_policy_tokens,
}
```

Roll out a tokenizer or model change in shadow mode. Recount recent payloads with old and new encodings, then compare overflow rate, truncation rate, cache hit accounting, and estimated cost by locale and workload. Do not silently enlarge truncation to absorb a tokenizer migration; that converts a capacity change into a quality change.

Rollback when any protected language cohort exceeds its overflow budget, when provider-reported usage diverges materially from the pinned local counter, or when truncation removes system/tool instructions. Preserve both counters during the migration so an incident can be reconstructed.

## Reproducibility

The saved evidence includes a pinned configuration and dependency, source hashes for 14 MMMLU files, 57 English subject files, and HumanEval, 4.5 MB of per-prompt raw counts, aggregate results, console output, and a figure renderer. The result figure reads `results.json`; its bars are not hand-entered.

```sh
python3 -m pip install --target /tmp/tiktoken-audit -r requirements.txt
PYTHONPATH=/tmp/tiktoken-audit python3 run-experiment.py \
  --mmmlu-dir data/mmmlu \
  --mmlu-test-dir data/mmlu/test \
  --human-eval data/HumanEval.jsonl.gz
python3 render-figure.py
sha256sum config.json raw-results.jsonl results.json source-manifest.json
```

An independent replication should add production traffic, fully localized prompt scaffolds, at least one tokenizer from another provider, and chat-template overhead. It should keep the aligned-question analysis so changes in corpus mix do not masquerade as tokenizer effects.

## Claim boundary

Supported: on this deterministic 1,124-question panel, `o200k_base` reduced translated-to-English token ratios in all 14 locales, cut median inflation by 35.31 percentage points, and left HumanEval token count effectively unchanged.

Supported negative result: multilingual compression did not transfer to the code control, and substantial language-specific inflation remained under the newer encoding. The four-character proxy remained too inaccurate for tight budgeting, especially for Japanese, Chinese, Korean, and Yoruba.

Not supported: that `o200k_base` improves answer quality, is cheapest in a provider bill, is fastest at inference, removes multilingual inequity, or outperforms tokenizers not tested here.

The practical conclusion is narrower and more useful: token budgets are empirical properties of a tokenizer and workload pair. Measure that pair before pricing, truncating, or promising equal capacity across languages.

## Source ledger

- September 2024 dataset release — [OpenAI MMMLU](https://huggingface.co/datasets/openai/MMMLU): 14 professionally translated locales and MIT-licensed CSVs.
- January 2021 paper — [MMLU](https://arxiv.org/abs/2009.03300): 57-subject English source benchmark and design.
- Current pinned implementation — [OpenAI tiktoken](https://github.com/openai/tiktoken): tokenizer code and model-to-encoding mappings.
- May 15, 2026 — [tiktoken 0.13.0](https://pypi.org/project/tiktoken/): exact package release used in the run.
- July 2021 paper and current repository — [HumanEval](https://github.com/openai/human-eval): 164 code prompts used as a boundary control.
- September 5, 2025 — [The Token Tax](https://arxiv.org/abs/2509.05486): multilingual fertility, cost, and accuracy evidence.
- January 19, 2026 — [The Script Tax](https://arxiv.org/abs/2602.11174): orthography-conditioned efficiency evidence.
- Current conventions — [OpenTelemetry GenAI attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/): portable provider and token-usage telemetry fields.
