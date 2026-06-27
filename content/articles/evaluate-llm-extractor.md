---
title: Evaluate an LLM JSON Extractor
description: Build a small benchmark for structured extraction with exact-match, field-level, and schema-validity metrics.
topic: Evaluation
level: Intermediate
date: 2026-06-27
readingTime: 22
tags: evaluation, json, llm, testing
image: /content/v1/assets/evaluate-llm-extractor.svg
imageAlt: LLM JSON extractor evaluation diagram showing test cases, schema checks, and quality metrics
---

Structured extraction looks easy in demos and fails quietly in production. A good extractor evaluation separates three questions: did the model return valid JSON, did it follow the schema, and did it extract the correct values?

This tutorial builds a tiny benchmark harness.

## Create Test Cases

Keep the target output explicit. Add hard negatives where fields are missing.

```python
cases = [
    {
        "input": "Order 812 ships to Ada Lovelace at ada@example.com on July 9.",
        "expected": {
            "order_id": "812",
            "customer": "Ada Lovelace",
            "email": "ada@example.com",
            "ship_date": "July 9",
        },
    },
    {
        "input": "Grace asked for a quote but did not provide an email.",
        "expected": {
            "order_id": None,
            "customer": "Grace",
            "email": None,
            "ship_date": None,
        },
    },
]
```

## Simulate Extractor Output

In a real benchmark, replace this function with your model call. Keep the return value as raw text so JSON failures are visible.

```python
def extractor(text):
    if "812" in text:
        return '{"order_id":"812","customer":"Ada Lovelace","email":"ada@example.com","ship_date":"July 9"}'
    return '{"order_id":null,"customer":"Grace","email":null,"ship_date":null}'
```

## Validate JSON and Schema

Use explicit required fields. A response can be valid JSON and still fail the schema.

```python
import json


required_fields = {"order_id", "customer", "email", "ship_date"}


def parse_response(raw):
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None, {"valid_json": False, "schema_valid": False}

    schema_valid = isinstance(data, dict) and required_fields <= set(data)
    return data, {"valid_json": True, "schema_valid": schema_valid}
```

## Score Field Accuracy

Field-level accuracy is more informative than a single exact-match score.

```python
def score_case(case):
    raw = extractor(case["input"])
    predicted, validity = parse_response(raw)

    if not validity["schema_valid"]:
        return {**validity, "field_accuracy": 0.0, "exact_match": False}

    expected = case["expected"]
    correct = sum(
        predicted[field] == expected[field]
        for field in required_fields
    )
    return {
        **validity,
        "field_accuracy": correct / len(required_fields),
        "exact_match": predicted == expected,
    }


scores = [score_case(case) for case in cases]
print(scores)
```

```output
[{'valid_json': True, 'schema_valid': True, 'field_accuracy': 1.0, 'exact_match': True}, {'valid_json': True, 'schema_valid': True, 'field_accuracy': 1.0, 'exact_match': True}]
```

## Aggregate Metrics

Aggregate each failure mode separately. This helps decide whether to improve prompting, decoding, validation, or data coverage.

```python
def average(values):
    return sum(values) / len(values)


summary = {
    "valid_json_rate": average([score["valid_json"] for score in scores]),
    "schema_valid_rate": average([score["schema_valid"] for score in scores]),
    "field_accuracy": average([score["field_accuracy"] for score in scores]),
    "exact_match_rate": average([score["exact_match"] for score in scores]),
}

print(summary)
```

```output
{'valid_json_rate': 1.0, 'schema_valid_rate': 1.0, 'field_accuracy': 1.0, 'exact_match_rate': 1.0}
```

## Production Evaluation Checklist

Useful extractor benchmarks include:

- ambiguous dates.
- missing fields.
- multiple entities.
- adversarial punctuation.
- emails with plus signs.
- inputs that mention JSON-like text.

For publishable or production-grade work, report confidence intervals across multiple seeds or repeated calls when the model is nondeterministic.

Treat the benchmark as a deployment gate. Keep a frozen test set, add a shadow set from recent production traffic after removing sensitive data, and compare every prompt or model change against the previous release. If schema validity, field accuracy, or exact match drops below the threshold, block the release and inspect the failing examples before changing prompts.
