#!/usr/bin/env python3
"""Agent-console data-flow regression tests.

These tests intentionally avoid LangGraph as a runtime dependency. They model the
state merge contract emitted by the console's generated Python and then exercise
the graph shapes users build in the browser: linear flows, branch flows,
fan-out/fan-in flows, custom Python returns, and raw-output accessors.
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any, Callable


STATE_KEYS = {"messages", "artifacts", "data", "cwd", "tool_args", "approvals", "route"}
START = "START"
END = "END"


@dataclass(frozen=True)
class FlowNode:
    id: str
    run: Callable[[dict[str, Any]], Any]
    kind: str = "python"


@dataclass(frozen=True)
class FlowEdge:
    source: str
    target: str
    label: str = "next"


@dataclass(frozen=True)
class FlowCase:
    name: str
    nodes: list[FlowNode]
    edges: list[FlowEdge]
    assert_state: Callable[[dict[str, Any], list[str]], None]
    initial_state: dict[str, Any] | None = None


def state_update(state: dict[str, Any], node_name: str, output: Any) -> dict[str, Any]:
    """Mirror the generated console `_state_update` helper."""

    if output is None:
        output = {}
    update = dict(output) if isinstance(output, dict) else {"data": {node_name: output}}
    artifacts = dict(state.get("artifacts") or {})
    if isinstance(update.get("artifacts"), dict):
        artifacts.update(update["artifacts"])
    node_outputs = dict(artifacts.get("node_outputs") or {})
    node_outputs[node_name] = output
    artifacts["node_outputs"] = node_outputs
    update["artifacts"] = artifacts
    custom_values = {key: value for key, value in update.items() if key not in STATE_KEYS}
    if custom_values or isinstance(update.get("data"), dict):
        data = dict(state.get("data") or {})
        if custom_values:
            data[node_name] = custom_values
        if isinstance(update.get("data"), dict):
            data.update(update["data"])
        update["data"] = data
    return update


def apply_update(state: dict[str, Any], update: dict[str, Any]) -> dict[str, Any]:
    next_state = dict(state)
    next_state.update(update)
    return next_state


def run_flow(flow: FlowCase) -> tuple[dict[str, Any], list[str]]:
    nodes = {node.id: node for node in flow.nodes}
    outgoing: dict[str, list[FlowEdge]] = defaultdict(list)
    for edge in flow.edges:
        outgoing[edge.source].append(edge)

    state = dict(flow.initial_state or {})
    queue: deque[str] = deque(edge.target for edge in outgoing[START])
    ran: set[str] = set()
    order: list[str] = []
    step_limit = 100

    while queue and step_limit > 0:
        step_limit -= 1
        node_id = queue.popleft()
        if node_id == END:
            order.append(END)
            continue
        if node_id in ran:
            continue
        node = nodes[node_id]
        output = node.run(state)
        state = apply_update(state, state_update(state, node.id, output))
        ran.add(node_id)
        order.append(node_id)

        if node.kind == "condition":
            route = output if isinstance(output, str) else state.get("route") or "next"
            branch = next((edge for edge in outgoing[node_id] if edge.label == route), None)
            if branch is None:
                branch = next((edge for edge in outgoing[node_id] if edge.label == "next"), None)
            if branch is not None:
                queue.append(branch.target)
            continue

        queue.extend(edge.target for edge in outgoing[node_id])

    if step_limit <= 0:
        raise AssertionError(f"{flow.name}: graph did not terminate within step limit")
    return state, order


def assert_equal(actual: Any, expected: Any, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def cases() -> list[FlowCase]:
    return [
        FlowCase(
            name="linear_six_step_data_pipeline",
            nodes=[
                FlowNode("parse", lambda state: {"data": {"ticket": "T-100", "priority": 2}}),
                FlowNode("plan", lambda state: {"data": {"plan": f"resolve-{state['data']['ticket']}"}}),
                FlowNode("score", lambda state: {"risk_score": state["data"]["priority"] * 3}),
                FlowNode("validate", lambda state: {"data": {"valid": state["data"]["score"]["risk_score"] < 10}}),
                FlowNode("package", lambda state: {"data": {"package": f"{state['data']['plan']}:ok"}}),
                FlowNode("finish", lambda state: {"data": {"summary": state["data"]["package"]}}),
            ],
            edges=[
                FlowEdge(START, "parse"),
                FlowEdge("parse", "plan"),
                FlowEdge("plan", "score"),
                FlowEdge("score", "validate"),
                FlowEdge("validate", "package"),
                FlowEdge("package", "finish"),
                FlowEdge("finish", END),
            ],
            assert_state=lambda state, order: (
                assert_equal(order, ["parse", "plan", "score", "validate", "package", "finish", END], "linear order"),
                assert_equal(state["data"]["summary"], "resolve-T-100:ok", "linear summary"),
            ),
        ),
        FlowCase(
            name="raw_output_accessor_from_previous_python_node",
            nodes=[
                FlowNode("date_node", lambda state: {"current_date": "2026-06-30"}),
                FlowNode(
                    "reader",
                    lambda state: {
                        "data": {
                            "date_seen": state["artifacts"]["node_outputs"]["date_node"]["current_date"],
                        },
                    },
                ),
            ],
            edges=[FlowEdge(START, "date_node"), FlowEdge("date_node", "reader"), FlowEdge("reader", END)],
            assert_state=lambda state, order: assert_equal(state["data"]["date_seen"], "2026-06-30", "raw output date"),
        ),
        FlowCase(
            name="direct_data_accessor_from_previous_python_node",
            nodes=[
                FlowNode("date_node", lambda state: {"data": {"current_date": "2026-06-30"}}),
                FlowNode("reader", lambda state: {"data": {"date_seen": state["data"]["current_date"]}}),
            ],
            edges=[FlowEdge(START, "date_node"), FlowEdge("date_node", "reader"), FlowEdge("reader", END)],
            assert_state=lambda state, order: assert_equal(state["data"]["date_seen"], "2026-06-30", "direct data date"),
        ),
        FlowCase(
            name="non_dict_return_is_wrapped_under_data_and_node_outputs",
            nodes=[
                FlowNode("number_source", lambda state: 7),
                FlowNode("double", lambda state: {"data": {"double": state["data"]["number_source"] * 2}}),
            ],
            edges=[FlowEdge(START, "number_source"), FlowEdge("number_source", "double"), FlowEdge("double", END)],
            assert_state=lambda state, order: (
                assert_equal(state["data"]["number_source"], 7, "wrapped scalar data"),
                assert_equal(state["artifacts"]["node_outputs"]["number_source"], 7, "wrapped scalar artifact"),
                assert_equal(state["data"]["double"], 14, "wrapped scalar downstream"),
            ),
        ),
        FlowCase(
            name="conditional_approved_branch",
            nodes=[
                FlowNode("collect", lambda state: {"data": {"score": 91}}),
                FlowNode("gate", lambda state: {"route": "approved"}, kind="condition"),
                FlowNode("approve", lambda state: {"data": {"decision": "ship"}}),
                FlowNode("reject", lambda state: {"data": {"decision": "hold"}}),
            ],
            edges=[
                FlowEdge(START, "collect"),
                FlowEdge("collect", "gate"),
                FlowEdge("gate", "approve", "approved"),
                FlowEdge("gate", "reject", "rejected"),
                FlowEdge("approve", END),
                FlowEdge("reject", END),
            ],
            assert_state=lambda state, order: (
                assert_equal(state["data"]["decision"], "ship", "approved decision"),
                assert_equal("reject" in order, False, "rejected branch skipped"),
            ),
        ),
        FlowCase(
            name="conditional_rejected_branch",
            nodes=[
                FlowNode("collect", lambda state: {"data": {"score": 42}}),
                FlowNode("gate", lambda state: {"route": "rejected"}, kind="condition"),
                FlowNode("approve", lambda state: {"data": {"decision": "ship"}}),
                FlowNode("reject", lambda state: {"data": {"decision": "hold"}}),
            ],
            edges=[
                FlowEdge(START, "collect"),
                FlowEdge("collect", "gate"),
                FlowEdge("gate", "approve", "approved"),
                FlowEdge("gate", "reject", "rejected"),
                FlowEdge("approve", END),
                FlowEdge("reject", END),
            ],
            assert_state=lambda state, order: (
                assert_equal(state["data"]["decision"], "hold", "rejected decision"),
                assert_equal("approve" in order, False, "approved branch skipped"),
            ),
        ),
        FlowCase(
            name="condition_string_return_routes_and_is_recorded",
            nodes=[
                FlowNode("gate", lambda state: "retry", kind="condition"),
                FlowNode("retry", lambda state: {"data": {"path": "retry"}}),
                FlowNode("done", lambda state: {"data": {"path": "done"}}),
            ],
            edges=[
                FlowEdge(START, "gate"),
                FlowEdge("gate", "retry", "retry"),
                FlowEdge("gate", "done", "done"),
                FlowEdge("retry", END),
                FlowEdge("done", END),
            ],
            assert_state=lambda state, order: (
                assert_equal(state["data"]["path"], "retry", "string route path"),
                assert_equal(state["data"]["gate"], "retry", "string route stored under data"),
            ),
        ),
        FlowCase(
            name="fanout_then_join_sees_both_parent_outputs",
            nodes=[
                FlowNode("split", lambda state: {"data": {"seed": 5}}),
                FlowNode("alpha", lambda state: {"data": {"alpha": state["data"]["seed"] + 1}}),
                FlowNode("beta", lambda state: {"data": {"beta": state["data"]["seed"] + 2}}),
                FlowNode("join", lambda state: {"data": {"total": state["data"]["alpha"] + state["data"]["beta"]}}),
            ],
            edges=[
                FlowEdge(START, "split"),
                FlowEdge("split", "alpha"),
                FlowEdge("split", "beta"),
                FlowEdge("alpha", "join"),
                FlowEdge("beta", "join"),
                FlowEdge("join", END),
            ],
            assert_state=lambda state, order: assert_equal(state["data"]["total"], 13, "fanout total"),
        ),
        FlowCase(
            name="custom_return_keys_are_node_scoped_in_data",
            nodes=[
                FlowNode("classifier", lambda state: {"label": "ops", "confidence": 0.83}),
                FlowNode("consumer", lambda state: {"data": {"label": state["data"]["classifier"]["label"]}}),
            ],
            edges=[FlowEdge(START, "classifier"), FlowEdge("classifier", "consumer"), FlowEdge("consumer", END)],
            assert_state=lambda state, order: (
                assert_equal(state["data"]["classifier"]["confidence"], 0.83, "custom confidence"),
                assert_equal(state["data"]["label"], "ops", "custom label downstream"),
            ),
        ),
        FlowCase(
            name="artifacts_merge_shallowly_and_keep_all_node_outputs",
            nodes=[
                FlowNode("first", lambda state: {"artifacts": {"trace": {"first": True}}}),
                FlowNode("second", lambda state: {"artifacts": {"trace": {"second": True}}}),
                FlowNode("reader", lambda state: {"data": {"trace": state["artifacts"]["trace"]}}),
            ],
            edges=[FlowEdge(START, "first"), FlowEdge("first", "second"), FlowEdge("second", "reader"), FlowEdge("reader", END)],
            assert_state=lambda state, order: (
                assert_equal(state["data"]["trace"], {"second": True}, "shallow artifact merge"),
                assert_equal(sorted(state["artifacts"]["node_outputs"]), ["first", "reader", "second"], "node output registry"),
            ),
        ),
        FlowCase(
            name="six_step_dummy_agent_flow_with_validation_gate",
            nodes=[
                FlowNode("ingest", lambda state: {"data": {"items": ["a", "b", "c"]}}),
                FlowNode("normalize", lambda state: {"data": {"items": [item.upper() for item in state["data"]["items"]]}}),
                FlowNode("summarize", lambda state: {"summary": ",".join(state["data"]["items"])}),
                FlowNode("validate", lambda state: {"route": "ok"}, kind="condition"),
                FlowNode("package", lambda state: {"data": {"payload": state["data"]["summarize"]["summary"]}}),
                FlowNode("complete", lambda state: {"data": {"status": f"ready:{state['data']['payload']}"}}),
            ],
            edges=[
                FlowEdge(START, "ingest"),
                FlowEdge("ingest", "normalize"),
                FlowEdge("normalize", "summarize"),
                FlowEdge("summarize", "validate"),
                FlowEdge("validate", "package", "ok"),
                FlowEdge("package", "complete"),
                FlowEdge("complete", END),
            ],
            assert_state=lambda state, order: assert_equal(state["data"]["status"], "ready:A,B,C", "dummy agent status"),
        ),
        FlowCase(
            name="retargeted_source_flow_uses_new_parent_output",
            nodes=[
                FlowNode("replacement_source", lambda state: {"data": {"source_value": "new-parent"}}),
                FlowNode("consumer", lambda state: {"data": {"consumed": state["data"]["source_value"]}}),
            ],
            edges=[FlowEdge(START, "replacement_source"), FlowEdge("replacement_source", "consumer"), FlowEdge("consumer", END)],
            assert_state=lambda state, order: assert_equal(state["data"]["consumed"], "new-parent", "retargeted source value"),
        ),
        FlowCase(
            name="selected_branch_to_join_does_not_require_inactive_parent",
            nodes=[
                FlowNode("gate", lambda state: {"route": "left"}, kind="condition"),
                FlowNode("left", lambda state: {"data": {"branch_value": "left"}}),
                FlowNode("right", lambda state: {"data": {"branch_value": "right"}}),
                FlowNode("join", lambda state: {"data": {"joined": state["data"]["branch_value"]}}),
            ],
            edges=[
                FlowEdge(START, "gate"),
                FlowEdge("gate", "left", "left"),
                FlowEdge("gate", "right", "right"),
                FlowEdge("left", "join"),
                FlowEdge("right", "join"),
                FlowEdge("join", END),
            ],
            assert_state=lambda state, order: (
                assert_equal(state["data"]["joined"], "left", "selected branch join"),
                assert_equal("right" in order, False, "inactive branch skipped before join"),
            ),
        ),
        FlowCase(
            name="state_key_updates_survive_multiple_nodes",
            nodes=[
                FlowNode("set_cwd", lambda state: {"cwd": "/tmp/work", "tool_args": {"tool_a": {"x": 1}}}),
                FlowNode("set_approval", lambda state: {"approvals": {"tool_a": True}}),
                FlowNode("reader", lambda state: {"data": {"ready": state["cwd"].endswith("work") and state["approvals"]["tool_a"]}}),
            ],
            edges=[FlowEdge(START, "set_cwd"), FlowEdge("set_cwd", "set_approval"), FlowEdge("set_approval", "reader"), FlowEdge("reader", END)],
            assert_state=lambda state, order: assert_equal(state["data"]["ready"], True, "state keys downstream"),
        ),
        FlowCase(
            name="none_return_still_records_node_output_and_preserves_data",
            nodes=[
                FlowNode("seed", lambda state: {"data": {"value": 10}}),
                FlowNode("noop", lambda state: None),
                FlowNode("after", lambda state: {"data": {"value_after_noop": state["data"]["value"]}}),
            ],
            edges=[FlowEdge(START, "seed"), FlowEdge("seed", "noop"), FlowEdge("noop", "after"), FlowEdge("after", END)],
            assert_state=lambda state, order: (
                assert_equal(state["data"]["value_after_noop"], 10, "noop preserved data"),
                assert_equal(state["artifacts"]["node_outputs"]["noop"], {}, "noop recorded as empty output"),
            ),
        ),
    ]


def main() -> int:
    failures: list[str] = []
    for flow in cases():
        try:
            state, order = run_flow(flow)
            flow.assert_state(state, order)
            print(f"PASS {flow.name}")
        except Exception as exc:  # noqa: BLE001 - this is a tiny test runner.
            failures.append(f"FAIL {flow.name}: {exc}")
            print(failures[-1])

    print(f"\n{len(cases()) - len(failures)}/{len(cases())} agent-console data-flow cases passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
