const nodeKinds = {
  start: { glyph: "S", label: "Start", description: "Entry point for the graph." },
  end: { glyph: "E", label: "End", description: "Terminal state for the graph." },
  step: { glyph: "N", label: "Step", description: "A normal LangGraph node." },
  tool: { glyph: "T", label: "Tool", description: "A node that calls selected tools." },
  condition: { glyph: "?", label: "Conditional", description: "A router node with named branches." },
};

const fallbackToolCatalog = [
  {
    id: "git_status",
    name: "Git status",
    category: "Git",
    description: "Show the short working tree status for the current repository.",
    command: ["git", "status", "--short"],
    defaults: {},
    mutates: false,
  },
  {
    id: "aws_sts_identity",
    name: "AWS caller identity",
    category: "AWS",
    description: "Show the active AWS account, ARN, and user identity.",
    command: ["aws", "sts", "get-caller-identity"],
    defaults: {},
    mutates: false,
  },
  {
    id: "terraform_validate",
    name: "Terraform validate",
    category: "Terraform",
    description: "Validate Terraform configuration syntax and provider schemas.",
    command: ["terraform", "validate"],
    defaults: {},
    mutates: false,
  },
  {
    id: "npm_test",
    name: "npm test",
    category: "NPM",
    description: "Run the project test script.",
    command: ["npm", "test"],
    defaults: {},
    mutates: false,
  },
];
const canvasSize = { width: 1500, height: 980 };
const defaultNodeX = 645;
const zoomRange = { min: 0.55, max: 1.55, step: 0.1 };
const nodeFallbackSize = { width: 210, height: 104 };

const state = {
  nodes: createInitialNodes(),
  edges: [{ id: "edge-start-end", from: "start", to: "end", label: "next" }],
  toolCatalog: [...fallbackToolCatalog],
  customTools: [],
  toolFilter: "",
  toolCategory: "all",
  catalogError: "",
  selectedNodeId: "start",
  selectedEdgeId: null,
  connectSourceId: null,
  connectionDraft: null,
  zoom: 1,
  suppressNextPaletteClick: false,
  suppressNextPortClick: false,
  suppressMouseUntil: 0,
  nextNodeNumber: 1,
  history: {
    undo: [],
    redo: [],
    limit: 80,
  },
};

const els = {};

function byId(id) {
  return document.getElementById(id);
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function sanitizeIdentifier(value, fallback = "node") {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]+/, "");
  return cleaned || fallback;
}

