#!/usr/bin/env bash
# Live smoke with the narrow no-rollback rule (supervisor 12 Nov; data.yml too, 17 Nov). ONE copy used by ci.yml and data.yml smoke steps.
#   smoke_or_stale.sh <site_url> <before_dir> [log]
# exit 0: tests/tsmoke.js passed, OR it failed only on freshness checks and every stale file is byte-identical to what live served before this
#         deploy/publish (<before_dir>, saved by `no_regress.py files` in the deploy job) -> .github/scripts/stale_only.py decides.
# exit 1: anything else (non-freshness failure, crash, missing pre-deploy copy, stale file changed / went backwards) -> the step fails -> rollback.
# Env: TSMOKE (tests: a stand-in smoke script), SMOKE_OUT_DIR (where tsmoke writes summary.json + data bytes).
set -uo pipefail
url=$1; before=$2; log=${3:-/dev/null}; here="$(cd "$(dirname "$0")" && pwd)"
out=${SMOKE_OUT_DIR:-${RUNNER_TEMP:-/tmp}/smoke-out}; rm -rf "$out"
if SMOKE_OUT="$out" node "${TSMOKE:-tests/tsmoke.js}" "$url" 2>&1 | tee -a "$log"; then exit 0; fi
if python3 "$here/stale_only.py" "$out" "$before" | tee -a "$log"; then
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then { echo "### Live smoke: stale data only, no rollback"; grep '^NO ROLLBACK' "$log" || true; } >> "$GITHUB_STEP_SUMMARY"; fi
  exit 0
fi
exit 1
