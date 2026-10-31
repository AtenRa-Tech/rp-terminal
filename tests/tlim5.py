#!/usr/bin/env python3
"""24 Oct ruling: ONE open-interest/basis limit (shared/freshness.json derivs_hourly_h = 5h), age from the newest stored hour's START.
fetch_derivs.py stores an OI hour only once start + 2h <= fetch. Hourly :17 job: fresh write 2h17m old; one missed run -> 4h17m (fresh); 5h10m stale.
Also: OKX revising its newest row never makes the next run's file fail the publish guard."""
import importlib.util, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); H = 3600_000; M = 60_000
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
def mod(name, p):
    s = importlib.util.spec_from_file_location(name, os.path.join(ROOT, p)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
FR = json.load(open(os.path.join(ROOT, "shared/freshness.json"))); LIM = FR["derivs_hourly_h"]
ok(LIM == 5 and FR["oi_settle_h"] == 2, "freshness.json: derivs_hourly_h 5, oi_settle_h 2")
html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
i = html.index("const FRESHNESS=") + len("const FRESHNESS="); inl, _ = json.JSONDecoder().raw_decode(html[i:])
ok(inl == FR, "index.html inline FRESHNESS equals shared/freshness.json")
ok("const DVLIM={oi:FRESHNESS.derivs_hourly_h,basis:FRESHNESS.derivs_hourly_h," in html, "app DVLIM oi/basis read the one constant")
ok(not re.search(r"DVLIM=\{oi:\d", html), "no hard-coded OI limit left in the app")
k = open(os.path.join(ROOT, "ops/netlify/kick.mjs")).read(); km = re.search(r"DERIVS_LIM_MIN = (\d+)", k)
ok(km and int(km.group(1)) == 60 * LIM and "out.age_min >= DERIVS_LIM_MIN" in k, "kick.mjs backup threshold = 60 * derivs_hourly_h")
ok(re.search(r"market_age_min >= 180", k) is not None and FR["market_h"] == 3, "market banner limit stays 3h")
sys.argv = ["runs_log.py"]; rl = mod("runs_log", "scripts/runs_log.py")
ok(rl.LIM["oi"] == LIM and rl.LIM["basis"] == LIM and rl.LIM["funding"] == 12.0, "runs_log.py LIM from freshness.json")
fd = mod("fetch_derivs", "scripts/fetch_derivs.py")
fresh = lambda age_ms: age_ms / H <= LIM   # same rule as the app chk(): age = now - hour start, stale when > limit
T0 = 1761000000000 // H * H   # an hour start
def job(now, rows):  # what fetch_derivs stores for oi_hourly at fetch time `now`
    return fd.settled_hours(fd.closed_bars(rows, H, now), now)
rows = sorted([T0 - h * H, 1e10 + h, 1.0] for h in range(0, 48))
run1 = T0 + 17 * M; s1 = job(run1, rows)
ok(s1[-1][0] == T0 - 2 * H, "settle: at :17 the newest stored hour starts 2h17m ago (start+2h <= fetch)")
ok(all(r[0] + 2 * H <= run1 for r in s1), "no stored OI hour with start + 2h > fetch time")
ok(fd.settled_hours([[T0 - H, 1, 1]], T0 + H - 1) == [] and fd.settled_hours([[T0 - H, 1, 1]], T0 + H) != [], "settle boundary: start+2h-1ms dropped, start+2h kept")
age_fresh = run1 - s1[-1][0]; ok(age_fresh == 2 * H + 17 * M and fresh(age_fresh), "normal: 2h17m old -> fresh")
missed = run1 + 2 * H - 1   # next :17 run missed; just before the one after lands
ok(missed - s1[-1][0] < 4 * H + 17 * M and fresh(4 * H + 17 * M), "missed-run case: one missed :17 run reaches 4h17m -> fresh (limit 5h)")
ok(not fresh(5 * H + 10 * M), "5h10m -> stale")
ok(fresh(5 * H) and not fresh(5 * H + 1), "boundary: exactly 5h fresh, 5h+1ms stale")
pg = mod("publish_guard", ".github/scripts/publish_guard.py")
def file(pts): return {"assets": {"BTC": {"oi_hourly": {"points": pts}}}}
pub1 = file(s1); ok(pg.check(pub1, None, run1) == [], "run 1 passes the publish guard")
rev = [list(r) for r in rows]; rev = [[r[0], r[1] * (1.01 if r[0] >= T0 - H else 1), r[2]] for r in rev]   # OKX revises its newest closed row (T0-1h)
run2 = run1 + H; s2 = job(run2, rev)
ok(s2[-1][0] == T0 - H and s2[-1][1] == rows[-2][1] * 1.01, "run 2 stores the revised hour once settled")
ok(pg.check(file(s2), pub1, run2) == [], "OKX revised newest row: next run is NOT refused by the publish guard")
naive = fd.closed_bars(rows, H, run1)   # without settling, the provisional row would be stored ...
ok(pg.check(file(fd.closed_bars(rev, H, run2)), file(naive), run2) != [], "control: storing the provisional row would have been refused")
print(f"tlim5: {len(fails)} FAILS"); print(f"FAILS: {len(fails)}"); sys.exit(1 if fails else 0)
