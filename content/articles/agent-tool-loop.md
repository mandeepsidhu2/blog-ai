---
title: Build a Minimal Agent Tool Loop
description: Implement a small agent runtime with explicit tool schemas, trace logging, and bounded execution.
topic: Agents
level: Intermediate
date: 2026-06-27
readingTime: 20
tags: agents, tools, orchestration, python
image: /content/v1/assets/agent-tool-loop.svg
imageAlt: Agent tool loop diagram showing model decisions, tool execution, tracing, and stop conditions
---

An agent is a loop around a model, tools, state, and stopping conditions. The difficult part is not the loop itself. The difficult part is making each step observable, bounded, and testable.

This tutorial builds the runtime skeleton without depending on a specific model provider.

## Define Tool Contracts

Tools need stable names, descriptions, input fields, and return types. Treat them as public APIs.

```python
from dataclasses import dataclass
from typing import Callable


@dataclass
class Tool:
    name: str
    description: str
    run: Callable[[dict], dict]


def calculator(args):
    expression = args["expression"]
    allowed = set("0123456789+-*/(). ")
    if any(char not in allowed for char in expression):
        return {"error": "expression contains unsupported characters"}
    return {"result": eval(expression, {"__builtins__": {}})}


tools = {
    "calculator": Tool(
        name="calculator",
        description="Evaluate a basic arithmetic expression.",
        run=calculator,
    )
}
```

## Represent Model Decisions

Keep the model response format explicit. The model can either ask for a tool call or produce a final answer.

```python
def mock_model(messages):
    last = messages[-1]["content"]
    if "13 * 17" in last:
        return {
            "type": "tool_call",
            "tool": "calculator",
            "args": {"expression": "13 * 17"},
        }
    return {
        "type": "final",
        "answer": "I can answer directly from the provided context.",
    }
```

## Execute the Loop

Bound the number of steps. Persist every action in a trace so failures can be replayed.

```python
def run_agent(question, max_steps=4):
    messages = [{"role": "user", "content": question}]
    trace = []

    for step in range(max_steps):
        decision = mock_model(messages)
        trace.append({"step": step, "decision": decision})

        if decision["type"] == "final":
            return {"answer": decision["answer"], "trace": trace}

        if decision["type"] != "tool_call":
            return {"answer": "Unsupported model action.", "trace": trace}

        tool = tools.get(decision["tool"])
        if tool is None:
            return {"answer": f"Unknown tool: {decision['tool']}", "trace": trace}

        result = tool.run(decision["args"])
        trace.append({"step": step, "tool_result": result})
        messages.append({
            "role": "tool",
            "name": tool.name,
            "content": str(result),
        })

    return {"answer": "Stopped because the step limit was reached.", "trace": trace}


result = run_agent("What is 13 * 17?")
print(result["trace"])
```

```output
[{'step': 0, 'decision': {'type': 'tool_call', 'tool': 'calculator', 'args': {'expression': '13 * 17'}}}, {'step': 0, 'tool_result': {'result': 221}}, {'step': 1, 'decision': {'type': 'tool_call', 'tool': 'calculator', 'args': {'expression': '13 * 17'}}}, ...]
```

## Add a Stop Condition

The mock model above repeats itself because it never reads the tool result. A real agent must include the tool result in the next model prompt and stop once the answer is known.

```python
def better_mock_model(messages):
    if messages[-1]["role"] == "tool":
        return {
            "type": "final",
            "answer": f"The result is {messages[-1]['content']}.",
        }
    return {
        "type": "tool_call",
        "tool": "calculator",
        "args": {"expression": "13 * 17"},
    }
```

## Production Guardrails

Add these controls before connecting real tools:

- Step limits and timeouts.
- Tool input validation.
- Tool allowlists per user or route.
- Idempotency keys for write operations.
- Trace IDs for logs.
- Tests for tool selection and refusal behavior.

An agent should be evaluated as a system. Measure success rate, average steps, tool error rate, invalid action rate, and cost per completed task.
