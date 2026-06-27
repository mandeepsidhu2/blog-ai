#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectScript = path.join(__dirname, "projects", "llm-context-boundary-eval", "run-experiment.mjs");

const result = spawnSync(process.execPath, [projectScript], {
  cwd: path.join(__dirname, "..", ".."),
  env: process.env,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
