#!/usr/bin/env bash
# Runs every node suite against the local server (URL defaults to http://localhost:8765/index.html). Fails on any FAIL line / FAILS: n>0 / non-zero exit.
set -u; cd "$(dirname "$0")"; export ROOT="$(cd .. && pwd)" DATA="$(cd .. && pwd)/data" FIX="$(pwd)/fixtures" GOLD="$(pwd)/fixtures"
bad=0; for t in tqa talt tbrief taud tnews tmac tsig tscroll tfix tnewsfx tgolden tqa3 tgate tsup tqa4 tqa5 tqa6 trange tfive; do
  echo "== $t"; out=$(timeout 1200 node "$t.js" 2>&1); rc=$?; echo "$out" | tail -n 80
  if [ $rc -ne 0 ] || echo "$out" | grep -qE '^FAIL |FAILS: [1-9]'; then echo "!! $t failed (rc=$rc)"; bad=1; fi
done; exit $bad