function uniquePythonName(node, used) {
  const base = sanitizeIdentifier(node.title, node.kind);
  let name = base;
  let suffix = 2;
  while (used.has(name) || ["start", "end", "state", "graph", "app"].includes(name)) {
    name = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(name);
  return name;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nodeById(id) {
  return state.nodes.find((node) => node.id === id) || null;
}

function edgeById(id) {
  return state.edges.find((edge) => edge.id === id) || null;
}

function normalizeTool(rawTool) {
  const name = String(rawTool?.name || rawTool?.id || "Tool").trim();
  const id = sanitizeIdentifier(rawTool?.id || name, "tool");
  const category = String(rawTool?.category || "Custom").trim() || "Custom";
  const command = Array.isArray(rawTool?.command) ? rawTool.command.map((part) => String(part)) : [];
  const defaults =
    rawTool?.defaults && typeof rawTool.defaults === "object" && !Array.isArray(rawTool.defaults)
      ? Object.fromEntries(Object.entries(rawTool.defaults).map(([key, value]) => [key, String(value)]))
      : {};

  return {
    id,
    name,
    category,
    description: String(rawTool?.description || "").trim(),
    command,
    defaults,
    mutates: Boolean(rawTool?.mutates),
    custom: Boolean(rawTool?.custom),
  };
}

function allTools() {
  const seen = new Set();
  return [...state.toolCatalog, ...state.customTools]
    .map(normalizeTool)
    .filter((tool) => {
      if (seen.has(tool.id)) return false;
      seen.add(tool.id);
      return true;
    });
}

function toolById(id) {
  return allTools().find((tool) => tool.id === id) || null;
}

function toolLabel(id) {
  return toolById(id)?.name || id;
}

function toolCommandLabel(tool) {
  if (!tool?.command?.length) return "custom";
  return tool.command.slice(0, 3).join(" ");
}

function toolCategories() {
  return [...new Set(allTools().map((tool) => tool.category))].sort((a, b) => a.localeCompare(b));
}

function toolMatchesFilter(tool) {
  const categoryMatches = state.toolCategory === "all" || tool.category === state.toolCategory;
  if (!categoryMatches) return false;
  const query = state.toolFilter.trim().toLowerCase();
  if (!query) return true;
  return [tool.name, tool.category, tool.description, tool.command.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function filteredTools() {
  return allTools().filter(toolMatchesFilter);
}

function centerOf(node) {
  const bounds = nodeBounds(node);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function nodeBounds(node) {
  const element = els.nodeLayer?.querySelector?.(`.node-card[data-id="${cssEscape(node.id)}"]`);
  return {
    x: node.x,
    y: node.y,
    width: element?.offsetWidth || nodeFallbackSize.width,
    height: element?.offsetHeight || nodeFallbackSize.height,
  };
}

function anchorPoint(node, otherPoint) {
  const bounds = nodeBounds(node);
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const dx = otherPoint.x - center.x;
  const dy = otherPoint.y - center.y;

  if (Math.abs(dy) >= Math.abs(dx)) {
    return {
      x: center.x,
      y: dy >= 0 ? bounds.y + bounds.height : bounds.y,
      side: dy >= 0 ? "bottom" : "top",
    };
  }

  return {
    x: dx >= 0 ? bounds.x + bounds.width : bounds.x,
    y: center.y,
    side: dx >= 0 ? "right" : "left",
  };
}

function edgeAnchors(from, to) {
  const toCenter = centerOf(to);
  const fromCenter = centerOf(from);
  return {
    start: anchorPoint(from, toCenter),
    end: anchorPoint(to, fromCenter),
  };
}

function edgeCurve(start, end) {
  const vertical = Math.abs(end.y - start.y) >= Math.abs(end.x - start.x);
  if (vertical) {
    const direction = end.y >= start.y ? 1 : -1;
    const controlOffset = Math.max(70, Math.abs(end.y - start.y) * 0.28);
    return {
      path: `M ${start.x} ${start.y} C ${start.x} ${start.y + direction * controlOffset}, ${end.x} ${end.y - direction * controlOffset}, ${end.x} ${end.y}`,
      labelX: (start.x + end.x) / 2 + 24,
      labelY: (start.y + end.y) / 2,
    };
  }

  const controlOffset = Math.max(70, Math.abs(end.x - start.x) * 0.24);
  return {
    path: `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${end.x - controlOffset} ${end.y}, ${end.x} ${end.y}`,
    labelX: (start.x + end.x) / 2,
    labelY: (start.y + end.y) / 2 - 10,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function canvasPointFromClient(clientX, clientY) {
  const rect = els.canvasFrame.getBoundingClientRect();
  return {
    x: clamp((clientX - rect.left + els.canvasFrame.scrollLeft) / state.zoom, 20, canvasSize.width - 230),
    y: clamp((clientY - rect.top + els.canvasFrame.scrollTop) / state.zoom, 20, canvasSize.height - 130),
  };
}

function createInitialNodes() {
  return [
    {
      id: "start",
      kind: "start",
      title: "Start",
      detail: "Initial workflow state.",
      x: defaultNodeX,
      y: 70,
      tools: [],
      condition: "",
      branches: ["next"],
    },
    {
      id: "end",
      kind: "end",
      title: "End",
      detail: "Compiled graph returns here.",
      x: defaultNodeX,
      y: 810,
      tools: [],
      condition: "",
      branches: ["done"],
    },
  ];
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function graphSnapshot() {
  return {
    nodes: cloneValue(state.nodes),
    edges: cloneValue(state.edges),
    customTools: cloneValue(state.customTools),
    selectedNodeId: state.selectedNodeId,
    selectedEdgeId: state.selectedEdgeId,
    nextNodeNumber: state.nextNodeNumber,
  };
}

function pushHistorySnapshot(snapshot = graphSnapshot()) {
  state.history.undo.push(snapshot);
  if (state.history.undo.length > state.history.limit) {
    state.history.undo.shift();
  }
  state.history.redo = [];
}

function restoreGraphSnapshot(snapshot) {
  state.nodes = cloneValue(snapshot.nodes);
  state.edges = cloneValue(snapshot.edges);
  state.customTools = cloneValue(snapshot.customTools || []);
  state.nextNodeNumber = snapshot.nextNodeNumber;
  state.selectedNodeId = state.nodes.some((node) => node.id === snapshot.selectedNodeId)
    ? snapshot.selectedNodeId
    : null;
  state.selectedEdgeId = state.edges.some((edge) => edge.id === snapshot.selectedEdgeId)
    ? snapshot.selectedEdgeId
    : null;
  state.connectSourceId = null;
  state.connectionDraft = null;
  render();
}

function undoGraph() {
  const previous = state.history.undo.pop();
  if (!previous) return;
  state.history.redo.push(graphSnapshot());
  restoreGraphSnapshot(previous);
}

function redoGraph() {
  const next = state.history.redo.pop();
  if (!next) return;
  state.history.undo.push(graphSnapshot());
  restoreGraphSnapshot(next);
}

function isEditableTarget(target) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
}

function clearSelection() {
  state.selectedNodeId = null;
  state.selectedEdgeId = null;
}

function selectNode(id) {
  state.selectedNodeId = id;
  state.selectedEdgeId = null;
  render();
}

function selectEdge(id) {
  state.selectedEdgeId = id;
  state.selectedNodeId = null;
  render();
}

function nextPosition() {
  const count = state.nodes.filter((node) => !["start", "end"].includes(node.kind)).length;
  return {
    x: defaultNodeX + Math.floor(count / 4) * 260,
    y: 220 + (count % 4) * 140,
  };
}

function addNode(kind, position = nextPosition()) {
  pushHistorySnapshot();
  const id = `${kind}-${Date.now().toString(36)}-${state.nextNodeNumber}`;
  const number = state.nextNodeNumber;
  state.nextNodeNumber += 1;
  state.nodes.push({
    id,
    kind,
    title: `${nodeKinds[kind].label} ${number}`,
    detail:
      kind === "condition"
        ? "Route state into named branches."
        : kind === "tool"
          ? "Call selected tools and return state updates."
          : "Transform state and return updates.",
    x: position.x,
    y: position.y,
    tools: kind === "tool" ? [allTools()[0]?.id].filter(Boolean) : [],
    condition: kind === "condition" ? "return 'yes' when the state is ready" : "",
    branches: kind === "condition" ? ["yes", "no"] : ["next"],
  });
  selectNode(id);
}

function removeSelected() {
  if (state.selectedNodeId) {
    const node = nodeById(state.selectedNodeId);
    if (!node || node.kind === "start" || node.kind === "end") return;
    pushHistorySnapshot();
    state.nodes = state.nodes.filter((item) => item.id !== node.id);
    state.edges = state.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id);
    clearSelection();
    render();
    return;
  }

  if (state.selectedEdgeId) {
    pushHistorySnapshot();
    state.edges = state.edges.filter((edge) => edge.id !== state.selectedEdgeId);
    clearSelection();
    render();
  }
}

function addEdge(from, to) {
  if (!from || !to || from === to) return;
  if (state.edges.some((edge) => edge.from === from && edge.to === to)) return;
  pushHistorySnapshot();
  const source = nodeById(from);
  const label = source?.kind === "condition" ? firstUnusedBranch(source) : "next";
  const id = `edge-${from}-${to}-${Date.now().toString(36)}`;
  state.edges.push({ id, from, to, label });
  state.connectSourceId = null;
  selectEdge(id);
}

function firstUnusedBranch(node) {
  const used = new Set(state.edges.filter((edge) => edge.from === node.id).map((edge) => edge.label));
  return node.branches.find((branch) => !used.has(branch)) || node.branches[0] || "next";
}

function updateNode(id, patch) {
  const node = nodeById(id);
  if (!node) return;
  pushHistorySnapshot();
  Object.assign(node, patch);
  render();
}

function updateEdge(id, patch) {
  const edge = edgeById(id);
  if (!edge) return;
  pushHistorySnapshot();
  Object.assign(edge, patch);
  render();
}

function addCustomTool(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const idBase = `custom_${sanitizeIdentifier(trimmed, "tool")}`;
  let id = idBase;
  let suffix = 2;
  const existingIds = new Set(allTools().map((tool) => tool.id));
  while (existingIds.has(id)) {
    id = `${idBase}_${suffix}`;
    suffix += 1;
  }
  const exists = allTools().some((tool) => tool.name.toLowerCase() === trimmed.toLowerCase());
  if (!exists) pushHistorySnapshot();
  if (!exists) {
    state.customTools.push({
      id,
      name: trimmed,
      category: "Custom",
      description: "Custom operator-supplied tool boundary. Add command details in the generated Python.",
      command: [],
      defaults: {},
      mutates: false,
      custom: true,
    });
  }
  els.customToolInput.value = "";
  render();
}

function resetGraph() {
  pushHistorySnapshot();
  state.nodes = createInitialNodes();
  state.edges = [{ id: "edge-start-end", from: "start", to: "end", label: "next" }];
  state.selectedNodeId = "start";
  state.selectedEdgeId = null;
  state.connectSourceId = null;
  state.connectionDraft = null;
  state.zoom = 1;
  state.nextNodeNumber = 1;
  render();
}

function setZoom(nextZoom) {
  state.zoom = Number(clamp(nextZoom, zoomRange.min, zoomRange.max).toFixed(2));
  applyZoom();
  renderEdges();
}

function applyZoom() {
  if (!els.canvas || !els.graphScale) return;
  els.canvas.style.width = `${canvasSize.width * state.zoom}px`;
  els.canvas.style.height = `${canvasSize.height * state.zoom}px`;
  els.graphScale.style.transform = `scale(${state.zoom})`;
  if (els.zoomLabel) {
    els.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  }
}

function renderNodes() {
  els.nodeLayer.innerHTML = "";
  for (const node of state.nodes) {
    const element = document.createElement("article");
    element.className = "node-card";
    element.dataset.id = node.id;
    element.dataset.kind = node.kind;
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
    if (state.selectedNodeId === node.id) element.classList.add("is-selected");
    if (state.connectSourceId === node.id) element.classList.add("is-connect-source");
    const tools = node.tools.map((toolId) => `<span>${escapeHtml(toolLabel(toolId))}</span>`).join("");
    const ports = renderNodePorts(node);
    element.innerHTML = `
      ${ports}
      <header>
        <span class="node-glyph">${escapeHtml(nodeKinds[node.kind].glyph)}</span>
        <h3>${escapeHtml(node.title)}</h3>
      </header>
      <p>${escapeHtml(node.detail || nodeKinds[node.kind].description)}</p>
      <div class="node-tools">${tools}</div>
    `;
    attachNodeEvents(element, node);
    els.nodeLayer.appendChild(element);
  }
}

function renderNodePorts(node) {
  const ports = [];
  if (node.kind !== "start") {
    ports.push({ flow: "in", side: "left", label: "Connect into left side" });
    ports.push({ flow: "in", side: "top", label: "Connect into top side" });
  }
  if (node.kind !== "end") {
    ports.push({ flow: "out", side: "right", label: "Draw connector from right side" });
    ports.push({ flow: "out", side: "bottom", label: "Draw connector from bottom side" });
  }

  return ports
    .map(
      (port) =>
        `<button class="node-port node-port-${port.side}" type="button" data-port="${port.flow}" data-side="${port.side}" title="${escapeHtml(port.label)}" aria-label="${escapeHtml(port.label)}"></button>`,
    )
    .join("");
}

function attachNodeEvents(element, node) {
  element.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-port]")) return;
    if (event.button !== 0) return;
    event.preventDefault();
    if (state.connectSourceId && state.connectSourceId !== node.id) {
      addEdge(state.connectSourceId, node.id);
      return;
    }

    state.selectedNodeId = node.id;
    state.selectedEdgeId = null;
    state.connectSourceId = null;
    document.querySelectorAll(".node-card").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.id === node.id);
      card.classList.remove("is-connect-source");
    });
    renderEdges();
    renderInspector();
    renderTools();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { x: node.x, y: node.y };
    const beforeDrag = graphSnapshot();
    let moved = false;
    element.setPointerCapture(event.pointerId);

    function onMove(moveEvent) {
      const nextX = origin.x + (moveEvent.clientX - startX) / state.zoom;
      const nextY = origin.y + (moveEvent.clientY - startY) / state.zoom;
      if (!moved && Math.hypot(nextX - origin.x, nextY - origin.y) > 2) {
        moved = true;
      }
      node.x = Math.max(20, Math.min(canvasSize.width - 230, nextX));
      node.y = Math.max(20, Math.min(canvasSize.height - 130, nextY));
      element.style.left = `${node.x}px`;
      element.style.top = `${node.y}px`;
      renderEdges();
    }

    function onUp() {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      if (element.hasPointerCapture?.(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
      if (moved) {
        pushHistorySnapshot(beforeDrag);
      }
      render();
    }

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
  });

  element.addEventListener("dblclick", () => {
    state.connectSourceId = node.id;
    render();
  });

  element.querySelectorAll('[data-port="out"]').forEach((outputPort) => {
    outputPort.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      startConnectionDrag(node, outputPort, event);
    });
    outputPort.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.suppressNextPortClick) {
        state.suppressNextPortClick = false;
        return;
      }
      state.connectSourceId = node.id;
      state.selectedNodeId = node.id;
      state.selectedEdgeId = null;
      render();
    });
  });

  element.querySelectorAll('[data-port="in"]').forEach((inputPort) => {
    inputPort.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !state.connectSourceId || state.connectSourceId === node.id) return;
      event.preventDefault();
      event.stopPropagation();
      addEdge(state.connectSourceId, node.id);
    });
    inputPort.addEventListener("click", (event) => {
      if (!state.connectSourceId || state.connectSourceId === node.id) return;
      event.preventDefault();
      event.stopPropagation();
      addEdge(state.connectSourceId, node.id);
    });
  });
}

