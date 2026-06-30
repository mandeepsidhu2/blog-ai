#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_BASE="${TMPDIR:-/tmp}"

export CLANG_MODULE_CACHE_PATH="${CLANG_MODULE_CACHE_PATH:-${TMP_BASE%/}/macagentflow-clang-cache}"
SCRATCH_PATH="${SWIFTPM_SCRATCH_PATH:-${TMP_BASE%/}/macagentflow-swiftpm-build}"

swift build --package-path "$ROOT_DIR" --scratch-path "$SCRATCH_PATH"
swift run --package-path "$ROOT_DIR" --scratch-path "$SCRATCH_PATH" MacAgentFlowChecks
