const nodeKinds = {
  start: { glyph: "S", label: "Start", description: "Entry point for the graph." },
  end: { glyph: "E", label: "End", description: "Terminal state for the graph." },
  step: { glyph: "N", label: "Node", description: "A configurable node that can run an AI prompt or Python code." },
  tool: { glyph: "AI", label: "AI", description: "A prompt-driven node that can call selected provider packs." },
  condition: { glyph: "?", label: "Conditional", description: "A router node with named branches." },
};

const fallbackToolCatalog = [
  {
    id: "terraform",
    name: "Terraform",
    category: "Infrastructure",
    description: "Terraform provider-level command pack.",
    binary: "terraform",
    commandPackUrl: "/agent-console/tools/packs/terraform.json",
    defaults: { command_id: "terraform_validate" },
    mutates: true,
    pack: true,
  },
  {
    id: "tofu",
    name: "Tofu",
    category: "Infrastructure",
    description: "Tofu provider-level command pack.",
    binary: "tofu",
    commandPackUrl: "/agent-console/tools/packs/tofu.json",
    defaults: { command_id: "tofu_validate" },
    mutates: true,
    pack: true,
  },
  {
    id: "aws",
    name: "AWS",
    category: "Cloud",
    description: "AWS provider-level command pack.",
    binary: "aws",
    commandPackUrl: "/agent-console/tools/packs/aws.json",
    defaults: { command_id: "aws_sts_identity" },
    mutates: true,
    pack: true,
  },
  {
    id: "git",
    name: "Git",
    category: "Source control",
    description: "Git provider-level command pack.",
    binary: "git",
    commandPackUrl: "/agent-console/tools/packs/git.json",
    defaults: { command_id: "git_status" },
    mutates: true,
    pack: true,
  },
  {
    id: "twitter",
    name: "Twitter / X",
    category: "Social",
    description: "Twitter/X provider-level API command pack.",
    binary: "curl",
    commandPackUrl: "/agent-console/tools/packs/twitter.json",
    defaults: { command_id: "twitter_recent_search" },
    mutates: true,
    pack: true,
  },
  {
    id: "reddit",
    name: "Reddit",
    category: "Social",
    description: "Reddit provider-level API command pack.",
    binary: "curl",
    commandPackUrl: "/agent-console/tools/packs/reddit.json",
    defaults: { command_id: "reddit_global_search" },
    mutates: true,
    pack: true,
  },
];
const canvasSize = { width: 1500, height: 980 };
const defaultNodeX = 645;
const zoomRange = { min: 0.55, max: 1.55, step: 0.1 };
const nodeFallbackSize = { width: 210, height: 104 };
const nodeSizeLimits = {
  width: { min: 170, max: 360 },
  height: { min: 100, max: 260 },
};
const panelSizeDefaults = {
  sidebarWidth: 320,
  inspectorWidth: 430,
  codePanelHeight: 280,
};
const panelSizeLimits = {
  sidebarWidth: { min: 260, max: 560 },
  inspectorWidth: { min: 340, max: 760 },
  codePanelHeight: { min: 150, max: 620 },
};
const consoleLayoutVersion = 2;