function startConnectionDrag(node, handle, event) {
  handle.setPointerCapture(event.pointerId);
  const initialPoint = canvasPointFromClient(event.clientX, event.clientY);
  const start = anchorPoint(node, initialPoint);
  const origin = { x: event.clientX, y: event.clientY };
  let moved = false;
  state.connectionDraft = {
    from: node.id,
    x: start.x,
    y: start.y,
  };
  state.connectSourceId = node.id;
  state.selectedNodeId = node.id;
  state.selectedEdgeId = null;
  let finished = false;
  renderEdges();
  renderInspector();
  renderTools();
  handle.closest(".node-card")?.classList.add("is-selected", "is-connect-source");

  function onMove(moveEvent) {
    if (!moved && Math.hypot(moveEvent.clientX - origin.x, moveEvent.clientY - origin.y) > 4) {
      moved = true;
    }
    const point = canvasPointFromClient(moveEvent.clientX, moveEvent.clientY);
    state.connectionDraft = {
      from: node.id,
      x: point.x,
      y: point.y,
    };
    renderEdges();
  }

  function cleanup(pointerId) {
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onCancel, true);
    if (handle.hasPointerCapture?.(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
  }

  function onUp(upEvent) {
    if (finished) return;
    finished = true;
    cleanup(upEvent.pointerId);
    const targetNode = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest(".node-card");
    const targetId = targetNode?.dataset.id;
    state.connectionDraft = null;
    state.connectSourceId = null;
    state.suppressNextPortClick = moved;
    if (targetId && targetId !== node.id) {
      addEdge(node.id, targetId);
    } else {
      render();
    }
    window.setTimeout(() => {
      state.suppressNextPortClick = false;
    }, 0);
  }

  function onCancel(cancelEvent) {
    if (finished) return;
    finished = true;
    cleanup(cancelEvent.pointerId);
    state.connectionDraft = null;
    state.connectSourceId = null;
    render();
  }

  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onCancel);
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("pointercancel", onCancel, true);
}

