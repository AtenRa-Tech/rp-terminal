#!/usr/bin/env bash
# ONE way to build every Pages deploy (P1 15 Oct): code from <code_sha> + the newest data/ on main at deploy time. A deploy that waits in the
# shared `pages` group and is replaced by a newer one loses nothing: the newer one carries the same tested code and newer data.
#   snapshot.sh <site_dir> <code_sha> [--rollback]
# Refuses (exit 1): data older than live (no_regress), derivs failing the publish guard, or code OLDER than live (live build.json code_sha
# not an ancestor of <code_sha>). --rollback allows going back to an older tested code commit only; data still never goes backwards.
# Writes <site_dir>/build.json {code_sha, data_sha, built}. Env (tests): LIVE_BUILD = local build.json instead of SITE_URL/build.json.
set -euo pipefail
dir=$1; code=$2; mode=${3:-}; here="$(cd "$(dirname "$0")" && pwd)"
[ -n "$code" ] || { echo "::error::snapshot: no code sha"; exit 1; }
git fetch -q origin main; data=$(git rev-parse FETCH_HEAD)
git cat-file -e "$code^{commit}" 2>/dev/null || git fetch -q origin "$code" || { echo "::error::snapshot: code commit $code not found"; exit 1; }
rm -rf "$dir"; mkdir -p "$dir"
git archive "$code" -- index.html manifest.webmanifest icons $(git cat-file -e "$code:sw.js" 2>/dev/null && echo sw.js) $(git cat-file -e "$code:README.md" 2>/dev/null && echo README.md) | tar -x -C "$dir"
git archive "$data" -- data | tar -x -C "$dir"
if [ -n "${LIVE_BUILD:-}" ]; then lb=$(cat "$LIVE_BUILD" 2>/dev/null || true); else lb=$(curl -sf "${SITE_URL:-https://atenra-tech.github.io/rp-terminal/}build.json?v=$(date +%s)" || true); fi
lc=$(printf '%s' "$lb" | python3 -c "import json,sys;print(json.load(sys.stdin).get('code_sha') or '')" 2>/dev/null || true)
if [ -z "$lc" ]; then echo "::warning::live has no build.json code_sha (first snapshot deploy); code age not checked"
elif [ "$lc" != "$code" ] && ! git merge-base --is-ancestor "$lc" "$code" 2>/dev/null; then
  if [ "$mode" = --rollback ]; then echo "rollback: code goes back from live ${lc:0:7} to tested ${code:0:7} (allowed for rollback only)"
  else echo "::error::refusing to publish: code ${code:0:7} is older than (or not a descendant of) live code ${lc:0:7}"; exit 1; fi
fi
python3 -c "import json,sys,datetime as d;json.dump({'code_sha':sys.argv[1],'data_sha':sys.argv[2],'built':d.datetime.now(d.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},open(sys.argv[3],'w'))" "$code" "$data" "$dir/build.json"
echo "snapshot: code ${code:0:7} + data/ from main ${data:0:7}"
if [ "$mode" = --rollback ]; then python3 "$here/no_regress.py" newest "$dir"; fi
python3 "$here/no_regress.py" check "$dir"
git show "$data:data/derivs.json" > "$dir/.main-derivs.json"; python3 "$here/publish_guard.py" "$dir/data/derivs.json" "$dir/.main-derivs.json"; rm -f "$dir/.main-derivs.json"
