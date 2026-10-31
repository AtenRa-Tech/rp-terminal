#!/usr/bin/env bash
# Frozen gate (ported from the single-file branch, 24 Oct): every suite runs with -r ./freeze/preload.js -> constant clock T0 (fixtures/frozen/meta.json),
# data/*.json from fixtures/frozen/data, external GETs replayed from fixtures/frozen/net (re-record: FREEZE_RECORD=1 bash run-all.sh).
# Runs every node suite against the local server (URL defaults to http://localhost:8765/index.html). Fails on any FAIL line / FAILS: n>0 / non-zero exit.
set -u; cd "$(dirname "$0")"; export ROOT="$(cd .. && pwd)" DATA="$(cd .. && pwd)/data" FIX="$(pwd)/fixtures" GOLD="$(pwd)/fixtures"
bad=0; for t in tqa talt tbrief taud tnews tmac tsig tscroll tfix tnewsfx tgolden tqa3 tgate tsup tqa4 tqa5 tqa6 trange tfive taudit29 twording tp1 tforming tdollar tclosed tbugs2 tbugs615 tstale tbanned tbreadth tsrc15 tm2 tfresh tc6 tlive15 tbtchist tphone tkeptfb; do
  echo "== $t"; out=$(timeout 1200 node -r ./freeze/preload.js "$t.js" 2>&1); rc=$?; echo "$out" | tail -n 80
  if [ $rc -ne 0 ] || echo "$out" | grep -qE '^FAIL |FAILS: [1-9]'; then echo "!! $t failed (rc=$rc)"; bad=1; fi
done
echo "== tlim5 (py)"; python3 tlim5.py || { echo '!! tlim5 failed'; bad=1; }
echo "== tkeep_hours (py)"; python3 tkeep_hours.py || { echo '!! tkeep_hours failed'; bad=1; }
exit $bad