function renderEdges() {
  const defs = `
    <defs>
      <marker id="arrow-head" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
        <path d="M2,2 L10,6 L2,10 z" fill="#51615a"></path>
      </marker>
    </defs>`;
  const edges = state.edges
    .map((edge) => {
      const from = nodeById(edge.from);
      const to = nodeById(edge.to);
      if (!from || !to) return "";
      const { start, end } = edgeAnchors(from, to);
      const curve = edgeCurve(start, end);
      const selected = state.selectedEdgeId === edge.id ? " is-selected" : "";
      const conditional = from.kind === "condition" ? " is-conditional" : "";
      return `
        <path class="edge-path${selected}${conditional}" data-edge-id="${escapeHtml(edge.id)}" d="${curve.path}" marker-end="url(#arrow-head)"></path>
        <text class="edge-label" data-edge-id="${escapeHtml(edge.id)}" x="${curve.labelX}" y="${curve.labelY}" text-anchor="middle">${escapeHtml(edge.label)}</text>
      `;
    })
    .join("");
  const draft = renderDraftEdge();
  els.edgeLayer.innerHTML = `${defs}${edges}${draft}`;
  els.edgeLayer.querySelectorAll("[data-edge-id]").forEach((edgeElement) => {
    edgeElement.style.pointerEvents = "auto";
    edgeElement.addEventListener("click", (event) => {
      event.stopPropagation();
      selectEdge(edgeElement.dataset.edgeId);
    });
  });
}

function renderDraftEdge() {
  if (!state.connectionDraft) return "";
  const from = nodeById(state.connectionDraft.from);
  if (!from) return "";
  const end = { x: state.connectionDraft.x, y: state.connectionDraft.y };
  const start = anchorPoint(from, end);
  const curve = edgeCurve(start, end);
  return `<path class="edge-path is-draft" d="${curve.path}" marker-end="url(#arrow-head)"></path>`;
}

function renderTools() {
  renderToolControls();
  const tools = filteredTools();
  els.toolMeta.textContent = `${tools.length} of ${allTools().length} tools`;
  els.toolList.innerHTML =
    tools
      .map((tool) => renderToolChip(tool, "data-tool", nodeById(state.selectedNodeId)?.tools.includes(tool.id)))
      .join("") || '<div class="inspector-empty">No tools match this filter.</div>';
  els.toolList.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      const node = nodeById(state.selectedNodeId);
      if (!node || node.kind === "start" || node.kind === "end") return;
      const tool = button.dataset.tool;
      pushHistorySnapshot();
      if (node.tools.includes(tool)) {
        node.tools = node.tools.filter((item) => item !== tool);
      } else {
        node.tools.push(tool);
      }
      render();
    });
  });
}

