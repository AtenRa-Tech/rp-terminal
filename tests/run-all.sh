#!/usr/bin/env bash
# Frozen gate (ported from the single-file branch, 24 Oct): every suite runs with -r ./freeze/preload.js -> constant clock T0 (fixtures/frozen/meta.json),
# data/*.json from fixtures/frozen/data, external GETs replayed from fixtures/frozen/net (re-record: FREEZE_RECORD=1 bash run-all.sh).
# Runs every node suite against the local server (URL defaults to http://localhost:8765/index.html). Fails on any FAIL line / FAILS: n>0 / non-zero exit.
set -u; cd "$(dirname "$0")"; export ROOT="$(cd .. && pwd)" DATA="$(cd .. && pwd)/data" FIX="$(pwd)/fixtures" GOLD="$(pwd)/fixtures"
bad=0; for t in tqa talt tbrief taud tnews tmac tsig tscroll tfix tnewsfx tgolden tqa3 tgate tsup tqa4 tqa5 tqa6 trange tfive taudit29 twording tp1 tforming tdollar tclosed tbugs2 tbugs615 tstale tbanned tbreadth tsrc15 tm2 tfresh tsp500 tc6 tlive15 tbtchist tphone tkeptfb tfundstale tnyse tqaload; do
  echo "== $t"; out=$(timeout 1200 node -r ./freeze/preload.js "$t.js" 2>&1); rc=$?; echo "$out" | tail -n 80
  if [ $rc -ne 0 ] || echo "$out" | grep -qE '^FAIL |FAILS: [1-9]'; then echo "!! $t failed (rc=$rc)"; bad=1; fi
done
echo "== tlim5 (py)"; python3 tlim5.py || { echo '!! tlim5 failed'; bad=1; }
echo "== tkeep_hours (py)"; python3 tkeep_hours.py || { echo '!! tkeep_hours failed'; bad=1; }
echo "== tokx_first (py)"; python3 tokx_first.py || { echo '!! tokx_first failed'; bad=1; }
echo "== tnyse (py)"; python3 tnyse.py || { echo '!! tnyse failed'; bad=1; }
echo "== tetf_checked (py)"; python3 tetf_checked.py || { echo '!! tetf_checked failed'; bad=1; }
echo "== tworker (js)"; node tworker.js || { echo '!! tworker failed'; bad=1; }
# 24 Nov reliability: browser launch retried once (smoke), C6 on the fixture's time at 23:59Z/00:01Z, Pages deploy single retry (static + actionlint)
echo "== tlaunch (js)"; node tlaunch.js || { echo '!! tlaunch failed'; bad=1; }
echo "== tc6clock (js)"; node tc6clock.js || { echo '!! tc6clock failed'; bad=1; }
echo "== tdeploy_retry (py)"; python3 tdeploy_retry.py || { echo '!! tdeploy_retry failed'; bad=1; }
echo "== tabsent (js)"; node tabsent.js || { echo '!! tabsent failed'; bad=1; }
echo "== tpromote_fetch (sh)"; bash tpromote_fetch.sh || { echo '!! tpromote_fetch failed'; bad=1; }
# narrow no-rollback ruling (12 Nov): rollback decision fixtures + the ETF stale label carried through to Studio
echo "== tnorollback (py)"; python3 tnorollback.py || { echo '!! tnorollback failed'; bad=1; }
echo "== tetf_pending (py)"; python3 tetf_pending.py || { echo '!! tetf_pending failed'; bad=1; }
# 25 Nov ruling: SP500 in NYSE trading days (limit 3) in runs_log, the stale alarm and the app (tsp500.js above)
echo "== tsp500 (py)"; python3 tsp500.py || { echo '!! tsp500 failed'; bad=1; }
echo "== tetfstale"; out=$(timeout 1200 node -r ./freeze/preload.js tetfstale.js 2>&1); rc=$?; echo "$out" | tail -n 40
if [ $rc -ne 0 ] || echo "$out" | grep -qE '^FAIL |FAILS: [1-9]'; then echo "!! tetfstale failed (rc=$rc)"; bad=1; fi
exit $bad