const state = {
  nodes: createInitialNodes(),
  edges: [{ id: "edge-start-end", from: "start", to: "end", label: "next" }],
  toolCatalog: [...fallbackToolCatalog],
  customTools: [],
  loadedPacks: {},
  packStatus: {},
  toolFilter: "",
  toolCategory: "all",
  sampleFlowId: "research-synthesis",
  catalogError: "",
  selectedNodeId: "start",
  selectedEdgeId: null,
  connectSourceId: null,
  connectionDraft: null,
  sidebarCollapsed: false,
  inspectorCollapsed: false,
  sidebarWidth: panelSizeDefaults.sidebarWidth,
  inspectorWidth: panelSizeDefaults.inspectorWidth,
  codePanelHeight: panelSizeDefaults.codePanelHeight,
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

const storageKey = "langgraph-agent-console:v4";

const sampleFlows = [
  {
    id: "research-synthesis",
    name: "Research synthesis agent",
    description: "Collect signals, inspect source repos, branch on evidence quality, and prepare a synthesis.",
    nodes: [
      { id: "start", kind: "start", title: "Start", detail: "Research request and source scope.", x: 645, y: 50, tools: [], condition: "", branches: ["next"] },
      { id: "scope", kind: "step", title: "Frame research brief", detail: "Normalize the question, output format, constraints, and evidence threshold.", x: 645, y: 190, tools: [], condition: "", branches: ["next"] },
      { id: "source-scan", kind: "tool", title: "Scan source signals", detail: "Collect repository, issue, and release signals for the research topic.", x: 645, y: 340, tools: ["github", "gitlab"], condition: "", branches: ["next"] },
      { id: "evidence-gate", kind: "condition", title: "Evidence quality gate", detail: "Route based on whether enough credible source material exists.", x: 645, y: 500, tools: [], condition: "return 'draft' when sources are current and relevant", branches: ["draft", "collect_more"] },
      { id: "collect-more", kind: "tool", title: "Collect more context", detail: "Expand search using PRs, workflows, and package metadata.", x: 950, y: 500, tools: ["github", "npm"], condition: "", branches: ["next"] },
      { id: "draft", kind: "step", title: "Draft synthesis", detail: "Write findings, caveats, recommendations, and source traceability.", x: 645, y: 660, tools: [], condition: "", branches: ["next"] },
      { id: "end", kind: "end", title: "End", detail: "Compiled graph returns here.", x: 645, y: 820, tools: [], condition: "", branches: ["done"] },
    ],
    edges: [
      { id: "research-start-scope", from: "start", to: "scope", label: "next" },
      { id: "research-scope-source", from: "scope", to: "source-scan", label: "next" },
      { id: "research-source-gate", from: "source-scan", to: "evidence-gate", label: "next" },
      { id: "research-gate-draft", from: "evidence-gate", to: "draft", label: "draft" },
      { id: "research-gate-more", from: "evidence-gate", to: "collect-more", label: "collect_more" },
      { id: "research-more-source", from: "collect-more", to: "source-scan", label: "next" },
      { id: "research-draft-end", from: "draft", to: "end", label: "next" },
    ],
  },
  {
    id: "coding-release",
    name: "Coding release agent",
    description: "Inspect a repo, run checks, open a PR, and prepare a release path.",
    nodes: [
      { id: "start", kind: "start", title: "Start", detail: "Feature request and repository path.", x: 645, y: 50, tools: [], condition: "", branches: ["next"] },
      { id: "repo-state", kind: "tool", title: "Inspect repository", detail: "Read status, staged diff, branches, and recent commit context.", x: 645, y: 185, tools: ["git"], condition: "", branches: ["next"] },
      { id: "implement", kind: "step", title: "Plan code edits", detail: "Choose files, expected tests, and implementation boundaries.", x: 645, y: 330, tools: [], condition: "", branches: ["next"] },
      { id: "quality", kind: "tool", title: "Run quality checks", detail: "Run project tests, linting, and build before release work.", x: 645, y: 475, tools: ["npm", "python"], condition: "", branches: ["next"] },
      { id: "gate", kind: "condition", title: "Release gate", detail: "Route based on quality results.", x: 645, y: 625, tools: [], condition: "return 'ship' when tests and build pass", branches: ["ship", "fix"] },
      { id: "fix", kind: "step", title: "Patch failures", detail: "Summarize failures and loop back with targeted fixes.", x: 940, y: 625, tools: [], condition: "", branches: ["next"] },
      { id: "pr", kind: "tool", title: "Open delivery path", detail: "Create PR and inspect checks after push.", x: 645, y: 770, tools: ["git", "github"], condition: "", branches: ["next"] },
      { id: "end", kind: "end", title: "End", detail: "Compiled graph returns here.", x: 645, y: 850, tools: [], condition: "", branches: ["done"] },
    ],
    edges: [
      { id: "coding-start-repo", from: "start", to: "repo-state", label: "next" },
      { id: "coding-repo-impl", from: "repo-state", to: "implement", label: "next" },
      { id: "coding-impl-quality", from: "implement", to: "quality", label: "next" },
      { id: "coding-quality-gate", from: "quality", to: "gate", label: "next" },
      { id: "coding-gate-pr", from: "gate", to: "pr", label: "ship" },
      { id: "coding-gate-fix", from: "gate", to: "fix", label: "fix" },
      { id: "coding-fix-quality", from: "fix", to: "quality", label: "next" },
      { id: "coding-pr-end", from: "pr", to: "end", label: "next" },
    ],
  },
  {
    id: "cloud-infra",
    name: "Cloud infrastructure agent",
    description: "Validate Terraform, plan changes, inspect AWS state, and gate apply.",
    nodes: [
      { id: "start", kind: "start", title: "Start", detail: "Infrastructure change request.", x: 645, y: 50, tools: [], condition: "", branches: ["next"] },
      { id: "identity", kind: "tool", title: "Confirm cloud context", detail: "Verify AWS identity and current Kubernetes context.", x: 645, y: 190, tools: ["aws", "kubernetes"], condition: "", branches: ["next"] },
      { id: "tf-checks", kind: "tool", title: "Terraform checks", detail: "Initialize, format-check, validate, and build a plan.", x: 645, y: 350, tools: ["terraform", "tofu"], condition: "", branches: ["next"] },
      { id: "blast-radius", kind: "tool", title: "Inspect runtime state", detail: "Read EC2, ECS, Lambda, CloudFormation, and logs for blast-radius context.", x: 645, y: 510, tools: ["aws"], condition: "", branches: ["next"] },
      { id: "approval", kind: "condition", title: "Change approval", detail: "Route based on whether the plan is reviewed and approved.", x: 645, y: 675, tools: [], condition: "return 'apply' only after human approval", branches: ["apply", "hold"] },
      { id: "apply", kind: "tool", title: "Apply and verify", detail: "Apply a saved plan, inspect outputs, and invalidate cache if needed.", x: 440, y: 820, tools: ["terraform", "tofu", "aws"], condition: "", branches: ["next"] },
      { id: "hold", kind: "step", title: "Hold change", detail: "Return review notes without changing cloud resources.", x: 850, y: 820, tools: [], condition: "", branches: ["next"] },
      { id: "end", kind: "end", title: "End", detail: "Compiled graph returns here.", x: 645, y: 860, tools: [], condition: "", branches: ["done"] },
    ],
    edges: [
      { id: "infra-start-identity", from: "start", to: "identity", label: "next" },
      { id: "infra-identity-tf", from: "identity", to: "tf-checks", label: "next" },
      { id: "infra-tf-blast", from: "tf-checks", to: "blast-radius", label: "next" },
      { id: "infra-blast-approval", from: "blast-radius", to: "approval", label: "next" },
      { id: "infra-approval-apply", from: "approval", to: "apply", label: "apply" },
      { id: "infra-approval-hold", from: "approval", to: "hold", label: "hold" },
      { id: "infra-apply-end", from: "apply", to: "end", label: "next" },
      { id: "infra-hold-end", from: "hold", to: "end", label: "next" },
    ],
  },
  {
    id: "product-feedback",
    name: "Product feedback agent",
    description: "Collect user feedback, triage signals, and create product delivery work.",
    nodes: [
      { id: "start", kind: "start", title: "Start", detail: "Product area, customer segment, and timeframe.", x: 645, y: 50, tools: [], condition: "", branches: ["next"] },
      { id: "collect", kind: "tool", title: "Collect feedback", detail: "Pull issues, merge requests, workflow status, and operational logs.", x: 645, y: 205, tools: ["github", "gitlab", "aws"], condition: "", branches: ["next"] },
      { id: "cluster", kind: "step", title: "Cluster themes", detail: "Group feedback into product themes, severity, and customer impact.", x: 645, y: 365, tools: [], condition: "", branches: ["next"] },
      { id: "triage", kind: "condition", title: "Triage decision", detail: "Choose immediate delivery, research, or backlog.", x: 645, y: 525, tools: [], condition: "return 'delivery' for validated high-impact themes", branches: ["delivery", "research", "backlog"] },
      { id: "delivery", kind: "tool", title: "Open delivery work", detail: "Create delivery PR/MR or issue artifacts for the chosen theme.", x: 385, y: 700, tools: ["github", "gitlab"], condition: "", branches: ["next"] },
      { id: "research", kind: "tool", title: "Open research loop", detail: "Create research tasks and gather repo/package context.", x: 645, y: 700, tools: ["github", "npm"], condition: "", branches: ["next"] },
      { id: "backlog", kind: "step", title: "Backlog summary", detail: "Write a prioritized backlog note with customer evidence.", x: 905, y: 700, tools: [], condition: "", branches: ["next"] },
      { id: "end", kind: "end", title: "End", detail: "Compiled graph returns here.", x: 645, y: 860, tools: [], condition: "", branches: ["done"] },
    ],
    edges: [
      { id: "product-start-collect", from: "start", to: "collect", label: "next" },
      { id: "product-collect-cluster", from: "collect", to: "cluster", label: "next" },
      { id: "product-cluster-triage", from: "cluster", to: "triage", label: "next" },
      { id: "product-triage-delivery", from: "triage", to: "delivery", label: "delivery" },
      { id: "product-triage-research", from: "triage", to: "research", label: "research" },
      { id: "product-triage-backlog", from: "triage", to: "backlog", label: "backlog" },
      { id: "product-delivery-end", from: "delivery", to: "end", label: "next" },
      { id: "product-research-end", from: "research", to: "end", label: "next" },
      { id: "product-backlog-end", from: "backlog", to: "end", label: "next" },
    ],
  },
  {
    id: "marketing-launch",
    name: "Marketing launch agent",
    description: "Prepare a launch package, publish artifacts, and verify distribution.",
    nodes: [
      { id: "start", kind: "start", title: "Start", detail: "Launch brief, package path, and channel list.", x: 645, y: 50, tools: [], condition: "", branches: ["next"] },
      { id: "package", kind: "tool", title: "Inspect package", detail: "Read package metadata, audit dependencies, and run tests.", x: 645, y: 205, tools: ["npm"], condition: "", branches: ["next"] },
      { id: "assets", kind: "tool", title: "Prepare assets", detail: "Build the site/package and sync launch assets to S3.", x: 645, y: 365, tools: ["npm", "aws"], condition: "", branches: ["next"] },
      { id: "launch-gate", kind: "condition", title: "Launch gate", detail: "Route based on readiness, approvals, and audit status.", x: 645, y: 525, tools: [], condition: "return 'publish' when launch assets and approvals are ready", branches: ["publish", "revise"] },
      { id: "publish", kind: "tool", title: "Publish release", detail: "Create release notes, publish package, and refresh CDN.", x: 450, y: 700, tools: ["github", "npm", "aws"], condition: "", branches: ["next"] },
      { id: "revise", kind: "step", title: "Revise launch", detail: "Return blockers, copy edits, and remaining launch tasks.", x: 850, y: 700, tools: [], condition: "", branches: ["next"] },
      { id: "verify", kind: "tool", title: "Verify launch", detail: "Check S3 objects, CloudWatch logs, and repository release state.", x: 645, y: 840, tools: ["aws", "github"], condition: "", branches: ["next"] },
      { id: "end", kind: "end", title: "End", detail: "Compiled graph returns here.", x: 645, y: 850, tools: [], condition: "", branches: ["done"] },
    ],
    edges: [
      { id: "marketing-start-package", from: "start", to: "package", label: "next" },
      { id: "marketing-package-assets", from: "package", to: "assets", label: "next" },
      { id: "marketing-assets-gate", from: "assets", to: "launch-gate", label: "next" },
      { id: "marketing-gate-publish", from: "launch-gate", to: "publish", label: "publish" },
      { id: "marketing-gate-revise", from: "launch-gate", to: "revise", label: "revise" },
      { id: "marketing-publish-verify", from: "publish", to: "verify", label: "next" },
      { id: "marketing-revise-end", from: "revise", to: "end", label: "next" },
      { id: "marketing-verify-end", from: "verify", to: "end", label: "next" },
    ],
  },
];

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

const generatedStateKeys = new Set(["messages", "artifacts", "data", "cwd", "tool_args", "approvals", "route"]);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const pythonKeywords = new Set([
  "and",
  "as",
  "assert",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);
const pythonAsyncKeywords = new Set(["async", "await"]);
const pythonBuiltins = new Set([
  "Any",
  "Boolean",
  "Exception",
  "ImportError",
  "KeyError",
  "Literal",
  "NoneType",
  "PermissionError",
  "RuntimeError",
  "StateGraph",
  "String",
  "TypedDict",
  "ValueError",
  "bool",
  "dict",
  "float",
  "int",
  "isinstance",
  "len",
  "list",
  "max",
  "min",
  "print",
  "range",
  "set",
  "sorted",
  "str",
  "sum",
  "tuple",
  "type",
]);
const pythonConstants = new Set(["False", "None", "NotImplemented", "True"]);

function pythonToken(className, value) {
  return `<span class="py-token ${className}">${escapeHtml(value)}</span>`;
}

function isPythonIdentifierStart(char) {
  return /[A-Za-z_]/.test(char);
}

function isPythonIdentifierPart(char) {
  return /[A-Za-z0-9_]/.test(char);
}

function nextNonSpace(source, index) {
  let cursor = index;
  while (cursor < source.length && /[ \t]/.test(source[cursor])) cursor += 1;
  return source[cursor] || "";
}

function readPythonString(source, index) {
  let openerEnd = index;
  while (openerEnd - index < 3 && /[rRuUbBfF]/.test(source[openerEnd] || "")) {
    openerEnd += 1;
  }
  if (openerEnd === index && source[index] !== '"' && source[index] !== "'") return null;
  if (source[openerEnd] !== '"' && source[openerEnd] !== "'") return null;
  const quoteChar = source[openerEnd];
  const triple = source[openerEnd + 1] === quoteChar && source[openerEnd + 2] === quoteChar;
  const quote = triple ? quoteChar.repeat(3) : quoteChar;
  let cursor = openerEnd + quote.length;
  while (cursor < source.length) {
    if (source.startsWith(quote, cursor)) {
      cursor += quote.length;
      break;
    }
    if (!triple && source[cursor] === "\n") break;
    if (source[cursor] === "\\") {
      cursor += 2;
    } else {
      cursor += 1;
    }
  }
  return source.slice(index, cursor);
}

function highlightPython(source) {
  let index = 0;
  const highlighted = [];
  let expectFunctionName = false;
  let expectClassName = false;
  const text = String(source || "");

  while (index < text.length) {
    const char = text[index];
    const stringToken = readPythonString(text, index);
    if (stringToken) {
      highlighted.push(pythonToken("py-string", stringToken));
      index += stringToken.length;
      continue;
    }

    if (char === "#") {
      let cursor = index;
      while (cursor < text.length && text[cursor] !== "\n") cursor += 1;
      highlighted.push(pythonToken("py-comment", text.slice(index, cursor)));
      index = cursor;
      continue;
    }

    if (char === "@") {
      let cursor = index + 1;
      while (cursor < text.length && /[A-Za-z0-9_.]/.test(text[cursor])) cursor += 1;
      highlighted.push(pythonToken("py-decorator", text.slice(index, cursor)));
      index = cursor;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let cursor = index + 1;
      while (cursor < text.length && /[A-Za-z0-9_.]/.test(text[cursor])) cursor += 1;
      highlighted.push(pythonToken("py-number", text.slice(index, cursor)));
      index = cursor;
      continue;
    }

    if (isPythonIdentifierStart(char)) {
      let cursor = index + 1;
      while (cursor < text.length && isPythonIdentifierPart(text[cursor])) cursor += 1;
      const word = text.slice(index, cursor);
      let className = "";
      if (expectFunctionName) {
        className = "py-definition";
        expectFunctionName = false;
      } else if (expectClassName) {
        className = "py-class-name";
        expectClassName = false;
      } else if (pythonAsyncKeywords.has(word)) {
        className = "py-async";
      } else if (pythonKeywords.has(word)) {
        className = "py-keyword";
      } else if (pythonConstants.has(word)) {
        className = "py-constant";
      } else if (word === "self" || word === "cls") {
        className = "py-self";
      } else if (pythonBuiltins.has(word)) {
        className = "py-builtin";
      } else if (nextNonSpace(text, cursor) === "(") {
        className = "py-call";
      }

      highlighted.push(className ? pythonToken(className, word) : escapeHtml(word));
      if (word === "def") expectFunctionName = true;
      if (word === "class") expectClassName = true;
      index = cursor;
      continue;
    }

    if (/[\[\]{}().,:;+\-*\/%=!<>|&^~]/.test(char)) {
      highlighted.push(pythonToken("py-operator", char));
      index += 1;
      continue;
    }

    highlighted.push(escapeHtml(char));
    index += 1;
  }

  return highlighted.join("");
}

function nodeById(id) {
  return state.nodes.find((node) => node.id === id) || null;
}

function edgeById(id) {
  return state.edges.find((edge) => edge.id === id) || null;
}

function lockedNode(node) {
  return node?.kind === "start" || node?.kind === "end";
}

function nodeMode(node) {
  if (lockedNode(node)) return "system";
  if (node?.mode === "code" || node?.mode === "ai") return node.mode;
  return "ai";
}

function isAiNode(node) {
  return nodeMode(node) === "ai";
}

function defaultPromptForNode(node) {
  return node?.condition || node?.detail || "Use the current state, produce the next state update, and cite any tool outputs used.";
}

function defaultCodeForNode(node) {
  if (node?.kind === "condition") {
    const branch = node.branches?.[0] || "next";
    return `return {"route": ${JSON.stringify(branch)}, "data": {"decision": ${JSON.stringify(branch)}}}`;
  }
  return "return {\"data\": {\"result\": {}}}";
}

function normalizeNode(rawNode) {
  const kind = nodeKinds[rawNode?.kind] ? rawNode.kind : "step";
  const toolAliases = { dofu: "tofu" };
  const normalized = {
    id: String(rawNode?.id || `${kind}-${Date.now().toString(36)}`),
    kind,
    title: String(rawNode?.title || nodeKinds[kind].label),
    detail: String(rawNode?.detail || nodeKinds[kind].description),
    x: Number.isFinite(rawNode?.x) ? rawNode.x : defaultNodeX,
    y: Number.isFinite(rawNode?.y) ? rawNode.y : 220,
    width: Number.isFinite(rawNode?.width)
      ? clamp(rawNode.width, nodeSizeLimits.width.min, nodeSizeLimits.width.max)
      : nodeFallbackSize.width,
    height: Number.isFinite(rawNode?.height)
      ? clamp(rawNode.height, nodeSizeLimits.height.min, nodeSizeLimits.height.max)
      : nodeFallbackSize.height,
    tools: Array.isArray(rawNode?.tools)
      ? rawNode.tools.map((tool) => toolAliases[String(tool)] || String(tool))
      : [],
    condition: String(rawNode?.condition || ""),
    branches: Array.isArray(rawNode?.branches) && rawNode.branches.length ? rawNode.branches.map(String) : ["next"],
    mode: rawNode?.mode === "code" || rawNode?.mode === "ai"
      ? rawNode.mode
      : kind === "condition"
        ? "code"
        : "ai",
    prompt: typeof rawNode?.prompt === "string" ? rawNode.prompt : "",
    code: typeof rawNode?.code === "string" ? rawNode.code : "",
    codeCheck: typeof rawNode?.codeCheck === "string" ? rawNode.codeCheck : "",
  };

  if (lockedNode(normalized)) {
    normalized.mode = "system";
    normalized.prompt = "";
    normalized.code = "";
    normalized.tools = [];
    normalized.width = nodeFallbackSize.width;
    normalized.height = nodeFallbackSize.height;
    return normalized;
  }

  if (!normalized.prompt) normalized.prompt = defaultPromptForNode(normalized);
  if (!normalized.code) normalized.code = defaultCodeForNode(normalized);
  if (!isAiNode(normalized)) normalized.tools = [];
  return normalized;
}

function normalizeNodes(nodes) {
  return Array.isArray(nodes) ? nodes.map(normalizeNode) : createInitialNodes();
}

function setNodeMode(node, mode) {
  if (!node || lockedNode(node)) return;
  node.mode = mode === "code" ? "code" : "ai";
  if (node.mode === "code") {
    node.tools = [];
    if (!node.code) node.code = defaultCodeForNode(node);
  } else if (!node.prompt) {
    node.prompt = defaultPromptForNode(node);
  }
}

function normalizeTool(rawTool) {
  const name = String(rawTool?.name || rawTool?.id || "Tool").trim();
  const id = sanitizeIdentifier(rawTool?.id || name, "tool");
  const category = String(rawTool?.category || "Custom").trim() || "Custom";
  const command = Array.isArray(rawTool?.command) ? rawTool.command.map((part) => String(part)) : [];
  const binary = String(rawTool?.binary || command[0] || "").trim();
  const commandPackUrl = String(rawTool?.commandPackUrl || rawTool?.packUrl || "").trim();
  const commands = Array.isArray(rawTool?.commands)
    ? rawTool.commands.map((commandItem) => ({
        id: sanitizeIdentifier(commandItem?.id || commandItem?.name || "command", "command"),
        name: String(commandItem?.name || commandItem?.id || "Command").trim(),
        description: String(commandItem?.description || "").trim(),
        command: Array.isArray(commandItem?.command) ? commandItem.command.map((part) => String(part)) : [],
        subcommand: Array.isArray(commandItem?.subcommand) ? commandItem.subcommand.map((part) => String(part)) : [],
        defaults:
          commandItem?.defaults && typeof commandItem.defaults === "object" && !Array.isArray(commandItem.defaults)
            ? Object.fromEntries(Object.entries(commandItem.defaults).map(([key, value]) => [key, String(value)]))
            : {},
        mutates: Boolean(commandItem?.mutates),
      }))
    : [];
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
    binary,
    commandPackUrl,
    commands,
    defaults,
    mutates: Boolean(rawTool?.mutates),
    custom: Boolean(rawTool?.custom),
    pack: Boolean(rawTool?.pack || commandPackUrl || commands.length),
    storage: rawTool?.storage && typeof rawTool.storage === "object" && !Array.isArray(rawTool.storage) ? rawTool.storage : null,
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
  if (tool?.pack) {
    const loaded = state.loadedPacks[tool.id]?.commands?.length;
    if (loaded) return `${loaded} commands`;
    if (tool.commandPackUrl) return "remote pack";
    if (tool.commands?.length) return `${tool.commands.length} commands`;
  }
  if (!tool?.command?.length) return "custom";
  return tool.command.slice(0, 3).join(" ");
}

function toolCategories() {
  return [...new Set(allTools().map((tool) => tool.category))].sort((a, b) => a.localeCompare(b));
}

function toolMatchesFilter(tool) {
  const query = state.toolFilter.trim().toLowerCase();
  const commandNames = [
    ...(tool.commands || []).flatMap((command) => [command.name, command.description, command.command.join(" ")]),
    ...(state.loadedPacks[tool.id]?.commands || []).flatMap((command) => [command.name, command.description, command.command.join(" ")]),
  ];
  const searchMatches = [tool.name, tool.category, tool.description, tool.binary, tool.commandPackUrl, tool.command.join(" "), ...commandNames]
    .join(" ")
    .toLowerCase()
    .includes(query);
  if (query) return searchMatches;
  return state.toolCategory === "all" || tool.category === state.toolCategory;
}

function filteredTools() {
  return allTools().filter(toolMatchesFilter);
}

function normalizeCommandPack(rawPack) {
  const commands = Array.isArray(rawPack?.commands)
    ? rawPack.commands.map((command) => normalizeTool({ ...command, id: command.id || command.name }).commands?.[0] || {
        id: sanitizeIdentifier(command?.id || command?.name || "command", "command"),
        name: String(command?.name || command?.id || "Command"),
        description: String(command?.description || ""),
        command: Array.isArray(command?.command) ? command.command.map(String) : [],
        subcommand: Array.isArray(command?.subcommand) ? command.subcommand.map(String) : [],
        defaults:
          command?.defaults && typeof command.defaults === "object" && !Array.isArray(command.defaults)
            ? Object.fromEntries(Object.entries(command.defaults).map(([key, value]) => [key, String(value)]))
            : {},
        mutates: Boolean(command?.mutates),
      })
    : [];
  return {
    version: rawPack?.version || 1,
    id: String(rawPack?.id || ""),
    name: String(rawPack?.name || ""),
    binary: String(rawPack?.binary || ""),
    commands,
  };
}

async function ensureToolPack(toolId) {
  const tool = toolById(toolId);
  if (!tool?.pack || !tool.commandPackUrl || state.loadedPacks[tool.id]) return;
  state.packStatus[tool.id] = "Loading command pack...";
  if (els.toolList && els.inspector) {
    renderTools();
    renderInspector();
  }
  try {
    const response = await fetch(tool.commandPackUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const pack = normalizeCommandPack(await response.json());
    if (!pack.commands.length) throw new Error("empty command pack");
    state.loadedPacks[tool.id] = pack;
    state.packStatus[tool.id] = `${pack.commands.length} commands loaded`;
  } catch (error) {
    state.packStatus[tool.id] = "Command pack could not be fetched; export will keep the pack boundary.";
    console.warn(`Command pack unavailable for ${tool.id}`, error);
  }
}

async function ensureSelectedToolPacks() {
  const selectedToolIds = [
    ...new Set(state.nodes.filter(isAiNode).flatMap((node) => (Array.isArray(node.tools) ? node.tools : []))),
  ];
  for (const toolId of selectedToolIds) {
    await ensureToolPack(toolId);
  }
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

function nodeContainsPoint(node, point, padding = 0) {
  const bounds = nodeBounds(node);
  return (
    point.x >= bounds.x - padding &&
    point.x <= bounds.x + bounds.width + padding &&
    point.y >= bounds.y - padding &&
    point.y <= bounds.y + bounds.height + padding
  );
}

function connectionTargetIdAtClientPoint(clientX, clientY, sourceId) {
  const point = canvasPointFromClient(clientX, clientY);
  const candidates = state.nodes
    .filter((node) => node.id !== sourceId && node.kind !== "start")
    .slice()
    .reverse();
  return (
    candidates.find((node) => nodeContainsPoint(node, point, 0))?.id ||
    candidates.find((node) => nodeContainsPoint(node, point, 34))?.id ||
    null
  );
}

function setConnectionDropTarget(targetId) {
  if (state.connectionDraft) {
    state.connectionDraft.targetId = targetId || null;
  }
  document.querySelectorAll(".node-card").forEach((card) => {
    card.classList.toggle("is-connect-target", Boolean(targetId) && card.dataset.id === targetId);
  });
}

function clearConnectionDropTarget() {
  document.querySelectorAll(".node-card.is-connect-target").forEach((card) => {
    card.classList.remove("is-connect-target");
  });
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
      width: nodeFallbackSize.width,
      height: nodeFallbackSize.height,
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
      width: nodeFallbackSize.width,
      height: nodeFallbackSize.height,
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

function persistentSnapshot() {
  return {
    layoutVersion: consoleLayoutVersion,
    nodes: cloneValue(state.nodes),
    edges: cloneValue(state.edges),
    customTools: cloneValue(state.customTools),
    selectedNodeId: state.selectedNodeId,
    selectedEdgeId: state.selectedEdgeId,
    nextNodeNumber: state.nextNodeNumber,
    toolFilter: state.toolFilter,
    toolCategory: state.toolCategory,
    sampleFlowId: state.sampleFlowId,
    zoom: state.zoom,
    sidebarCollapsed: state.sidebarCollapsed,
    inspectorCollapsed: state.inspectorCollapsed,
    sidebarWidth: state.sidebarWidth,
    inspectorWidth: state.inspectorWidth,
    codePanelHeight: state.codePanelHeight,
  };
}

function savePersistentState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(persistentSnapshot()));
  } catch {
    // Persistence should never block graph editing.
  }
}

function restorePersistentState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.nodes) && Array.isArray(saved.edges)) {
      state.nodes = normalizeNodes(cloneValue(saved.nodes));
      state.edges = cloneValue(saved.edges);
    }
    if (Array.isArray(saved.customTools)) state.customTools = cloneValue(saved.customTools);
    state.selectedNodeId = state.nodes.some((node) => node.id === saved.selectedNodeId) ? saved.selectedNodeId : "start";
    state.selectedEdgeId = state.edges.some((edge) => edge.id === saved.selectedEdgeId) ? saved.selectedEdgeId : null;
    state.nextNodeNumber = Number.isFinite(saved.nextNodeNumber) ? saved.nextNodeNumber : state.nextNodeNumber;
    state.toolFilter = typeof saved.toolFilter === "string" ? saved.toolFilter : "";
    state.toolCategory = typeof saved.toolCategory === "string" ? saved.toolCategory : "all";
    state.sampleFlowId = sampleFlows.some((sample) => sample.id === saved.sampleFlowId)
      ? saved.sampleFlowId
      : sampleFlows[0].id;
    state.zoom = Number.isFinite(saved.zoom) ? clamp(saved.zoom, zoomRange.min, zoomRange.max) : 1;
    state.sidebarCollapsed = Boolean(saved.sidebarCollapsed);
    state.inspectorCollapsed = Boolean(saved.inspectorCollapsed);
    const savedLayoutIsCurrent = saved.layoutVersion === consoleLayoutVersion;
    state.sidebarWidth = savedLayoutIsCurrent && Number.isFinite(saved.sidebarWidth)
      ? clamp(Math.round(saved.sidebarWidth), panelSizeLimits.sidebarWidth.min, panelSizeLimits.sidebarWidth.max)
      : panelSizeDefaults.sidebarWidth;
    state.inspectorWidth = savedLayoutIsCurrent && Number.isFinite(saved.inspectorWidth)
      ? clamp(Math.round(saved.inspectorWidth), panelSizeLimits.inspectorWidth.min, panelSizeLimits.inspectorWidth.max)
      : panelSizeDefaults.inspectorWidth;
    state.codePanelHeight = savedLayoutIsCurrent && Number.isFinite(saved.codePanelHeight)
      ? clamp(Math.round(saved.codePanelHeight), panelSizeLimits.codePanelHeight.min, panelSizeLimits.codePanelHeight.max)
      : panelSizeDefaults.codePanelHeight;
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function pushHistorySnapshot(snapshot = graphSnapshot()) {
  state.history.undo.push(snapshot);
  if (state.history.undo.length > state.history.limit) {
    state.history.undo.shift();
  }
  state.history.redo = [];
}