function renderToolControls() {
  const categories = ["all", ...toolCategories()];
  const categoryExists = categories.includes(state.toolCategory);
  if (!categoryExists) state.toolCategory = "all";

  els.toolSearchInput.value = state.toolFilter;
  els.toolCategory.innerHTML = categories
    .map((category) => {
      const label = category === "all" ? "All tools" : category;
      return `<option value="${escapeHtml(category)}" ${state.toolCategory === category ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function renderToolChip(tool, attributeName, selected = false) {
  const selectedClass = selected ? " is-selected" : "";
  const mutates = tool.mutates ? '<span class="tool-chip-risk">writes</span>' : "";
  return `
    <button class="tool-chip${selectedClass}" type="button" ${attributeName}="${escapeHtml(tool.id)}" title="${escapeHtml(tool.description)}">
      <span class="tool-chip-name">${escapeHtml(tool.name)}</span>
      <span class="tool-chip-meta">${escapeHtml(tool.category)} · ${escapeHtml(toolCommandLabel(tool))}</span>
      ${mutates}
    </button>
  `;
}

function renderInspector() {
  const node = nodeById(state.selectedNodeId);
  const edge = edgeById(state.selectedEdgeId);

  if (!node && !edge) {
    els.inspector.innerHTML = `
      <section class="panel-section">
        <h2>Inspector</h2>
        <div class="inspector-empty">Select a node or connector to edit its label, tools, branch, and generation behavior.</div>
      </section>
    `;
    return;
  }

  if (edge) {
    renderEdgeInspector(edge);
    return;
  }

  const branchEditor =
    node.kind === "condition"
      ? `
        <label>
          Router note
          <textarea data-node-field="condition">${escapeHtml(node.condition)}</textarea>
        </label>
        <label>
          Branch labels
          <input data-node-field="branches" value="${escapeHtml(node.branches.join(", "))}">
        </label>
      `
      : "";
  const locked = node.kind === "start" || node.kind === "end";
  els.inspector.innerHTML = `
    <section class="panel-section">
      <h2>${escapeHtml(nodeKinds[node.kind].label)} node</h2>
      <div class="field-stack">
        <label>
          Label
          <input data-node-field="title" value="${escapeHtml(node.title)}" ${locked ? "readonly" : ""}>
        </label>
        <label>
          State update
          <textarea data-node-field="detail" ${locked ? "readonly" : ""}>${escapeHtml(node.detail)}</textarea>
        </label>
        ${branchEditor}
      </div>
    </section>
    <section class="panel-section">
      <h2>Tools on this node</h2>
      <div class="tool-list" data-inspector-tools></div>
    </section>
    <section class="panel-section">
      <h2>Connectors</h2>
      <button class="console-button" type="button" data-connect-from="${escapeHtml(node.id)}">Connect from this node</button>
      ${locked ? "" : '<button class="console-button warning" type="button" data-delete-selected>Delete node</button>'}
    </section>
  `;

  els.inspector.querySelectorAll("[data-node-field]").forEach((field) => {
    let didPushHistory = false;
    field.addEventListener("input", () => {
      if (!didPushHistory) {
        pushHistorySnapshot();
        didPushHistory = true;
      }
      if (field.dataset.nodeField === "branches") {
        node.branches = field.value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      } else {
        node[field.dataset.nodeField] = field.value;
      }
      renderNodes();
      renderEdges();
      renderCode();
      renderValidation();
    });
  });

  const connectButton = els.inspector.querySelector("[data-connect-from]");
  connectButton?.addEventListener("click", () => {
    state.connectSourceId = node.id;
    render();
  });

  els.inspector.querySelector("[data-delete-selected]")?.addEventListener("click", removeSelected);
  renderInspectorTools(node);
}

function renderInspectorTools(node) {
  const container = els.inspector.querySelector("[data-inspector-tools]");
  if (!container) return;
  const filtered = filteredTools();
  const renderedIds = new Set(filtered.map((tool) => tool.id));
  const selectedOutsideFilter = allTools().filter((tool) => node.tools.includes(tool.id) && !renderedIds.has(tool.id));
  const tools = [...selectedOutsideFilter, ...filtered];
  container.innerHTML =
    tools.map((tool) => renderToolChip(tool, "data-inspector-tool", node.tools.includes(tool.id))).join("") ||
    '<div class="inspector-empty">No tools match this filter.</div>';
  container.querySelectorAll("[data-inspector-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      const tool = button.dataset.inspectorTool;
      pushHistorySnapshot();
      if (node.tools.includes(tool)) {
        node.tools = node.tools.filter((item) => item !== tool);
      } else {
        node.tools.push(tool);
      }
      render();
    });
  });
}

function renderEdgeInspector(edge) {
  const from = nodeById(edge.from);
  const to = nodeById(edge.to);
  const branchOptions = from?.kind === "condition" ? from.branches : ["next"];
  els.inspector.innerHTML = `
    <section class="panel-section">
      <h2>Connector</h2>
      <div class="edge-row">
        <div>
          <strong>${escapeHtml(from?.title || edge.from)}</strong> to <strong>${escapeHtml(to?.title || edge.to)}</strong>
          <br><small>${from?.kind === "condition" ? "Conditional branch" : "Direct edge"}</small>
        </div>
      </div>
      <div class="field-stack">
        <label>
          Branch label
          <select data-edge-field="label">
            ${branchOptions.map((branch) => `<option value="${escapeHtml(branch)}" ${edge.label === branch ? "selected" : ""}>${escapeHtml(branch)}</option>`).join("")}
          </select>
        </label>
      </div>
      <button class="console-button warning" type="button" data-delete-selected>Delete connector</button>
    </section>
  `;
  els.inspector.querySelector("[data-edge-field]")?.addEventListener("change", (event) => {
    updateEdge(edge.id, { label: event.target.value });
  });
  els.inspector.querySelector("[data-delete-selected]")?.addEventListener("click", removeSelected);
}

function validateGraph() {
  const messages = [];
  const outgoing = new Map();
  const incoming = new Map();
  for (const edge of state.edges) {
    outgoing.set(edge.from, (outgoing.get(edge.from) || 0) + 1);
    incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
  }

  for (const node of state.nodes) {
    if (node.kind !== "end" && !outgoing.get(node.id)) {
      messages.push({ type: "warning", text: `${node.title} has no outgoing connector.` });
    }
    if (node.kind !== "start" && !incoming.get(node.id)) {
      messages.push({ type: "warning", text: `${node.title} has no incoming connector.` });
    }
    if (node.kind === "condition") {
      const labels = new Set(state.edges.filter((edge) => edge.from === node.id).map((edge) => edge.label));
      const missing = node.branches.filter((branch) => !labels.has(branch));
      if (missing.length) {
        messages.push({ type: "warning", text: `${node.title} is missing branch edges for ${missing.join(", ")}.` });
      }
    }
    for (const toolId of node.tools) {
      const tool = toolById(toolId);
      if (!tool) {
        messages.push({ type: "warning", text: `${node.title} references a missing tool: ${toolId}.` });
      } else if (!tool.command.length) {
        messages.push({ type: "warning", text: `${tool.name} is custom and needs command details in the exported Python.` });
      }
    }
  }

  if (!messages.length) {
    messages.push({ type: "ok", text: "Graph is ready to export." });
  }
  return messages;
}

function renderValidation() {
  const messages = validateGraph();
  els.validation.innerHTML = messages
    .map((message) => `<li class="${message.type === "warning" ? "is-warning" : ""}">${escapeHtml(message.text)}</li>`)
    .join("");
  els.status.textContent = messages.some((message) => message.type === "warning")
    ? `${messages.length} checks need attention`
    : "Ready to export";
}

function pythonString(value) {
  return JSON.stringify(String(value || ""));
}

function pythonLiteral(value) {
  if (value === true) return "True";
  if (value === false) return "False";
  if (value === null || value === undefined) return "None";
  if (Array.isArray(value)) return `[${value.map(pythonLiteral).join(", ")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .map(([key, item]) => `${pythonString(key)}: ${pythonLiteral(item)}`)
      .join(", ")}}`;
  }
  return pythonString(value);
}

function generatePython() {
  const regularNodes = state.nodes.filter((node) => !["start", "end"].includes(node.kind));
  const usedNames = new Set();
  const nameById = new Map();
  for (const node of regularNodes) {
    nameById.set(node.id, uniquePythonName(node, usedNames));
  }

  const selectedTools = [...new Set(regularNodes.flatMap((node) => node.tools))]
    .map(toolById)
    .filter(Boolean);
  const toolRegistry = Object.fromEntries(
    selectedTools.map((tool) => [
      tool.id,
      {
        name: tool.name,
        category: tool.category,
        description: tool.description,
        command: tool.command,
        defaults: tool.defaults,
        mutates: tool.mutates,
      },
    ]),
  );

  const lines = ["from typing import Any, Literal, TypedDict"];
  if (selectedTools.length) lines.push("import subprocess");
  lines.push(
    "",
    "from langgraph.graph import END, START, StateGraph",
    "",
    "",
    "class AgentState(TypedDict, total=False):",
    "    messages: list[str]",
    "    artifacts: dict[str, Any]",
    "    cwd: str",
    "    tool_args: dict[str, dict[str, str]]",
    "    approvals: dict[str, bool]",
    "    route: str",
    "",
  );

  if (selectedTools.length) {
    lines.push(`TOOL_REGISTRY: dict[str, dict[str, Any]] = ${pythonLiteral(toolRegistry)}`);
    lines.push("");
    lines.push("");
    lines.push("def _format_command(template: list[str], values: dict[str, str]) -> list[str]:");
    lines.push("    command = []");
    lines.push("    for part in template:");
    lines.push("        try:");
    lines.push("            command.append(part.format(**values))");
    lines.push("        except KeyError as exc:");
    lines.push("            missing = exc.args[0]");
    lines.push("            raise KeyError(f\"Missing tool argument: {missing}\") from exc");
    lines.push("    return [part for part in command if part]");
    lines.push("");
    lines.push("");
    lines.push("def run_cli_tool(tool_id: str, state: AgentState) -> dict[str, Any]:");
    lines.push("    tool = TOOL_REGISTRY[tool_id]");
    lines.push("    if not tool.get(\"command\"):");
    lines.push("        raise RuntimeError(f\"Tool {tool['name']} has no command template yet.\")");
    lines.push("    if tool.get(\"mutates\") and not state.get(\"approvals\", {}).get(tool_id):");
    lines.push("        raise PermissionError(f\"Tool {tool['name']} can change external state; set approvals[{tool_id!r}] = True to run it.\")");
    lines.push("    values = {**tool.get(\"defaults\", {}), **state.get(\"tool_args\", {}).get(tool_id, {})}");
    lines.push("    command = _format_command(tool[\"command\"], values)");
    lines.push("    completed = subprocess.run(");
    lines.push("        command,");
    lines.push("        cwd=state.get(\"cwd\") or None,");
    lines.push("        text=True,");
    lines.push("        capture_output=True,");
    lines.push("        check=False,");
    lines.push("    )");
    lines.push("    return {");
    lines.push("        \"tool\": tool[\"name\"],");
    lines.push("        \"category\": tool[\"category\"],");
    lines.push("        \"command\": command,");
    lines.push("        \"returncode\": completed.returncode,");
    lines.push("        \"stdout\": completed.stdout,");
    lines.push("        \"stderr\": completed.stderr,");
    lines.push("    }");

    for (const tool of selectedTools) {
      const functionName = `run_${sanitizeIdentifier(tool.id, "tool")}`;
      lines.push("");
      lines.push("");
      lines.push(`def ${functionName}(state: AgentState) -> dict[str, Any]:`);
      lines.push(`    \"\"\"${tool.description || `Run ${tool.name}.`}\"\"\"`);
      lines.push(`    return run_cli_tool(${pythonString(tool.id)}, state)`);
    }
    lines.push("");
  }

  for (const node of regularNodes) {
    const functionName = nameById.get(node.id);
    if (node.kind === "condition") {
      lines.push("");
      lines.push(`def ${functionName}(state: AgentState) -> dict[str, Any]:`);
      lines.push(`    \"\"\"${node.detail || "Prepare routing state."}\"\"\"`);
      lines.push(`    return {\"route\": ${pythonString(node.branches[0] || "next")}}`);
      lines.push("");
      lines.push(`def route_${functionName}(state: AgentState) -> Literal[${node.branches.map(pythonString).join(", ")}]:`);
      lines.push(`    \"\"\"${node.condition || "Choose the next branch."}\"\"\"`);
      lines.push(`    return state.get(\"route\", ${pythonString(node.branches[0] || "next")})`);
    } else {
      lines.push("");
      lines.push(`def ${functionName}(state: AgentState) -> dict[str, Any]:`);
      lines.push(`    \"\"\"${node.detail || "Return state updates."}\"\"\"`);
      if (node.tools.length) {
        lines.push("    artifacts = dict(state.get(\"artifacts\") or {})");
        lines.push("    tool_results = dict(artifacts.get(\"tool_results\") or {})");
        for (const toolId of node.tools) {
          const tool = toolById(toolId);
          if (!tool) continue;
          lines.push(`    tool_results[${pythonString(tool.id)}] = run_${sanitizeIdentifier(tool.id, "tool")}(state)`);
        }
        lines.push("    artifacts[\"tool_results\"] = tool_results");
        lines.push("    return {\"artifacts\": artifacts}");
      } else {
        lines.push("    return {}");
      }
    }
  }

  lines.push("");
  lines.push("");
  lines.push("builder = StateGraph(AgentState)");
  for (const node of regularNodes) {
    lines.push(`builder.add_node(${pythonString(nameById.get(node.id))}, ${nameById.get(node.id)})`);
  }

  const conditionalGroups = new Map();
  for (const edge of state.edges) {
    const from = nodeById(edge.from);
    if (from?.kind === "condition") {
      if (!conditionalGroups.has(edge.from)) conditionalGroups.set(edge.from, []);
      conditionalGroups.get(edge.from).push(edge);
      continue;
    }
    lines.push(`builder.add_edge(${pythonEndpoint(edge.from, nameById)}, ${pythonEndpoint(edge.to, nameById)})`);
  }

  for (const [nodeId, edges] of conditionalGroups) {
    const nodeName = nameById.get(nodeId);
    const mapping = edges
      .map((edge) => `        ${pythonString(edge.label)}: ${pythonEndpoint(edge.to, nameById)},`)
      .join("\n");
    lines.push(`builder.add_conditional_edges(`);
    lines.push(`    ${pythonString(nodeName)},`);
    lines.push(`    route_${nodeName},`);
    lines.push("    {");
    lines.push(mapping);
    lines.push("    },");
    lines.push(")");
  }

  lines.push("");
  lines.push("graph = builder.compile()");
  lines.push("");
  lines.push("if __name__ == \"__main__\":");
  lines.push("    result = graph.invoke({\"messages\": []})");
  lines.push("    print(result)");
  lines.push("");

  return lines.join("\n");
}

