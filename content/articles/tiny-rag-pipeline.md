---
title: Build a Tiny RAG Pipeline in Python
description: Implement chunking, retrieval, prompt assembly, and grounded answer boundaries without hiding the mechanics behind a framework.
topic: RAG
level: Intermediate
date: 2026-06-27
readingTime: 24
tags: rag, retrieval, embeddings, python
image: /content/v1/assets/tiny-rag-pipeline.svg
imageAlt: RAG pipeline diagram showing chunking, vector retrieval, prompt assembly, and cited answers
---

Retrieval-augmented generation is useful when the model should answer from a controlled knowledge source instead of relying only on its parameters. This tutorial builds the smallest useful RAG pipeline: split documents, index chunks, retrieve candidates, assemble a prompt, and preserve source references.

## What We Are Building

The system accepts a user question and a small document collection. It returns the top matching passages and a prompt that can be sent to a language model.

For production systems, replace the toy embedder with a real embedding model and replace the in-memory list with a vector database. The interfaces remain the same.

## Prepare Documents

Start with plain records. Keep metadata close to every chunk so citations survive indexing and retrieval.

```python
documents = [
    {
        "id": "rag-notes",
        "title": "RAG Notes",
        "text": "RAG combines retrieval with generation. Retrieval supplies relevant context. Generation turns context into a final answer."
    },
    {
        "id": "eval-notes",
        "title": "Evaluation Notes",
        "text": "A good RAG evaluation checks answer correctness, citation support, context precision, and refusal behavior."
    },
]
```

## Chunk the Text

Chunking is an information preservation problem. Very small chunks lose context. Very large chunks reduce retrieval precision.

```python
def chunk_words(text, size=28, overlap=6):
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start = max(0, end - overlap)
    return chunks


records = []
for doc in documents:
    for index, chunk in enumerate(chunk_words(doc["text"])):
        records.append({
            "chunk_id": f"{doc['id']}:{index}",
            "document_id": doc["id"],
            "title": doc["title"],
            "text": chunk,
        })
```

## Use a Transparent Toy Embedder

This embedder is not semantically strong, but it is useful for learning because every score is inspectable.

```python
import math
import re
from collections import Counter


def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def embed(text):
    return Counter(tokenize(text))


def cosine(left, right):
    shared = set(left) & set(right)
    numerator = sum(left[token] * right[token] for token in shared)
    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return numerator / (left_norm * right_norm)


index = [{**record, "vector": embed(record["text"])} for record in records]
```

## Retrieve Context

Return more than one passage and keep the scores. Scores are not proof of correctness, but they help debug retrieval drift.

```python
def retrieve(question, top_k=2):
    query = embed(question)
    ranked = sorted(
        (
            {**record, "score": cosine(query, record["vector"])}
            for record in index
        ),
        key=lambda item: item["score"],
        reverse=True,
    )
    return ranked[:top_k]


matches = retrieve("How should I evaluate a RAG system?")
for match in matches:
    print(round(match["score"], 3), match["chunk_id"], match["text"])
```

```output
0.463 eval-notes:0 A good RAG evaluation checks answer correctness, citation support, context precision, and refusal behavior.
0.258 rag-notes:0 RAG combines retrieval with generation. Retrieval supplies relevant context. Generation turns context into a final answer.
```

## Build a Grounded Prompt

The prompt should make the boundary explicit: answer only from the retrieved context and cite the source IDs.

```python
def build_prompt(question, matches):
    context = "\n\n".join(
        f"[{item['chunk_id']}] {item['text']}"
        for item in matches
    )
    return f"""You answer using only the context below.
If the context is insufficient, say what is missing.
Cite chunk ids in square brackets.

Context:
{context}

Question: {question}
Answer:"""


print(build_prompt("How should I evaluate a RAG system?", matches))
```

## Add a Minimal Refusal Check

Before generation, detect when retrieval has no useful support. This is cheaper than asking the model to repair a bad context window.

```python
def should_answer(matches, threshold=0.15):
    return bool(matches) and matches[0]["score"] >= threshold


if not should_answer(matches):
    print("I do not have enough retrieved context to answer.")
else:
    print("Send prompt to the model.")
```

## Production Extensions

Replace each toy component independently:

- Use a real embedding model for `embed`.
- Store vectors in a vector index.
- Add reranking after first-stage retrieval.
- Log retrieved context and generated citations for evaluation.
- Build test questions with known supporting passages.

The key design constraint is reproducibility. Keep chunk IDs stable, keep retrieval scores observable, and evaluate retrieval separately from final answer quality.