function restoreGraphSnapshot(snapshot) {
  state.nodes = normalizeNodes(cloneValue(snapshot.nodes));
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
  const mode = kind === "condition" ? "code" : "ai";
  const title = `${nodeKinds[kind].label} ${number}`;
  const branches = kind === "condition" ? ["yes", "no"] : ["next"];
  state.nodes.push({
    id,
    kind,
    title,
    detail:
      kind === "condition"
        ? "Route state into named branches."
        : "Transform state and return updates.",
    x: position.x,
    y: position.y,
    width: nodeFallbackSize.width,
    height: nodeFallbackSize.height,
    tools: [],
    mode,
    prompt:
      mode === "ai"
        ? "Use the current state and any selected provider packs to complete this node."
        : "Use the current state to decide the next workflow update.",
    code: kind === "condition" ? `return {"route": ${JSON.stringify(branches[0])}}` : "return {}",
    condition: kind === "condition" ? "return 'yes' when the state is ready" : "",
    branches,
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

function addEdge(from, to, labelOverride = "", options = {}) {
  if (!from || !to || from === to) return;
  const source = nodeById(from);
  const label = labelOverride || (source?.kind === "condition" ? firstUnusedBranch(source) : "next");
  const selection = options.select || "target";
  if (state.edges.some((edge) => edge.from === from && edge.to === to && edge.label === label)) {
    state.connectSourceId = null;
    if (selection === "source") selectNode(from);
    else if (selection === "target") selectNode(to);
    return;
  }
  pushHistorySnapshot();
  const id = `edge-${from}-${to}-${Date.now().toString(36)}`;
  state.edges.push({ id, from, to, label });
  state.connectSourceId = null;
  if (selection === "edge") {
    selectEdge(id);
  } else if (selection === "source") {
    selectNode(from);
  } else {
    selectNode(to);
  }
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

function addCustomTool(name, description) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const detail = description.trim() || `Implement the ${trimmed} custom tool behavior.`;
  const existingTool = allTools().find((tool) => tool.name.toLowerCase() === trimmed.toLowerCase());
  let id = existingTool?.id;
  pushHistorySnapshot();
  if (!id) {
    const idBase = `custom_${sanitizeIdentifier(trimmed, "tool")}`;
    id = idBase;
    let suffix = 2;
    const existingIds = new Set(allTools().map((tool) => tool.id));
    while (existingIds.has(id)) {
      id = `${idBase}_${suffix}`;
      suffix += 1;
    }
  }
  if (!existingTool) {
    state.customTools.push({
      id,
      name: trimmed,
      category: "Custom",
      description: detail,
      command: [],
      defaults: {},
      mutates: false,
      custom: true,
    });
  }
  let node = nodeById(state.selectedNodeId);
  if (!node || lockedNode(node) || !isAiNode(node)) {
    const position = nextPosition();
    const nodeId = `step-${Date.now().toString(36)}-${state.nextNodeNumber}`;
    state.nextNodeNumber += 1;
    node = {
      id: nodeId,
      kind: "step",
      title: trimmed,
      detail,
      x: position.x,
      y: position.y,
      width: nodeFallbackSize.width,
      height: nodeFallbackSize.height,
      tools: [],
      mode: "ai",
      prompt: detail,
      code: "return {}",
      condition: "",
      branches: ["next"],
    };
    state.nodes.push(node);
    state.selectedNodeId = node.id;
    state.selectedEdgeId = null;
  }
  if (!node.tools.includes(id)) {
    node.tools.push(id);
  }
  els.customToolInput.value = "";
  els.customToolDescription.value = "";
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
  centerCanvasView();
}

function loadSampleFlow(sampleId = state.sampleFlowId) {
  const sample = sampleFlows.find((item) => item.id === sampleId) || sampleFlows[0];
  pushHistorySnapshot();
  state.nodes = normalizeNodes(cloneValue(sample.nodes));
  state.edges = cloneValue(sample.edges);
  state.sampleFlowId = sample.id;
  state.selectedNodeId = "start";
  state.selectedEdgeId = null;
  state.connectSourceId = null;
  state.connectionDraft = null;
  state.zoom = 1;
  state.nextNodeNumber = Math.max(
    1,
    state.nodes.filter((node) => !["start", "end"].includes(node.kind)).length + 1,
  );
  render();
  centerCanvasView();
  ensureSelectedToolPacks().then(() => render());
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

function centerCanvasView() {
  if (!els.canvasFrame) return;
  const targetX = (defaultNodeX + nodeFallbackSize.width / 2) * state.zoom;
  els.canvasFrame.scrollLeft = Math.max(0, targetX - els.canvasFrame.clientWidth / 2);
  els.canvasFrame.scrollTop = 0;
}

function renderNodes() {
  els.nodeLayer.innerHTML = "";
  for (const node of state.nodes) {
    const element = document.createElement("article");
    element.className = "node-card";
    element.dataset.id = node.id;
    element.dataset.kind = node.kind;
    element.dataset.mode = nodeMode(node);
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
    element.style.width = `${node.width || nodeFallbackSize.width}px`;
    element.style.height = `${node.height || nodeFallbackSize.height}px`;
    if (state.selectedNodeId === node.id) element.classList.add("is-selected");
    if (state.connectSourceId === node.id) element.classList.add("is-connect-source");
    if (state.connectionDraft?.targetId === node.id) element.classList.add("is-connect-target");
    const tools = lockedNode(node)
      ? ""
      : isAiNode(node)
        ? node.tools.map((toolId) => `<span>${escapeHtml(toolLabel(toolId))}</span>`).join("")
        : '<span class="node-code-pill">Python</span>';
    const modeBadge = lockedNode(node) ? "" : `<span class="node-mode-badge">${isAiNode(node) ? "AI" : "PY"}</span>`;
    const summary = isAiNode(node) ? node.prompt || node.detail || nodeKinds[node.kind].description : node.detail || "Python code node.";
    const ports = renderNodePorts(node);
    element.innerHTML = `
      ${ports}
      <header>
        <span class="node-glyph">${escapeHtml(nodeKinds[node.kind].glyph)}</span>
        <h3>${escapeHtml(node.title)}</h3>
        ${modeBadge}
      </header>
      <p>${escapeHtml(summary)}</p>
      <div class="node-tools">${tools}</div>
      ${lockedNode(node) ? "" : '<button class="node-resize-handle" type="button" title="Resize node" aria-label="Resize node"></button>'}
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
    if (event.target.closest(".node-resize-handle")) return;
    if (event.button !== 0) return;
    event.preventDefault();
    if (state.connectSourceId && state.connectSourceId !== node.id) {
      addEdge(state.connectSourceId, node.id, "", { select: "target" });
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
      node.x = Math.max(20, Math.min(canvasSize.width - (node.width || nodeFallbackSize.width) - 20, nextX));
      node.y = Math.max(20, Math.min(canvasSize.height - (node.height || nodeFallbackSize.height) - 20, nextY));
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

  const resizeHandle = element.querySelector(".node-resize-handle");
  resizeHandle?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    startNodeResize(node, element, resizeHandle, event);
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
      addEdge(state.connectSourceId, node.id, "", { select: "target" });
    });
    inputPort.addEventListener("click", (event) => {
      if (!state.connectSourceId || state.connectSourceId === node.id) return;
      event.preventDefault();
      event.stopPropagation();
      addEdge(state.connectSourceId, node.id, "", { select: "target" });
    });
  });
}

function startNodeResize(node, element, handle, event) {
  handle.setPointerCapture(event.pointerId);
  const origin = {
    x: event.clientX,
    y: event.clientY,
    width: node.width || nodeFallbackSize.width,
    height: node.height || nodeFallbackSize.height,
  };
  const beforeResize = graphSnapshot();
  let resized = false;

  function onMove(moveEvent) {
    const nextWidth = origin.width + (moveEvent.clientX - origin.x) / state.zoom;
    const nextHeight = origin.height + (moveEvent.clientY - origin.y) / state.zoom;
    node.width = Math.round(clamp(nextWidth, nodeSizeLimits.width.min, nodeSizeLimits.width.max));
    node.height = Math.round(clamp(nextHeight, nodeSizeLimits.height.min, nodeSizeLimits.height.max));
    resized = true;
    element.style.width = `${node.width}px`;
    element.style.height = `${node.height}px`;
    renderEdges();
  }

  function onUp() {
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onCancel);
    if (handle.hasPointerCapture?.(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    if (resized) pushHistorySnapshot(beforeResize);
    render();
  }

  function onCancel() {
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onCancel);
    if (handle.hasPointerCapture?.(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    restoreGraphSnapshot(beforeResize);
  }

  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onCancel);
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
    targetId: null,
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
    const targetId = connectionTargetIdAtClientPoint(moveEvent.clientX, moveEvent.clientY, node.id);
    state.connectionDraft = {
      from: node.id,
      x: point.x,
      y: point.y,
      targetId,
    };
    setConnectionDropTarget(targetId);
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
    const targetId = connectionTargetIdAtClientPoint(upEvent.clientX, upEvent.clientY, node.id) || state.connectionDraft?.targetId;
    state.connectionDraft = null;
    state.connectSourceId = null;
    state.suppressNextPortClick = moved;
    clearConnectionDropTarget();
    if (targetId && targetId !== node.id) {
      addEdge(node.id, targetId, "", { select: "target" });
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
    clearConnectionDropTarget();
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
        <path class="edge-hit-area" data-edge-id="${escapeHtml(edge.id)}" d="${curve.path}"></path>
        <path class="edge-path${selected}${conditional}" data-edge-id="${escapeHtml(edge.id)}" d="${curve.path}" marker-end="url(#arrow-head)"></path>
        <text class="edge-label" data-edge-id="${escapeHtml(edge.id)}" x="${curve.labelX}" y="${curve.labelY}" text-anchor="middle">${escapeHtml(edge.label)}</text>
      `;
    })
    .join("");
  const draft = renderDraftEdge();
  els.edgeLayer.innerHTML = `${defs}${edges}${draft}`;
  els.edgeLayer.querySelectorAll("[data-edge-id]").forEach((edgeElement) => {
    edgeElement.style.pointerEvents = edgeElement.classList.contains("edge-hit-area") ? "stroke" : "auto";
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
  const target = state.connectionDraft.targetId ? nodeById(state.connectionDraft.targetId) : null;
  const { start, end } = target
    ? edgeAnchors(from, target)
    : {
        start: anchorPoint(from, { x: state.connectionDraft.x, y: state.connectionDraft.y }),
        end: { x: state.connectionDraft.x, y: state.connectionDraft.y },
      };
  const curve = edgeCurve(start, end);
  return `<path class="edge-path is-draft" d="${curve.path}" marker-end="url(#arrow-head)"></path>`;
}

function renderTools() {
  renderToolControls();
  const tools = filteredTools();
  const globalSearch = state.toolFilter.trim() ? " global search" : "";
  const selectedNode = nodeById(state.selectedNodeId);
  const canAttach = Boolean(selectedNode && isAiNode(selectedNode));
  els.toolMeta.textContent = canAttach
    ? `${tools.length} of ${allTools().length} provider packs${globalSearch}`
    : `${tools.length} provider packs · select an AI-enabled node to attach`;
  els.toolList.innerHTML =
    tools
      .map((tool) => renderToolChip(tool, "data-tool", canAttach && selectedNode?.tools.includes(tool.id), !canAttach))
      .join("") || '<div class="inspector-empty">No tools match this filter.</div>';
  els.toolList.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", async () => {
      const node = nodeById(state.selectedNodeId);
      if (!node || !isAiNode(node)) return;
      const tool = button.dataset.tool;
      pushHistorySnapshot();
      if (node.tools.includes(tool)) {
        node.tools = node.tools.filter((item) => item !== tool);
      } else {
        node.tools.push(tool);
        await ensureToolPack(tool);
      }
      render();
    });
  });
  attachToolCodeHandlers(els.toolList);
}

function renderToolControls() {
  const categories = ["all", ...toolCategories()];
  const categoryExists = categories.includes(state.toolCategory);
  if (!categoryExists) state.toolCategory = "all";

  els.toolSearchInput.value = state.toolFilter;
  els.toolCategory.innerHTML = categories
    .map((category) => {
      const label = category === "all" ? "All packs" : category;
      return `<option value="${escapeHtml(category)}" ${state.toolCategory === category ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function renderToolChip(tool, attributeName, selected = false, disabled = false) {
  const selectedClass = selected ? " is-selected" : "";
  const disabledClass = disabled ? " is-disabled" : "";
  const mutates = tool.mutates ? '<span class="tool-chip-risk">writes</span>' : "";
  const pack = tool.pack ? '<span class="tool-chip-pack">pack</span>' : "";
  const status = state.packStatus[tool.id] ? `<span class="tool-chip-status">${escapeHtml(state.packStatus[tool.id])}</span>` : "";
  const codeLabel = `View generated Python for ${tool.name}`;
  return `
    <div class="tool-chip-shell">
      <button class="tool-chip${selectedClass}${disabledClass}" type="button" ${attributeName}="${escapeHtml(tool.id)}" title="${escapeHtml(tool.description)}" ${disabled ? "disabled" : ""}>
        <span class="tool-chip-head">
          <span class="tool-chip-name">${escapeHtml(tool.name)}</span>
          ${pack}
          ${mutates}
        </span>
        <span class="tool-chip-meta">${escapeHtml(tool.category)} · ${escapeHtml(toolCommandLabel(tool))}</span>
        ${status}
      </button>
      <button class="tool-code-button" type="button" data-tool-code="${escapeHtml(tool.id)}" title="${escapeHtml(codeLabel)}" aria-label="${escapeHtml(codeLabel)}">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m8 9-4 3 4 3"/><path d="m16 9 4 3-4 3"/><path d="m14 5-4 14"/></svg>
      </button>
    </div>
  `;
}

function attachToolCodeHandlers(container) {
  container.querySelectorAll("[data-tool-code]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await openToolCode(button.dataset.toolCode);
    });
  });
}

function toolPythonSnippet(tool) {
  const commands = commandsForPack(tool);
  const functionBlocks = commands.length
    ? commands.map((command) => commandToolFunction(tool, command))
    : [customToolFunction(tool)];
  const toolNames = commands.length
    ? commands.map((command) => sanitizeIdentifier(command.id, "tool_command"))
    : [`run_${sanitizeIdentifier(tool.id, "tool")}`];
  return [
    "from __future__ import annotations",
    "",
    "from typing import Any",
    "import subprocess",
    "",
    "try:",
    "    from langchain_core.tools import tool",
    "except ImportError:",
    "    from langchain.tools import tool",
    "",
    "",
    "def _format_command(template: list[str], values: dict[str, Any]) -> list[str]:",
    "    formatted: list[str] = []",
    "    for part in template:",
    "        try:",
    "            value = str(part).format(**values)",
    "        except KeyError as exc:",
    "            missing = exc.args[0]",
    "            raise KeyError(f\"Missing required tool argument: {missing}\") from exc",
    "        if value:",
    "            formatted.append(value)",
    "    return formatted",
    "",
    "",
    "def _run_command(",
    "    tool_name: str,",
    "    command_id: str,",
    "    command: list[str],",
    "    cwd: str | None = None,",
    "    timeout_seconds: int = 120,",
    ") -> dict[str, Any]:",
    "    completed = subprocess.run(",
    "        command,",
    "        cwd=cwd,",
    "        text=True,",
    "        capture_output=True,",
    "        check=False,",
    "        timeout=timeout_seconds,",
    "    )",
    "    return {",
    "        \"tool\": tool_name,",
    "        \"command_id\": command_id,",
    "        \"command\": command,",
    "        \"returncode\": completed.returncode,",
    "        \"stdout\": completed.stdout,",
    "        \"stderr\": completed.stderr,",
    "    }",
    "",
    ...functionBlocks.flatMap((block) => ["", block]),
    "",
    `TOOLS = [${toolNames.join(", ")}]`,
    "TOOLS_BY_NAME = {item.name: item for item in TOOLS}",
  ].join("\n");
}

function commandToolFunction(tool, command) {
  const functionName = sanitizeIdentifier(command.id, "tool_command");
  const parameters = commandSignatureParameters(command);
  const description = command.description || `Run ${command.name || command.id} from ${tool.name}.`;
  const lines = [
    "@tool",
    `def ${functionName}(${parameters.join(", ")}) -> dict[str, Any]:`,
    `    ${pythonDocString(description)}`,
  ];
  if (command.mutates) {
    lines.push(
      "    if not approved:",
      `        raise PermissionError(${pythonString(`${command.name || command.id} can change external state; pass approved=True after human review.`)})`,
    );
  }
  lines.push(
    `    command = _format_command(${pythonLiteral(command.command)}, locals())`,
    `    return _run_command(${pythonString(tool.name)}, ${pythonString(command.id)}, command, cwd, timeout_seconds)`,
  );
  return lines.join("\n");
}

function customToolFunction(tool) {
  const functionName = `run_${sanitizeIdentifier(tool.id, "tool")}`;
  return [
    "@tool",
    `def ${functionName}(state: dict[str, Any]) -> dict[str, Any]:`,
    `    ${pythonDocString(tool.description || `Implement ${tool.name}.`)}`,
    "    return {\"status\": \"not_implemented\", \"state\": state}",
  ].join("\n");
}

function commandSignatureParameters(command) {
  const parameters = commandPlaceholders(command.command).map((name) => {
    const pythonName = sanitizeIdentifier(name, "value");
    const defaultValue = Object.prototype.hasOwnProperty.call(command.defaults || {}, name)
      ? command.defaults[name]
      : "";
    return `${pythonName}: str = ${pythonString(defaultValue)}`;
  });
  if (command.mutates) parameters.push("approved: bool = False");
  parameters.push("cwd: str | None = None", "timeout_seconds: int = 120");
  return parameters;
}

function commandPlaceholders(commandParts) {
  const names = [];
  const seen = new Set();
  for (const part of commandParts || []) {
    for (const match of String(part).matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        names.push(match[1]);
      }
    }
  }
  return names;
}

function pythonDocString(value) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replaceAll("\\", "\\\\")
    .replaceAll('"""', '\\"\\"\\"');
  return `"""${text || "Run the tool."}"""`;
}

async function openToolCode(toolId) {
  const tool = toolById(toolId);
  if (!tool) return;
  window.open(`/agent-console/?tool-code=${encodeURIComponent(tool.id)}`, "_blank");
}

function renderSamples() {
  const selected = sampleFlows.find((sample) => sample.id === state.sampleFlowId) || sampleFlows[0];
  state.sampleFlowId = selected.id;
  els.sampleFlowSelect.innerHTML = sampleFlows
    .map((sample) => `<option value="${escapeHtml(sample.id)}" ${sample.id === state.sampleFlowId ? "selected" : ""}>${escapeHtml(sample.name)}</option>`)
    .join("");
  els.sampleFlowMeta.textContent = selected.description;
}

function validatePythonBlock(code, node) {
  const messages = [];
  const source = String(code || "").replace(/\r\n/g, "\n");
  const trimmed = source.trim();
  if (!trimmed) {
    return [{ type: "warning", text: "Python code is empty." }];
  }

  const stack = [];
  const pairs = { "(": ")", "[": "]", "{": "}" };
  const closers = new Set(Object.values(pairs));
  let quote = "";
  let tripleQuote = "";
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next3 = source.slice(index, index + 3);
    if (tripleQuote) {
      if (next3 === tripleQuote) {
        tripleQuote = "";
        index += 2;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (next3 === "'''" || next3 === '"""') {
      tripleQuote = next3;
      index += 2;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (pairs[char]) stack.push(pairs[char]);
    if (closers.has(char) && stack.pop() !== char) {
      messages.push({ type: "warning", text: `Unbalanced delimiter near "${char}".` });
      break;
    }
  }
  if (quote || tripleQuote) messages.push({ type: "warning", text: "String literal is not closed." });
  if (stack.length) messages.push({ type: "warning", text: `Missing closing delimiter "${stack.at(-1)}".` });

  const lines = source.split("\n");
  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!line.trimEnd().endsWith(":")) continue;
    const currentIndent = line.match(/^\s*/)[0].length;
    const nextLine = lines.slice(index + 1).find((candidate) => candidate.trim() && !candidate.trim().startsWith("#"));
    if (!nextLine) {
      messages.push({ type: "warning", text: `Block starting on line ${index + 1} has no body.` });
      continue;
    }
    const nextIndent = nextLine.match(/^\s*/)[0].length;
    if (nextIndent <= currentIndent) {
      messages.push({ type: "warning", text: `Line ${index + 1} opens a block but the following body is not indented.` });
    }
  }

  if (/^\s*await\s+/m.test(source)) {
    messages.push({ type: "warning", text: "Generated node functions are synchronous; remove top-level await." });
  }
  if (!/^\s*return\b/m.test(source)) {
    messages.push({ type: "warning", text: "Add a return statement so LangGraph receives a node output." });
  }
  if (node?.kind === "condition" && !source.includes("route") && !/^\s*return\s+["'][^"']+["']/m.test(source)) {
    messages.push({ type: "warning", text: "Conditional code should return a branch string or a dict with a route matching one branch label." });
  }

  if (!messages.length) {
    messages.push({ type: "ok", text: "Static Python block check passed." });
  }
  return messages;
}

function renderPythonCheckList(messages) {
  return `<ul class="code-check-list">${messages
    .map((message) => `<li class="${message.type === "warning" ? "is-warning" : "is-ok"}">${escapeHtml(message.text)}</li>`)
    .join("")}</ul>`;
}

function renderPythonEditor(code) {
  const source = String(code || "");
  return `
    <label class="python-editor-label">
      Python code
      <div class="python-editor-shell">
        <pre class="python-editor-highlight" aria-hidden="true"><code data-python-highlight>${highlightPython(source)}\n</code></pre>
        <textarea class="python-editor" data-node-field="code" spellcheck="false" autocomplete="off" autocapitalize="off">${escapeHtml(source)}</textarea>
      </div>
    </label>
  `;
}

function syncPythonEditorHighlight(textarea) {
  const shell = textarea.closest(".python-editor-shell");
  const highlight = shell?.querySelector("[data-python-highlight]");
  const preview = shell?.querySelector(".python-editor-highlight");
  if (highlight) {
    highlight.innerHTML = `${highlightPython(textarea.value)}\n`;
  }
  if (preview) {
    preview.scrollTop = textarea.scrollTop;
    preview.scrollLeft = textarea.scrollLeft;
  }
}

function setupPythonEditorHighlights(container) {
  container.querySelectorAll(".python-editor").forEach((textarea) => {
    syncPythonEditorHighlight(textarea);
    textarea.addEventListener("input", () => syncPythonEditorHighlight(textarea));
    textarea.addEventListener("scroll", () => syncPythonEditorHighlight(textarea));
  });
}

function pythonNamesByNodeId() {
  const usedNames = new Set();
  const nameById = new Map();
  for (const graphNode of state.nodes.filter((candidate) => !lockedNode(candidate))) {
    nameById.set(graphNode.id, uniquePythonName(graphNode, usedNames));
  }
  return nameById;
}

function readPythonQuotedString(source, index) {
  const quote = source[index];
  if (quote !== '"' && quote !== "'") return null;
  let cursor = index + 1;
  let value = "";
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "\\") {
      value += source[cursor + 1] || "";
      cursor += 2;
      continue;
    }
    if (char === quote) {
      return { value, end: cursor + 1 };
    }
    value += char;
    cursor += 1;
  }
  return null;
}

function findMatchingPythonBrace(source, openIndex) {
  let depth = 0;
  let cursor = openIndex;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === '"' || char === "'") {
      const quoted = readPythonQuotedString(source, cursor);
      cursor = quoted ? quoted.end : cursor + 1;
      continue;
    }
    if (char === "#") {
      while (cursor < source.length && source[cursor] !== "\n") cursor += 1;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return cursor;
    }
    cursor += 1;
  }
  return -1;
}

function pythonDictKeys(dictLiteral) {
  const keys = [];
  let depth = 0;
  let cursor = 0;
  while (cursor < dictLiteral.length) {
    const char = dictLiteral[cursor];
    if (char === '"' || char === "'") {
      const quoted = readPythonQuotedString(dictLiteral, cursor);
      if (!quoted) {
        cursor += 1;
        continue;
      }
      let next = quoted.end;
      while (/\s/.test(dictLiteral[next] || "")) next += 1;
      if (depth === 1 && dictLiteral[next] === ":") {
        keys.push(quoted.value);
      }
      cursor = quoted.end;
      continue;
    }
    if (char === "#") {
      while (cursor < dictLiteral.length && dictLiteral[cursor] !== "\n") cursor += 1;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    cursor += 1;
  }
  return keys;
}

function nestedPythonDictKeys(dictLiteral, parentKey) {
  let depth = 0;
  let cursor = 0;
  while (cursor < dictLiteral.length) {
    const char = dictLiteral[cursor];
    if (char === '"' || char === "'") {
      const quoted = readPythonQuotedString(dictLiteral, cursor);
      if (!quoted) {
        cursor += 1;
        continue;
      }
      let next = quoted.end;
      while (/\s/.test(dictLiteral[next] || "")) next += 1;
      if (depth === 1 && quoted.value === parentKey && dictLiteral[next] === ":") {
        next += 1;
        while (/\s/.test(dictLiteral[next] || "")) next += 1;
        if (dictLiteral[next] !== "{") return [];
        const close = findMatchingPythonBrace(dictLiteral, next);
        return close === -1 ? [] : pythonDictKeys(dictLiteral.slice(next, close + 1));
      }
      cursor = quoted.end;
      continue;
    }
    if (char === "#") {
      while (cursor < dictLiteral.length && dictLiteral[cursor] !== "\n") cursor += 1;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    cursor += 1;
  }
  return [];
}

function returnDictLiterals(source) {
  const dicts = [];
  const returnPattern = /\breturn\b/g;
  let match;
  while ((match = returnPattern.exec(source))) {
    let cursor = match.index + match[0].length;
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    if (source[cursor] !== "{") continue;
    const close = findMatchingPythonBrace(source, cursor);
    if (close !== -1) dicts.push(source.slice(cursor, close + 1));
  }
  return dicts;
}

function inferredNodeOutputs(node) {
  if (!node || lockedNode(node)) return { dataKeys: [], customKeys: [] };
  const dataKeys = new Set();
  const customKeys = new Set();
  const source = nodeMode(node) === "code" ? node.code || defaultCodeForNode(node) : "";
  for (const dictLiteral of returnDictLiterals(source)) {
    for (const key of nestedPythonDictKeys(dictLiteral, "data")) {
      dataKeys.add(key);
    }
    for (const key of pythonDictKeys(dictLiteral)) {
      if (!generatedStateKeys.has(key)) customKeys.add(key);
    }
  }
  return {
    dataKeys: [...dataKeys].sort((left, right) => left.localeCompare(right)),
    customKeys: [...customKeys].sort((left, right) => left.localeCompare(right)),
  };
}

function upstreamAccessSources(node) {
  if (!node || lockedNode(node)) return [];
  const nameById = pythonNamesByNodeId();
  return state.edges
    .filter((edge) => edge.to === node.id)
    .map((edge) => {
      const source = nodeById(edge.from);
      const functionName = nameById.get(edge.from);
      if (!source || !functionName) return null;
      const inferred = inferredNodeOutputs(source);
      const sourceVariable = sanitizeIdentifier(source.title, functionName);
      const options = [
        {
          label: "Whole output",
          expression: `state["artifacts"]["node_outputs"]["${functionName}"]`,
          snippet: `${sourceVariable}_output = state.get("artifacts", {}).get("node_outputs", {}).get("${functionName}", {})`,
        },
      ];
      for (const key of inferred.dataKeys) {
        const variableName = sanitizeIdentifier(key, "value");
        options.push({
          label: key,
          expression: `state["data"]["${key}"]`,
          snippet: `${variableName} = state.get("data", {}).get("${key}")`,
        });
      }
      for (const key of inferred.customKeys) {
        const variableName = sanitizeIdentifier(key, "value");
        options.push({
          label: `${key} from ${functionName}`,
          expression: `state["data"]["${functionName}"]["${key}"]`,
          snippet: `${variableName} = state.get("data", {}).get("${functionName}", {}).get("${key}")`,
        });
      }
      return {
        edge,
        source,
        functionName,
        inferred,
        options,
      };
    })
    .filter(Boolean);
}

function renderUpstreamValues(node, mode) {
  const sources = upstreamAccessSources(node);
  if (!sources.length) return "";
  const canInsert = mode === "code";
  return `
    <section class="panel-section upstream-values">
      <h2>Upstream values</h2>
      <p class="upstream-intro">Connected parents run first. Their returns are merged into state; use these accessors in this node.</p>
      ${sources
        .map((source) => {
          const inferredCount = source.inferred.dataKeys.length + source.inferred.customKeys.length;
          return `
            <article class="upstream-card">
              <div class="upstream-source">
                <strong>${escapeHtml(source.source.title)}</strong>
                <span>${escapeHtml(source.edge.label)} edge -> <code>${escapeHtml(source.functionName)}</code></span>
              </div>
              <div class="upstream-options">
                ${source.options
                  .map(
                    (option) => `
                      <div class="upstream-option">
                        <code>${escapeHtml(option.expression)}</code>
                        ${
                          canInsert
                            ? `<button class="upstream-insert" type="button" data-upstream-snippet="${escapeHtml(option.snippet)}">Insert ${escapeHtml(option.label)}</button>`
                            : ""
                        }
                      </div>
                    `,
                  )
                  .join("")}
              </div>
              ${
                inferredCount
                  ? '<p class="upstream-hint">For simple outputs, return <code>{"data": {"name": value}}</code> upstream to expose a direct <code>state["data"]["name"]</code> accessor.</p>'
                  : '<p class="upstream-hint">No named return keys were detected. Insert the whole output, or return <code>{"data": {"name": value}}</code> upstream for key-level suggestions.</p>'
              }
            </article>
          `;
        })
        .join("")}
      ${canInsert ? "" : '<p class="upstream-hint">Switch this node to Python code to insert access lines automatically.</p>'}
    </section>
  `;
}

function insertSnippetIntoCodeEditor(textarea, snippet) {
  if (!textarea || !snippet) return;
  const value = textarea.value;
  const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : value.length;
  const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start;
  const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
  const suffix = end < value.length && value[end] !== "\n" ? "\n" : "";
  const inserted = `${prefix}${snippet}${suffix}`;
  textarea.value = `${value.slice(0, start)}${inserted}${value.slice(end)}`;
  const cursor = start + inserted.length;
  textarea.focus();
  textarea.setSelectionRange(cursor, cursor);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function attachUpstreamValueHandlers() {
  els.inspector.querySelectorAll("[data-upstream-snippet]").forEach((button) => {
    button.addEventListener("click", () => {
      const textarea = els.inspector.querySelector('textarea[data-node-field="code"]');
      insertSnippetIntoCodeEditor(textarea, button.dataset.upstreamSnippet);
      savePersistentState();
    });
  });
}

function renderConnectionEditor(node) {
  const parents = state.nodes.filter((candidate) => candidate.id !== node.id && candidate.kind !== "end");
  const children = state.nodes.filter((candidate) => candidate.id !== node.id && candidate.kind !== "start");
  const incoming = state.edges
    .filter((edge) => edge.to === node.id)
    .map((edge) => nodeById(edge.from)?.title || edge.from)
    .join(", ");
  const outgoing = state.edges
    .filter((edge) => edge.from === node.id)
    .map((edge) => {
      const target = nodeById(edge.to)?.title || edge.to;
      return node.kind === "condition" ? `${edge.label} -> ${target}` : target;
    })
    .join(", ");
  const branchSelector =
    node.kind === "condition"
      ? `
        <label>
          Branch
          <select data-connect-branch>
            ${node.branches.map((branch) => `<option value="${escapeHtml(branch)}">${escapeHtml(branch)}</option>`).join("")}
          </select>
        </label>
      `
      : "";

  return `
    <section class="panel-section">
      <h2>Connections</h2>
      <div class="connection-summary">
        <span><strong>Parents</strong>${incoming ? escapeHtml(incoming) : "None"}</span>
        <span><strong>Children</strong>${outgoing ? escapeHtml(outgoing) : "None"}</span>
      </div>
      <div class="connection-grid">
        <label>
          Add parent
          <select data-connect-parent>
            <option value="">Choose node...</option>
            ${parents.map((candidate) => `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.title)}</option>`).join("")}
          </select>
        </label>
        ${branchSelector}
        <label>
          Add child
          <select data-connect-child>
            <option value="">Choose node...</option>
            ${children.map((candidate) => `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.title)}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>
  `;
}

function attachConnectionEditorHandlers(node) {
  els.inspector.querySelector("[data-connect-parent]")?.addEventListener("change", (event) => {
    const parentId = event.target.value;
    if (!parentId) return;
    addEdge(parentId, node.id, "", { select: "target" });
  });
  els.inspector.querySelector("[data-connect-child]")?.addEventListener("change", (event) => {
    const childId = event.target.value;
    if (!childId) return;
    const branch = els.inspector.querySelector("[data-connect-branch]")?.value || "";
    addEdge(node.id, childId, branch, { select: "source" });
  });
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

  const locked = lockedNode(node);
  const mode = nodeMode(node);
  const branchEditor =
    node.kind === "condition"
      ? `
        <label>
          Branch labels
          <input data-node-field="branches" value="${escapeHtml(node.branches.join(", "))}" ${locked ? "readonly" : ""}>
        </label>
      `
      : "";
  const modeEditor = locked
    ? ""
    : `
      <div class="mode-toggle" role="group" aria-label="Node execution mode">
        <button class="${mode === "ai" ? "is-active" : ""}" type="button" data-node-mode="ai" aria-pressed="${mode === "ai"}">AI-enabled</button>
        <button class="${mode === "code" ? "is-active" : ""}" type="button" data-node-mode="code" aria-pressed="${mode === "code"}">Python code</button>
      </div>
    `;
  const sizeEditor = locked
    ? ""
    : `
      <details class="inspector-details">
        <summary>Layout</summary>
        <div class="size-controls" aria-label="Node size">
          <label>
            Width
            <input data-node-size="width" type="number" min="${nodeSizeLimits.width.min}" max="${nodeSizeLimits.width.max}" step="10" value="${escapeHtml(node.width || nodeFallbackSize.width)}">
          </label>
          <label>
            Height
            <input data-node-size="height" type="number" min="${nodeSizeLimits.height.min}" max="${nodeSizeLimits.height.max}" step="10" value="${escapeHtml(node.height || nodeFallbackSize.height)}">
          </label>
        </div>
      </details>
    `;
  const executionEditor =
    locked
      ? ""
      : mode === "ai"
        ? `
          <label>
            ${node.kind === "condition" ? "Router prompt" : "Prompt"}
            <textarea data-node-field="prompt">${escapeHtml(node.prompt || defaultPromptForNode(node))}</textarea>
          </label>
        `
        : `
          ${renderPythonEditor(node.code || defaultCodeForNode(node))}
          <button class="console-button check-code-button" type="button" data-check-code>Check code</button>
          ${renderPythonCheckList(validatePythonBlock(node.code || defaultCodeForNode(node), node))}
        `;
  const inspectorTitle = nodeKinds[node.kind].label === "Node" ? "Node" : `${nodeKinds[node.kind].label} node`;
  const nodeEditor = locked
    ? `
      <div class="inspector-node-summary">
        <span class="node-summary-glyph">${escapeHtml(nodeKinds[node.kind].glyph)}</span>
        <div>
          <strong>${escapeHtml(node.title)}</strong>
          <p>${escapeHtml(node.detail || nodeKinds[node.kind].description)}</p>
        </div>
      </div>
    `
    : `
      <div class="field-stack">
        <label>
          Label
          <input data-node-field="title" value="${escapeHtml(node.title)}">
        </label>
        <label>
          Canvas note
          <textarea data-node-field="detail">${escapeHtml(node.detail)}</textarea>
        </label>
        ${modeEditor}
        ${sizeEditor}
        ${executionEditor}
        ${branchEditor}
      </div>
    `;
  els.inspector.innerHTML = `
    <section class="panel-section">
      <h2>${escapeHtml(inspectorTitle)}</h2>
      ${nodeEditor}
    </section>
    ${renderConnectionEditor(node)}
    ${locked ? "" : renderUpstreamValues(node, mode)}
    ${
      isAiNode(node)
        ? `
          <section class="panel-section">
            <details class="inspector-details" open>
              <summary>Provider packs on this node</summary>
              <div class="tool-list" data-inspector-tools></div>
            </details>
          </section>
        `
        : ""
    }
    ${
      locked
        ? ""
        : `
          <section class="panel-section">
            <h2>Node actions</h2>
            <button class="console-button warning" type="button" data-delete-selected>Delete node</button>
          </section>
        `
    }
  `;

  els.inspector.querySelectorAll("[data-node-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.nodeMode === nodeMode(node)) return;
      pushHistorySnapshot();
      setNodeMode(node, button.dataset.nodeMode);
      render();
    });
  });

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
      if (field.dataset.nodeField === "code") {
        syncPythonEditorHighlight(field);
        const checkList = els.inspector.querySelector(".code-check-list");
        if (checkList) {
          checkList.outerHTML = renderPythonCheckList(validatePythonBlock(field.value, node));
        }
      }
      savePersistentState();
    });
  });

  els.inspector.querySelectorAll("[data-node-size]").forEach((field) => {
    let didPushHistory = false;
    field.addEventListener("input", () => {
      const axis = field.dataset.nodeSize;
      const limits = nodeSizeLimits[axis];
      const parsed = Number(field.value);
      if (!Number.isFinite(parsed)) return;
      if (!didPushHistory) {
        pushHistorySnapshot();
        didPushHistory = true;
      }
      node[axis] = Math.round(clamp(parsed, limits.min, limits.max));
      renderNodes();
      renderEdges();
      savePersistentState();
    });
  });

  els.inspector.querySelector("[data-check-code]")?.addEventListener("click", () => {
    const checkList = els.inspector.querySelector(".code-check-list");
    if (checkList) {
      checkList.outerHTML = renderPythonCheckList(validatePythonBlock(node.code || defaultCodeForNode(node), node));
    }
    renderValidation();
  });

  els.inspector.querySelector("[data-delete-selected]")?.addEventListener("click", removeSelected);
  attachConnectionEditorHandlers(node);
  attachUpstreamValueHandlers();
  setupPythonEditorHighlights(els.inspector);
  renderInspectorTools(node);
}

