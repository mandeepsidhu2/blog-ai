---
title: Model a Support Triage Workflow with LangGraph Concepts
description: Design a graph-shaped agent workflow with typed state, explicit nodes, conditional edges, and resumable execution.
topic: LangGraph
level: Intermediate
date: 2026-06-27
readingTime: 23
tags: langgraph, workflow, agents, state-machines
---

Graph-shaped agent workflows are useful when a task has distinct phases: classify, retrieve, decide, act, and review. This tutorial models a support triage workflow using LangGraph-style concepts while keeping the code dependency-free.

The goal is to understand the architecture before adopting a framework.

## Define State

Use a single state object that flows through every node. Each node reads a subset and writes a subset.

```python
from dataclasses import dataclass, field


@dataclass
class TriageState:
    ticket_id: str
    message: str
    category: str | None = None
    priority: str | None = None
    suggested_reply: str | None = None
    requires_human: bool = False
    events: list[str] = field(default_factory=list)
```

## Write Nodes as Pure Functions

Pure nodes are easier to test. External side effects should be isolated behind tool boundaries.

```python
def classify(state: TriageState) -> TriageState:
    text = state.message.lower()
    if "invoice" in text or "billing" in text:
        state.category = "billing"
    elif "error" in text or "broken" in text:
        state.category = "technical"
    else:
        state.category = "general"
    state.events.append(f"classified:{state.category}")
    return state


def prioritize(state: TriageState) -> TriageState:
    urgent_terms = ["blocked", "down", "urgent", "production"]
    state.priority = "high" if any(term in state.message.lower() for term in urgent_terms) else "normal"
    state.events.append(f"priority:{state.priority}")
    return state
```

## Add Conditional Edges

The router decides what happens next. This is the heart of graph orchestration.

```python
def route_after_priority(state: TriageState) -> str:
    if state.priority == "high":
        return "human_review"
    if state.category == "billing":
        return "draft_billing_reply"
    return "draft_general_reply"
```

## Implement Action Nodes

Action nodes can still be deterministic in a tutorial. In production, these could call retrieval, a model, or a ticketing API.

```python
def human_review(state: TriageState) -> TriageState:
    state.requires_human = True
    state.suggested_reply = "A specialist will review this ticket."
    state.events.append("routed:human")
    return state


def draft_billing_reply(state: TriageState) -> TriageState:
    state.suggested_reply = "Thanks for reaching out. Please attach the invoice ID so we can inspect the billing record."
    state.events.append("drafted:billing")
    return state


def draft_general_reply(state: TriageState) -> TriageState:
    state.suggested_reply = "Thanks for the report. We will review the details and follow up."
    state.events.append("drafted:general")
    return state
```

## Run the Graph

Represent the graph as a small executor. Frameworks add persistence, retries, streaming, and visualization, but the core idea is a state machine.

```python
def run_triage(state: TriageState) -> TriageState:
    state = classify(state)
    state = prioritize(state)

    next_node = route_after_priority(state)
    if next_node == "human_review":
        return human_review(state)
    if next_node == "draft_billing_reply":
        return draft_billing_reply(state)
    return draft_general_reply(state)


ticket = TriageState(
    ticket_id="T-1042",
    message="Production checkout is down and invoices are failing.",
)

result = run_triage(ticket)
print(result)
```

```output
TriageState(ticket_id='T-1042', message='Production checkout is down and invoices are failing.', category='billing', priority='high', suggested_reply='A specialist will review this ticket.', requires_human=True, events=['classified:billing', 'priority:high', 'routed:human'])
```

## Where LangGraph Helps

Once the workflow grows, a graph framework helps with:

- checkpointing state between nodes.
- resuming after human review.
- streaming intermediate events.
- visualizing conditional paths.
- composing subgraphs for repeated workflows.

The research discipline is to compare graph workflows against simpler baselines. Measure resolution accuracy, escalation precision, average steps, and human correction rate.
