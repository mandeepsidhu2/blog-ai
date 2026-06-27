---
title: Implement Scaled Dot-Product Attention
description: Build attention from tensors, inspect the shapes, and understand why masking and scaling matter.
topic: Transformers
level: Intermediate
date: 2026-06-27
readingTime: 21
tags: transformers, attention, tensors, python
---

Transformers are built around attention. The mechanism is compact, but mistakes in tensor shapes, masking, and scaling can silently break training. This tutorial implements scaled dot-product attention from first principles.

## Attention Inputs

Attention starts with three tensors:

- Queries decide what each position is looking for.
- Keys describe what each position offers.
- Values contain the information to mix.

The standard single-head shape is `[sequence, width]`.

```python
queries = [
    [1.0, 0.0, 0.5],
    [0.2, 1.0, 0.3],
]

keys = [
    [1.0, 0.1, 0.4],
    [0.0, 1.0, 0.2],
]

values = [
    [10.0, 0.0],
    [0.0, 20.0],
]
```

## Compute Scores

Each query is compared with every key. The result is a score matrix shaped `[query_positions, key_positions]`.

```python
import math


def dot(left, right):
    return sum(a * b for a, b in zip(left, right))


def score_matrix(queries, keys):
    width = len(keys[0])
    scale = math.sqrt(width)
    return [
        [dot(query, key) / scale for key in keys]
        for query in queries
    ]


scores = score_matrix(queries, keys)
print(scores)
```

```output
[[0.6928203230275509, 0.05773502691896258], [0.18475208614068028, 0.6110100926607787]]
```

## Convert Scores to Weights

Softmax turns raw scores into a distribution over positions. Subtracting the max keeps the calculation numerically stable.

```python
def softmax(row):
    shifted = [value - max(row) for value in row]
    exp_values = [math.exp(value) for value in shifted]
    total = sum(exp_values)
    return [value / total for value in exp_values]


weights = [softmax(row) for row in scores]
print([[round(value, 3) for value in row] for row in weights])
```

```output
[[0.654, 0.346], [0.395, 0.605]]
```

## Mix Values

The output at each position is a weighted sum of the value vectors.

```python
def weighted_sum(weights, values):
    outputs = []
    for row in weights:
        mixed = [0.0 for _ in values[0]]
        for weight, value in zip(row, values):
            for dim, component in enumerate(value):
                mixed[dim] += weight * component
        outputs.append(mixed)
    return outputs


outputs = weighted_sum(weights, values)
print([[round(value, 2) for value in row] for row in outputs])
```

```output
[[6.54, 6.92], [3.95, 12.1]]
```

## Add a Causal Mask

Language models should not attend to future tokens during training. A causal mask sets forbidden positions to negative infinity before softmax.

```python
def apply_causal_mask(scores):
    masked = []
    for query_index, row in enumerate(scores):
        masked_row = []
        for key_index, value in enumerate(row):
            if key_index > query_index:
                masked_row.append(float("-inf"))
            else:
                masked_row.append(value)
        masked.append(masked_row)
    return masked


masked_scores = apply_causal_mask(scores)
masked_weights = [softmax(row) for row in masked_scores]
print(masked_weights)
```

```output
[[1.0, 0.0], [0.394, 0.606]]
```

## Why Scaling Matters

Without the square-root scaling, dot products grow as the hidden width grows. Large logits make softmax too sharp, which can reduce gradient signal early in training.

The scaling term is simple:

```python
scaled_score = dot(query, key) / math.sqrt(hidden_width)
```

## Where Multi-Head Attention Fits

Multi-head attention repeats this process with different learned projections. Each head can focus on different relations, then the outputs are concatenated and projected back to the model width.

When debugging a transformer implementation, verify these invariants first:

- attention weights sum to 1 along the key dimension.
- causal masks block future positions.
- batch, head, sequence, and width axes stay in the expected order.
- dropout is disabled during deterministic tests.