function renderInspectorTools(node) {
  const container = els.inspector.querySelector("[data-inspector-tools]");
  if (!container || !isAiNode(node)) return;
  const filtered = filteredTools();
  const renderedIds = new Set(filtered.map((tool) => tool.id));
  const selectedOutsideFilter = allTools().filter((tool) => node.tools.includes(tool.id) && !renderedIds.has(tool.id));
  const tools = [...selectedOutsideFilter, ...filtered];
  container.innerHTML =
    tools.map((tool) => renderToolChip(tool, "data-inspector-tool", node.tools.includes(tool.id))).join("") ||
    '<div class="inspector-empty">No tools match this filter.</div>';
  container.querySelectorAll("[data-inspector-tool]").forEach((button) => {
    button.addEventListener("click", async () => {
      const tool = button.dataset.inspectorTool;
      pushHistorySnapshot();
      if (node.tools.includes(tool)) {
        node.tools = node.tools.filter((item) => item !== tool);
      } else {
        node.tools.push(tool);
        await ensureToolPack(tool);
      }
      render();
    });
  });
  attachToolCodeHandlers(container);
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
    if (isAiNode(node)) {
      if (!String(node.prompt || "").trim()) {
        messages.push({ type: "warning", text: `${node.title} is AI-enabled but has no prompt.` });
      }
      for (const toolId of node.tools) {
        const tool = toolById(toolId);
        if (!tool) {
          messages.push({ type: "warning", text: `${node.title} references a missing provider pack: ${toolId}.` });
        }
      }
    } else if (!lockedNode(node)) {
      const codeMessages = validatePythonBlock(node.code || defaultCodeForNode(node), node).filter(
        (message) => message.type === "warning",
      );
      for (const message of codeMessages) {
        messages.push({ type: "warning", text: `${node.title}: ${message.text}` });
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

function commandsForPack(tool) {
  const loadedCommands = state.loadedPacks[tool.id]?.commands;
  if (Array.isArray(loadedCommands) && loadedCommands.length) return loadedCommands;
  return Array.isArray(tool.commands) ? tool.commands : [];
}

function indentPythonBlock(code, fallback = "return {}") {
  const source = String(code || fallback || "return {}").replace(/\s+$/g, "");
  const lines = source.split(/\r?\n/);
  if (!lines.some((line) => line.trim())) return "    return {}";
  return lines.map((line) => (line.trim() ? `    ${line}` : "")).join("\n");
}

function emitAiNodeBody(lines, node, functionName) {
  const promptRecord = {
    title: node.title,
    prompt: node.prompt || defaultPromptForNode(node),
    branches: node.kind === "condition" ? node.branches : [],
  };
  lines.push("    artifacts = dict(state.get(\"artifacts\") or {})");
  lines.push("    prompts = dict(artifacts.get(\"prompts\") or {})");
  lines.push(`    prompts[${pythonString(functionName)}] = ${pythonLiteral(promptRecord)}`);
  lines.push("    artifacts[\"prompts\"] = prompts");
  if (node.tools?.length) {
    lines.push("    tool_results = dict(artifacts.get(\"tool_results\") or {})");
    for (const toolId of node.tools) {
      const tool = toolById(toolId);
      if (!tool) continue;
      lines.push(`    tool_results[${pythonString(tool.id)}] = run_${sanitizeIdentifier(tool.id, "tool")}(state)`);
    }
    lines.push("    artifacts[\"tool_results\"] = tool_results");
  }
  if (node.kind === "condition") {
    lines.push(`    return _state_update(state, ${pythonString(functionName)}, {"artifacts": artifacts, "route": ${pythonString(node.branches[0] || "next")}})`);
  } else {
    lines.push(`    return _state_update(state, ${pythonString(functionName)}, {"artifacts": artifacts})`);
  }
}

function generatePython() {
  const regularNodes = state.nodes.filter((node) => !lockedNode(node));
  const usedNames = new Set();
  const nameById = new Map();
  for (const node of regularNodes) {
    nameById.set(node.id, uniquePythonName(node, usedNames));
  }

  const selectedTools = [...new Set(regularNodes.filter(isAiNode).flatMap((node) => node.tools))]
    .map(toolById)
    .filter(Boolean);
  const commandTools = selectedTools.filter((tool) => tool.command.length);
  const packTools = selectedTools.filter((tool) => tool.pack);
  const stubTools = selectedTools.filter((tool) => !tool.command.length && !tool.pack);
  const toolRegistry = Object.fromEntries(
    commandTools.map((tool) => [
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
  const packRegistry = Object.fromEntries(
    packTools.map((tool) => [
      tool.id,
      {
        name: tool.name,
        category: tool.category,
        description: tool.description,
        binary: tool.binary,
        command_pack_url: tool.commandPackUrl,
        default_command_id: tool.defaults.command_id || commandsForPack(tool)[0]?.id || "",
        mutates: tool.mutates,
        commands: Object.fromEntries(
          commandsForPack(tool).map((command) => [
            command.id,
            {
              name: command.name,
              description: command.description,
              command: command.command,
              defaults: command.defaults,
              mutates: command.mutates,
            },
          ]),
        ),
      },
    ]),
  );

  const lines = ["from typing import Any, Literal, TypedDict"];
  if (commandTools.length || packTools.length) lines.push("import subprocess");
  if (packTools.length) lines.push("import shlex");
  lines.push(
    "",
    "from langgraph.graph import END, START, StateGraph",
    "",
  );
  if (packTools.length) {
    lines.push(
      "try:",
      "    from langchain_core.tools import tool",
      "except ImportError:",
      "    from langchain.tools import tool",
      "",
    );
  }
  lines.push(
    "class AgentState(TypedDict, total=False):",
    "    messages: list[str]",
    "    artifacts: dict[str, Any]",
    "    data: dict[str, Any]",
    "    cwd: str",
    "    tool_args: dict[str, dict[str, Any]]",
    "    approvals: dict[str, bool]",
    "    route: str",
    "",
    "",
    "STATE_KEYS = {\"messages\", \"artifacts\", \"data\", \"cwd\", \"tool_args\", \"approvals\", \"route\"}",
    "",
    "",
    "def _state_update(state: AgentState, node_name: str, output: Any) -> dict[str, Any]:",
    "    if output is None:",
    "        output = {}",
    "    update = dict(output) if isinstance(output, dict) else {\"data\": {node_name: output}}",
    "    artifacts = dict(state.get(\"artifacts\") or {})",
    "    if isinstance(update.get(\"artifacts\"), dict):",
    "        artifacts.update(update[\"artifacts\"])",
    "    node_outputs = dict(artifacts.get(\"node_outputs\") or {})",
    "    node_outputs[node_name] = output",
    "    artifacts[\"node_outputs\"] = node_outputs",
    "    update[\"artifacts\"] = artifacts",
    "    custom_values = {key: value for key, value in update.items() if key not in STATE_KEYS}",
    "    if custom_values or isinstance(update.get(\"data\"), dict):",
    "        data = dict(state.get(\"data\") or {})",
    "        if custom_values:",
    "            data[node_name] = custom_values",
    "        if isinstance(update.get(\"data\"), dict):",
    "            data.update(update[\"data\"])",
    "        update[\"data\"] = data",
    "    return update",
    "",
  );

  if (commandTools.length || packTools.length) {
    lines.push(`TOOL_REGISTRY: dict[str, dict[str, Any]] = ${pythonLiteral(toolRegistry)}`);
    lines.push(`PACK_REGISTRY: dict[str, dict[str, Any]] = ${pythonLiteral(packRegistry)}`);
    lines.push("");
    lines.push("");
    lines.push("def _format_command(template: list[str], values: dict[str, Any]) -> list[str]:");
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
    if (packTools.length) {
      lines.push("def _run_command(");
      lines.push("    tool_name: str,");
      lines.push("    command_id: str,");
      lines.push("    command: list[str],");
      lines.push("    cwd: str | None = None,");
      lines.push("    timeout_seconds: int = 120,");
      lines.push(") -> dict[str, Any]:");
      lines.push("    completed = subprocess.run(");
      lines.push("        command,");
      lines.push("        cwd=cwd,");
      lines.push("        text=True,");
      lines.push("        capture_output=True,");
      lines.push("        check=False,");
      lines.push("        timeout=timeout_seconds,");
      lines.push("    )");
      lines.push("    return {");
      lines.push("        \"tool\": tool_name,");
      lines.push("        \"command_id\": command_id,");
      lines.push("        \"command\": command,");
      lines.push("        \"returncode\": completed.returncode,");
      lines.push("        \"stdout\": completed.stdout,");
      lines.push("        \"stderr\": completed.stderr,");
      lines.push("    }");
      lines.push("");
      lines.push("");
    }
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

    lines.push("");
    lines.push("");
    lines.push("def run_pack_tool(pack_id: str, state: AgentState) -> dict[str, Any]:");
    lines.push("    pack = PACK_REGISTRY[pack_id]");
    lines.push("    pack_args = state.get(\"tool_args\", {}).get(pack_id, {})");
    lines.push("    command_id = pack_args.get(\"command_id\") or pack.get(\"default_command_id\")");
    lines.push("    command_spec = pack.get(\"commands\", {}).get(command_id)");
    lines.push("    if not command_spec:");
    lines.push("        raw_command = pack_args.get(\"command\") or pack_args.get(\"subcommand\")");
    lines.push("        if not raw_command:");
    lines.push("            available = \", \".join(sorted(pack.get(\"commands\", {}).keys()))");
    lines.push("            raise RuntimeError(f\"Pack {pack['name']} has no command {command_id!r}. Available: {available}\")");
    lines.push("        binary = str(pack.get(\"binary\") or pack[\"name\"]).strip()");
    lines.push("        command = [binary, *shlex.split(str(raw_command))]");
    lines.push("    else:");
    lines.push("        values = {**command_spec.get(\"defaults\", {}), **{key: value for key, value in pack_args.items() if key != \"command_id\"}}");
    lines.push("        command = _format_command(command_spec[\"command\"], values)");
    lines.push("    if (pack.get(\"mutates\") or (command_spec and command_spec.get(\"mutates\"))) and not state.get(\"approvals\", {}).get(pack_id):");
    lines.push("        raise PermissionError(f\"Pack {pack['name']} can change external state; set approvals[{pack_id!r}] = True to run it.\")");
    lines.push("    completed = subprocess.run(");
    lines.push("        command,");
    lines.push("        cwd=state.get(\"cwd\") or None,");
    lines.push("        text=True,");
    lines.push("        capture_output=True,");
    lines.push("        check=False,");
    lines.push("    )");
    lines.push("    return {");
    lines.push("        \"tool\": pack[\"name\"],");
    lines.push("        \"command_id\": command_id,");
    lines.push("        \"command\": command,");
    lines.push("        \"returncode\": completed.returncode,");
    lines.push("        \"stdout\": completed.stdout,");
    lines.push("        \"stderr\": completed.stderr,");
    lines.push("    }");

    for (const tool of commandTools) {
      const functionName = `run_${sanitizeIdentifier(tool.id, "tool")}`;
      lines.push("");
      lines.push("");
      lines.push(`def ${functionName}(state: AgentState) -> dict[str, Any]:`);
      lines.push(`    \"\"\"${tool.description || `Run ${tool.name}.`}\"\"\"`);
      lines.push(`    return run_cli_tool(${pythonString(tool.id)}, state)`);
    }
    for (const tool of packTools) {
      const functionName = `run_${sanitizeIdentifier(tool.id, "tool")}`;
      lines.push("");
      lines.push("");
      lines.push(`def ${functionName}(state: AgentState) -> dict[str, Any]:`);
      lines.push(`    \"\"\"${tool.description || `Run a command from the ${tool.name} pack.`}\"\"\"`);
      lines.push(`    return run_pack_tool(${pythonString(tool.id)}, state)`);
    }
    const langChainToolNames = [];
    for (const tool of packTools) {
      for (const command of commandsForPack(tool)) {
        langChainToolNames.push(sanitizeIdentifier(command.id, "tool_command"));
        lines.push("");
        lines.push("");
        lines.push(commandToolFunction(tool, command));
      }
    }
    if (langChainToolNames.length) {
      lines.push("");
      lines.push(`LANGCHAIN_TOOLS = [${langChainToolNames.join(", ")}]`);
      lines.push("LANGCHAIN_TOOLS_BY_NAME = {item.name: item for item in LANGCHAIN_TOOLS}");
    }
    lines.push("");
  }

  for (const tool of stubTools) {
    const functionName = `run_${sanitizeIdentifier(tool.id, "tool")}`;
    lines.push("");
    lines.push("");
    lines.push(`def ${functionName}(state: AgentState) -> dict[str, Any]:`);
    lines.push(`    \"\"\"${tool.description || `Implement ${tool.name}.`}\"\"\"`);
    lines.push("    # TODO: Fill in this custom tool implementation.");
    lines.push(`    return {"tool": ${pythonString(tool.name)}, "status": "not_implemented"}`);
  }

  for (const node of regularNodes) {
    const functionName = nameById.get(node.id);
    if (isAiNode(node)) {
      lines.push("");
      lines.push(`def ${functionName}(state: AgentState) -> dict[str, Any]:`);
      lines.push(`    ${pythonString(node.detail || "Return state updates.")}`);
      emitAiNodeBody(lines, node, functionName);
    } else {
      const implName = `_${functionName}_impl`;
      lines.push("");
      lines.push(`def ${implName}(state: AgentState) -> Any:`);
      lines.push(`    ${pythonString(node.detail || "Run the user-authored Python block.")}`);
      lines.push(indentPythonBlock(node.code || defaultCodeForNode(node), defaultCodeForNode(node)));
      lines.push("");
      lines.push("");
      lines.push(`def ${functionName}(state: AgentState) -> dict[str, Any]:`);
      lines.push(`    ${pythonString(node.detail || "Return state updates.")}`);
      lines.push(`    output = ${implName}(state)`);
      lines.push(`    update = _state_update(state, ${pythonString(functionName)}, output)`);
      if (node.kind === "condition") {
        const defaultBranch = node.branches[0] || "next";
        lines.push("    if \"route\" not in update:");
        lines.push(`        update["route"] = output if isinstance(output, str) else ${pythonString(defaultBranch)}`);
      }
      lines.push("    return update");
    }

    if (node.kind === "condition") {
      const defaultBranch = node.branches[0] || "next";
      const allowedBranches = `[${node.branches.map(pythonString).join(", ")}]`;
      lines.push("");
      lines.push(`def route_${functionName}(state: AgentState) -> Literal[${node.branches.map(pythonString).join(", ")}]:`);
      lines.push(`    ${pythonString(node.prompt || node.condition || "Choose the next branch.")}`);
      lines.push(`    route = state.get("route", ${pythonString(defaultBranch)})`);
      lines.push(`    return route if route in ${allowedBranches} else ${pythonString(defaultBranch)}`);
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
  els.codePreview.innerHTML = highlightPython(generatePython());
}

function renderPanelState() {
  els.shell?.classList.toggle("is-sidebar-collapsed", state.sidebarCollapsed);
  els.shell?.classList.toggle("is-inspector-collapsed", state.inspectorCollapsed);
  els.shell?.style.setProperty("--sidebar-width", `${state.sidebarWidth}px`);
  els.shell?.style.setProperty("--inspector-width", `${state.inspectorWidth}px`);
  els.shell?.style.setProperty("--code-panel-height", `${state.codePanelHeight}px`);
  els.sidebarToggle?.setAttribute("aria-pressed", String(state.sidebarCollapsed));
  els.inspectorToggle?.setAttribute("aria-pressed", String(state.inspectorCollapsed));
  const leftPanelLabel = state.sidebarCollapsed ? "Show left inspector and tools" : "Hide left inspector and tools";
  const rightPanelLabel = state.inspectorCollapsed ? "Show right code panel" : "Hide right code panel";
  els.sidebarToggle?.setAttribute("title", leftPanelLabel);
  els.sidebarToggle?.setAttribute("aria-label", leftPanelLabel);
  els.sidebarToggle?.setAttribute("data-tooltip", state.sidebarCollapsed ? "Show left" : "Hide left");
  els.inspectorToggle?.setAttribute("title", rightPanelLabel);
  els.inspectorToggle?.setAttribute("aria-label", rightPanelLabel);
  els.inspectorToggle?.setAttribute("data-tooltip", state.inspectorCollapsed ? "Show code" : "Hide code");
}

function panelResizeLimit(kind) {
  if (kind === "codePanelHeight") {
    const shellHeight = els.canvasShell?.getBoundingClientRect().height || 760;
    const toolbarHeight = els.canvasShell?.querySelector(".canvas-toolbar")?.getBoundingClientRect().height || 56;
    const dynamicMax = Math.max(panelSizeLimits.codePanelHeight.min, shellHeight - toolbarHeight - 8 - 240);
    return {
      min: panelSizeLimits.codePanelHeight.min,
      max: Math.min(panelSizeLimits.codePanelHeight.max, dynamicMax),
    };
  }
  const workbenchWidth = els.shell?.getBoundingClientRect().width || window.innerWidth || 1200;
  if (kind === "sidebarWidth") {
    const dynamicMax = Math.max(panelSizeLimits.sidebarWidth.min, workbenchWidth - state.inspectorWidth - 420);
    return {
      min: panelSizeLimits.sidebarWidth.min,
      max: Math.min(panelSizeLimits.sidebarWidth.max, dynamicMax),
    };
  }
  const dynamicMax = Math.max(panelSizeLimits.inspectorWidth.min, workbenchWidth - state.sidebarWidth - 420);
  return {
    min: panelSizeLimits.inspectorWidth.min,
    max: Math.min(panelSizeLimits.inspectorWidth.max, dynamicMax),
  };
}

function resizePanel(kind, value) {
  const limits = panelResizeLimit(kind);
  state[kind] = Math.round(clamp(value, limits.min, limits.max));
  renderPanelState();
  savePersistentState();
}

function resetPanelSize(kind) {
  resizePanel(kind, panelSizeDefaults[kind]);
}

function startPanelResize(kind, event) {
  if (event.button !== 0) return;
  event.preventDefault();
  const keyByKind = {
    sidebar: "sidebarWidth",
    inspector: "inspectorWidth",
    code: "codePanelHeight",
  };
  const key = keyByKind[kind];
  const startX = event.clientX;
  const startY = event.clientY;
  const startValue = state[key];
  const handle = event.currentTarget;
  document.body.classList.add("is-resizing-panel");
  handle?.setPointerCapture?.(event.pointerId);

  function handleMove(moveEvent) {
    if (kind === "sidebar") {
      resizePanel(key, startValue + moveEvent.clientX - startX);
      return;
    }
    if (kind === "inspector") {
      resizePanel(key, startValue - (moveEvent.clientX - startX));
      return;
    }
    resizePanel(key, startValue - (moveEvent.clientY - startY));
  }

  function handleEnd(endEvent) {
    document.body.classList.remove("is-resizing-panel");
    handle?.releasePointerCapture?.(endEvent.pointerId);
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleEnd);
    window.removeEventListener("pointercancel", handleEnd);
  }

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleEnd);
  window.addEventListener("pointercancel", handleEnd);
}

function setCodeFullscreen(enabled) {
  document.body.classList.toggle("is-code-fullscreen", enabled);
  els.codeFullscreenToggle?.setAttribute("aria-pressed", String(enabled));
  els.codeFullscreenToggle?.setAttribute(
    "title",
    enabled ? "Exit code full screen" : "View code full screen",
  );
  els.codeFullscreenToggle?.setAttribute(
    "aria-label",
    enabled ? "Exit code full screen" : "View code full screen",
  );
}

function toggleCodeFullscreen() {
  setCodeFullscreen(!document.body.classList.contains("is-code-fullscreen"));
}

function openGeneratedCodeTab() {
  savePersistentState();
  window.open("/agent-console/?code-view=generated", "_blank", "noopener");
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
    els.copyButton?.setAttribute("data-tooltip", "Copied");
    els.copyButton?.setAttribute("title", "Copied");
    els.copyButton?.setAttribute("aria-label", "Copied generated Python");
    if (els.status) els.status.textContent = "Code copied";
    window.setTimeout(() => {
      els.copyButton?.setAttribute("data-tooltip", "Copy code");
      els.copyButton?.setAttribute("title", "Copy generated Python");
      els.copyButton?.setAttribute("aria-label", "Copy generated Python");
      renderValidation();
    }, 1200);
  });
}

function render() {
  state.nodes = normalizeNodes(state.nodes);
  renderPanelState();
  applyZoom();
  renderSamples();
  renderNodes();
  renderEdges();
  renderTools();
  renderInspector();
  renderValidation();
  renderCode();
  savePersistentState();
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

async function initToolCodePage(toolId) {
  document.body.dataset.consolePage = "tool-code";
  document.body.innerHTML = `
    <main class="tool-code-page">
      <header>
        <a href="/agent-console/">LangGraph Agent Console</a>
        <h1>Tool Python</h1>
        <p>Loading provider-pack code...</p>
      </header>
      <pre><code></code></pre>
    </main>
  `;
  await loadToolCatalog();
  const tool = toolById(toolId);
  const page = document.querySelector(".tool-code-page");
  if (!tool || !page) {
    page.innerHTML = `
      <header>
        <a href="/agent-console/">LangGraph Agent Console</a>
        <h1>Tool not found</h1>
        <p>The requested provider pack is not available in the catalog.</p>
      </header>
    `;
    return;
  }
  await ensureToolPack(tool.id);
  const freshTool = toolById(toolId) || tool;
  document.title = `${freshTool.name} Python tool | AI Tutorial Lab`;
  page.innerHTML = `
    <header>
      <a href="/agent-console/">LangGraph Agent Console</a>
      <h1>${escapeHtml(freshTool.name)} Python tool</h1>
      <p>${escapeHtml(freshTool.description || "Generated tool-pack boundary.")}</p>
    </header>
    <pre><code>${highlightPython(toolPythonSnippet(freshTool))}</code></pre>
  `;
}

async function initGeneratedCodePage() {
  document.body.dataset.consolePage = "tool-code";
  document.body.innerHTML = `
    <main class="tool-code-page">
      <header>
        <a href="/agent-console/">LangGraph Agent Console</a>
        <h1>Generated LangGraph Python</h1>
        <p>Loading generated graph code...</p>
      </header>
      <pre><code></code></pre>
    </main>
  `;
  restorePersistentState();
  await loadToolCatalog();
  await ensureSelectedToolPacks();
  const source = generatePython();
  document.title = "Generated LangGraph Python | AI Tutorial Lab";
  const page = document.querySelector(".tool-code-page");
  page.innerHTML = `
    <header>
      <a href="/agent-console/">LangGraph Agent Console</a>
      <h1>Generated LangGraph Python</h1>
      <p>Read-only code view for the current saved graph.</p>
    </header>
    <pre><code>${highlightPython(source)}</code></pre>
  `;
}

function setupSidebarGroupToggles() {
  document.querySelectorAll("[data-sidebar-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.closest(".sidebar-group");
      if (!group) return;
      const open = !group.classList.contains("is-open");
      group.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", String(open));
    });
  });
}

function init() {
  Object.assign(els, {
    shell: document.querySelector(".console-shell"),
    canvasShell: document.querySelector(".canvas-shell"),
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
    customToolDescription: byId("custom-tool-description"),
    sampleFlowSelect: byId("sample-flow-select"),
    sampleFlowMeta: byId("sample-flow-meta"),
    inspector: byId("inspector"),
    validation: byId("validation-list"),
    status: byId("status-pill"),
    zoomLabel: byId("zoom-label"),
    codeDrawer: document.querySelector(".code-drawer"),
    codePreview: byId("code-preview"),
    copyButton: byId("copy-code"),
    sidebarToggle: byId("toggle-sidebar"),
    inspectorToggle: byId("toggle-inspector"),
    codeFullscreenToggle: byId("fullscreen-code"),
    codeOpenTab: byId("open-code-tab"),
    sidebarResize: byId("resize-sidebar"),
    inspectorResize: byId("resize-inspector"),
    codePanelResize: byId("resize-code-panel"),
  });

  setupSidebarGroupToggles();

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
    addCustomTool(els.customToolInput.value, els.customToolDescription.value);
  });
  els.sampleFlowSelect.addEventListener("change", () => {
    state.sampleFlowId = els.sampleFlowSelect.value;
    renderSamples();
    savePersistentState();
  });
  byId("load-sample-flow").addEventListener("click", () => loadSampleFlow(els.sampleFlowSelect.value));
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
  els.codeFullscreenToggle?.addEventListener("click", toggleCodeFullscreen);
  els.codeOpenTab?.addEventListener("click", openGeneratedCodeTab);
  byId("toggle-sidebar").addEventListener("click", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    renderPanelState();
    savePersistentState();
  });
  byId("toggle-inspector").addEventListener("click", () => {
    state.inspectorCollapsed = !state.inspectorCollapsed;
    renderPanelState();
    savePersistentState();
  });
  els.sidebarResize?.addEventListener("pointerdown", (event) => startPanelResize("sidebar", event));
  els.inspectorResize?.addEventListener("pointerdown", (event) => startPanelResize("inspector", event));
  els.codePanelResize?.addEventListener("pointerdown", (event) => startPanelResize("code", event));
  els.sidebarResize?.addEventListener("dblclick", () => resetPanelSize("sidebarWidth"));
  els.inspectorResize?.addEventListener("dblclick", () => resetPanelSize("inspectorWidth"));
  els.codePanelResize?.addEventListener("dblclick", () => resetPanelSize("codePanelHeight"));
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
    if (event.key === "Escape" && document.body.classList.contains("is-code-fullscreen")) {
      event.preventDefault();
      setCodeFullscreen(false);
      return;
    }
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

  restorePersistentState();
  render();
  centerCanvasView();
  loadToolCatalog().then(async () => {
    await ensureSelectedToolPacks();
    render();
  });
}

const toolCodeParam = new URLSearchParams(window.location.search).get("tool-code");
const codeViewParam = new URLSearchParams(window.location.search).get("code-view");
if (toolCodeParam) {
  initToolCodePage(toolCodeParam);
} else if (codeViewParam === "generated") {
  initGeneratedCodePage();
} else {
  init();
}