function pythonEndpoint(nodeId, nameById) {
  if (nodeId === "start") return "START";
  if (nodeId === "end") return "END";
  return pythonString(nameById.get(nodeId));
}

function renderCode() {
  els.codePreview.textContent = generatePython();
}

function downloadPython() {
  const blob = new Blob([generatePython()], { type: "text/x-python;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "langgraph_agent.py";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function copyPython() {
  navigator.clipboard.writeText(generatePython()).then(() => {
    els.copyButton.textContent = "Copied";
    window.setTimeout(() => {
      els.copyButton.textContent = "Copy";
    }, 1200);
  });
}

function render() {
  applyZoom();
  renderNodes();
  renderEdges();
  renderTools();
  renderInspector();
  renderValidation();
  renderCode();
}

function startPaletteDrag(button, event) {
  if (event.button !== 0) return;
  state.suppressMouseUntil = Date.now() + 700;
  const kind = button.dataset.addNode;
  const origin = { x: event.clientX, y: event.clientY };
  let ghost = null;
  let active = false;
  let finished = false;
  let idleTimer = null;
  button.setPointerCapture(event.pointerId);

  function createGhost() {
    ghost = document.createElement("div");
    ghost.className = "palette-drag-ghost";
    ghost.textContent = nodeKinds[kind].label;
    document.body.appendChild(ghost);
  }

  function moveGhost(moveEvent) {
    if (!ghost) return;
    ghost.style.left = `${moveEvent.clientX + 12}px`;
    ghost.style.top = `${moveEvent.clientY + 12}px`;
    const rect = els.canvasFrame.getBoundingClientRect();
    const overCanvas =
      moveEvent.clientX >= rect.left &&
      moveEvent.clientX <= rect.right &&
      moveEvent.clientY >= rect.top &&
      moveEvent.clientY <= rect.bottom;
    els.canvasFrame.classList.toggle("is-drop-target", overCanvas);
    return overCanvas;
  }

  function onMove(moveEvent) {
    if (finished) return;
    const distance = Math.hypot(moveEvent.clientX - origin.x, moveEvent.clientY - origin.y);
    if (!active && distance > 7) {
      active = true;
      state.suppressNextPaletteClick = true;
      createGhost();
    }
    if (active) {
      moveEvent.preventDefault();
      const overCanvas = moveGhost(moveEvent);
      window.clearTimeout(idleTimer);
      if (overCanvas) {
        idleTimer = window.setTimeout(() => finish(moveEvent), 1400);
      }
    }
  }

  function finish(upEvent) {
    if (finished) return;
    finished = true;
    window.clearTimeout(idleTimer);
    button.removeEventListener("pointermove", onMove);
    button.removeEventListener("pointerup", onUp);
    els.canvasFrame.classList.remove("is-drop-target");
    ghost?.remove();
    if (!active) return;
    const rect = els.canvasFrame.getBoundingClientRect();
    const overCanvas =
      upEvent.clientX >= rect.left &&
      upEvent.clientX <= rect.right &&
      upEvent.clientY >= rect.top &&
      upEvent.clientY <= rect.bottom;
    if (overCanvas) {
      addNode(kind, canvasPointFromClient(upEvent.clientX, upEvent.clientY));
    }
    window.setTimeout(() => {
      state.suppressNextPaletteClick = false;
    }, 0);
  }

  function onUp(upEvent) {
    finish(upEvent);
  }

  button.addEventListener("pointermove", onMove);
  button.addEventListener("pointerup", onUp);
}

function startMousePaletteDrag(button, event) {
  if (event.button !== 0 || Date.now() < state.suppressMouseUntil) return;
  const kind = button.dataset.addNode;
  const origin = { x: event.clientX, y: event.clientY };
  let ghost = null;
  let active = false;
  let finished = false;
  let idleTimer = null;

  function createGhost() {
    ghost = document.createElement("div");
    ghost.className = "palette-drag-ghost";
    ghost.textContent = nodeKinds[kind].label;
    document.body.appendChild(ghost);
  }

  function moveGhost(moveEvent) {
    if (!ghost) return;
    ghost.style.left = `${moveEvent.clientX + 12}px`;
    ghost.style.top = `${moveEvent.clientY + 12}px`;
    const rect = els.canvasFrame.getBoundingClientRect();
    const overCanvas =
      moveEvent.clientX >= rect.left &&
      moveEvent.clientX <= rect.right &&
      moveEvent.clientY >= rect.top &&
      moveEvent.clientY <= rect.bottom;
    els.canvasFrame.classList.toggle("is-drop-target", overCanvas);
    return overCanvas;
  }

  function onMove(moveEvent) {
    const distance = Math.hypot(moveEvent.clientX - origin.x, moveEvent.clientY - origin.y);
    if (!active && distance > 7) {
      active = true;
      state.suppressNextPaletteClick = true;
      createGhost();
    }
    if (active) {
      moveEvent.preventDefault();
      const overCanvas = moveGhost(moveEvent);
      window.clearTimeout(idleTimer);
      if (overCanvas) {
        idleTimer = window.setTimeout(() => finish(moveEvent), 1400);
      }
    }
  }

  function finish(upEvent) {
    if (finished) return;
    finished = true;
    window.clearTimeout(idleTimer);
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    els.canvasFrame.classList.remove("is-drop-target");
    ghost?.remove();
    if (!active) return;
    const rect = els.canvasFrame.getBoundingClientRect();
    const overCanvas =
      upEvent.clientX >= rect.left &&
      upEvent.clientX <= rect.right &&
      upEvent.clientY >= rect.top &&
      upEvent.clientY <= rect.bottom;
    if (overCanvas) {
      addNode(kind, canvasPointFromClient(upEvent.clientX, upEvent.clientY));
    }
    window.setTimeout(() => {
      state.suppressNextPaletteClick = false;
    }, 0);
  }

  function onUp(upEvent) {
    finish(upEvent);
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

function setupNativePaletteDrag(button) {
  button.addEventListener("dragstart", (event) => {
    const kind = button.dataset.addNode;
    state.suppressNextPaletteClick = true;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-langgraph-node", kind);
    event.dataTransfer.setData("text/plain", kind);
  });

  button.addEventListener("dragend", () => {
    els.canvasFrame.classList.remove("is-drop-target");
    window.setTimeout(() => {
      state.suppressNextPaletteClick = false;
    }, 0);
  });
}

function setupCanvasDrop() {
  els.canvasFrame.addEventListener("dragover", (event) => {
    const kind =
      event.dataTransfer.types.includes("application/x-langgraph-node") ||
      event.dataTransfer.types.includes("text/plain");
    if (!kind) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    els.canvasFrame.classList.add("is-drop-target");
  });

  els.canvasFrame.addEventListener("dragleave", (event) => {
    if (!els.canvasFrame.contains(event.relatedTarget)) {
      els.canvasFrame.classList.remove("is-drop-target");
    }
  });

  els.canvasFrame.addEventListener("drop", (event) => {
    const kind =
      event.dataTransfer.getData("application/x-langgraph-node") ||
      event.dataTransfer.getData("text/plain");
    if (!nodeKinds[kind]) return;
    event.preventDefault();
    els.canvasFrame.classList.remove("is-drop-target");
    addNode(kind, canvasPointFromClient(event.clientX, event.clientY));
    window.setTimeout(() => {
      state.suppressNextPaletteClick = false;
    }, 0);
  });
}

async function loadToolCatalog() {
  try {
    const response = await fetch("/agent-console/tools/catalog.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const tools = Array.isArray(payload.tools) ? payload.tools.map(normalizeTool) : [];
    if (!tools.length) throw new Error("Tool catalog is empty.");
    state.toolCatalog = tools;
    state.catalogError = "";
  } catch (error) {
    state.toolCatalog = [...fallbackToolCatalog];
    state.catalogError = `Tool catalog unavailable; using ${fallbackToolCatalog.length} starter tools.`;
    console.warn(state.catalogError, error);
  }
}

function init() {
  Object.assign(els, {
    canvas: byId("graph-canvas"),
    graphScale: byId("graph-scale"),
    canvasFrame: byId("canvas-frame"),
    edgeLayer: byId("edge-layer"),
    nodeLayer: byId("node-layer"),
    toolList: byId("tool-list"),
    toolMeta: byId("tool-library-meta"),
    toolSearchInput: byId("tool-search-input"),
    toolCategory: byId("tool-category-filter"),
    customToolInput: byId("custom-tool-input"),
    inspector: byId("inspector"),
    validation: byId("validation-list"),
    status: byId("status-pill"),
    zoomLabel: byId("zoom-label"),
    codePreview: byId("code-preview"),
    copyButton: byId("copy-code"),
  });

  document.querySelectorAll("[data-add-node]").forEach((button) => {
    setupNativePaletteDrag(button);
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse") startPaletteDrag(button, event);
    });
    button.addEventListener("mousedown", (event) => startMousePaletteDrag(button, event));
    button.addEventListener("click", () => {
      if (state.suppressNextPaletteClick) {
        state.suppressNextPaletteClick = false;
        return;
      }
      addNode(button.dataset.addNode);
    });
  });

  setupCanvasDrop();

  byId("add-tool-form").addEventListener("submit", (event) => {
    event.preventDefault();
    addCustomTool(els.customToolInput.value);
  });
  els.toolSearchInput.addEventListener("input", () => {
    state.toolFilter = els.toolSearchInput.value;
    renderTools();
    renderInspector();
  });
  els.toolCategory.addEventListener("change", () => {
    state.toolCategory = els.toolCategory.value;
    renderTools();
    renderInspector();
  });

  byId("delete-selected").addEventListener("click", removeSelected);
  byId("reset-graph").addEventListener("click", resetGraph);
  byId("zoom-in").addEventListener("click", () => setZoom(state.zoom + zoomRange.step));
  byId("zoom-out").addEventListener("click", () => setZoom(state.zoom - zoomRange.step));
  byId("zoom-reset").addEventListener("click", () => setZoom(1));
  byId("download-code").addEventListener("click", downloadPython);
  byId("copy-code").addEventListener("click", copyPython);
  byId("connect-mode").addEventListener("click", () => {
    if (state.selectedNodeId) {
      state.connectSourceId = state.selectedNodeId;
    } else {
      state.connectSourceId = null;
    }
    render();
  });

  els.canvas.addEventListener("click", (event) => {
    if (event.target === els.canvas || event.target === els.nodeLayer) {
      state.connectSourceId = null;
      clearSelection();
      render();
    }
  });

  document.addEventListener("keydown", (event) => {
    const shortcutKey = event.key.toLowerCase();
    const modifierPressed = event.metaKey || event.ctrlKey;
    if (modifierPressed && !event.altKey && !isEditableTarget(event.target)) {
      if (shortcutKey === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoGraph();
        } else {
          undoGraph();
        }
        return;
      }
      if (shortcutKey === "y") {
        event.preventDefault();
        redoGraph();
        return;
      }
    }

    if ((event.key === "Delete" || event.key === "Backspace") && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      removeSelected();
    }
  });

  render();
  loadToolCatalog().then(() => {
    render();
  });
}

init();
