#!/usr/bin/env bash
#
# Helix E2E UX harness entrypoint (Phase 1).
#
# Always runs the deterministic faux suite ($0, no keys). Runs the live matrix
# suite only when provider credentials are detected. Online providers only —
# PI_NO_LOCAL_LLM=1 is exported so a local LLM is never hit.
#
# Usage:
#   scripts/e2e.sh
#
# Env knobs:
#   HELIX_E2E_MAX_COST_USD   per-run budget cap (default 1.00)
#   HELIX_E2E_PROVIDERS      comma filter of scenario ids/providers
#   HELIX_E2E_REPORT         path for the JSON cost report (default e2e-report.json)
#   PI_RUN_INTEGRATION=1     opt-in for the live suite even when keys exist

set -euo pipefail

# Online providers only: never hit a local LLM.
export PI_NO_LOCAL_LLM=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

E2E_DIR="packages/coding-agent/test/e2e"
FAUX_TEST="$E2E_DIR/e2e-runner.test.ts"
MATRIX_TEST="$E2E_DIR/matrix-models.test.ts"
LIVE_TEST="$E2E_DIR/e2e-live.test.ts"
REPORT_PATH="${HELIX_E2E_REPORT:-e2e-report.json}"

# Detect which provider credentials are present (env-key only summary; the
# auth.json store is additionally consulted by the suite at runtime).
declare -a PRESENT=()
[[ -n "${ANTHROPIC_API_KEY:-}${ANTHROPIC_OAUTH_TOKEN:-}" ]] && PRESENT+=("anthropic")
[[ -n "${OPENAI_API_KEY:-}" ]] && PRESENT+=("openai")
[[ -n "${GEMINI_API_KEY:-}" ]] && PRESENT+=("google")
[[ -n "${OPENROUTER_API_KEY:-}" ]] && PRESENT+=("openrouter")

echo "=== Helix E2E harness (Phase 1) ==="
echo "PI_NO_LOCAL_LLM=$PI_NO_LOCAL_LLM"
echo "budget cap (HELIX_E2E_MAX_COST_USD): ${HELIX_E2E_MAX_COST_USD:-1.00 (default)}"
if [[ ${#PRESENT[@]} -gt 0 ]]; then
  echo "provider creds detected (env): ${PRESENT[*]}"
else
  echo "provider creds detected (env): none (live suite will SKIP unless auth.json has keys)"
fi
echo

cd packages/coding-agent

echo "--- deterministic faux suite (\$0, always runs) ---"
npx vitest run "test/e2e/e2e-runner.test.ts" "test/e2e/matrix-models.test.ts"

if [[ ${#PRESENT[@]} -gt 0 || -f "$HOME/.helix/agent/auth.json" ]]; then
  echo
  echo "--- live matrix suite (gated; runs only for scenarios with creds) ---"
  HELIX_E2E_REPORT="$REPORT_PATH" npx vitest run "test/e2e/e2e-live.test.ts"
  echo
  if [[ -f "$REPORT_PATH" ]]; then
    echo "--- cost report ($REPORT_PATH) ---"
    cat "$REPORT_PATH"
  else
    echo "no cost report written (live suite skipped all scenarios)"
  fi
else
  echo
  echo "live matrix suite SKIPPED (no credentials)."
fi
