#!/usr/bin/env python3
"""tests for scripts/runs_log.py: per-feed freshness from latest.*_t (never 'updated'); rolling 24h hourly sample; >=95% SLA; missing hour = not within."""
import importlib.util, json, os, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("rl", os.path.join(ROOT, "scripts", "runs_log.py")); rl = importlib.util.module_from_spec(spec); spec.loader.exec_module(rl)
F = []
def ok(c, n, x=None):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)
H = rl.H; t = 1_792_000_000_000 // H * H + 20 * 60000
# 1) 'updated' fresh, OI 4h old -> OI not ok (updated ignored)
d = {"updated": rl.iso(t), "assets": {"BTC": {"latest": {"oi_t": t - 5 * H - 10 * 60_000, "funding_t": t - 1 * H, "basis_t": t - 1 * H}}}}
fd = rl.feeds(d, t)
ok(fd["BTC oi"]["ok"] is False and fd["BTC funding"]["ok"] and fd["BTC basis"]["ok"], "freshness per feed from latest.*_t; a fresh 'updated' does not make a 5h10m-old OI fresh (limit 5h, 24 Oct)", fd)
ok(rl.feeds({"assets": {"BTC": {"latest": {}}}}, t)["BTC oi"]["ok"] is False, "a feed with no timestamp is not fresh (missing never counts as fresh)")
# 2) SLA: 23 of 24 hours within -> 95.8% passes; 22 -> fails; a missing hour counts as not within
def runs(n_ok, missing=0):
    hr = t // H * H; hs = []
    for k in range(24):
        if k < missing: continue
        hs.append({"hour_ms": hr - k * H, "ok": k >= missing + (24 - missing - n_ok)})
    return {"hourly": hs, "last_run": rl.iso(t)}
def chk(R):
    p = tempfile.mktemp(suffix=".json"); json.dump(R, open(p, "w")); return rl.check(95, p, t)
ok(chk(runs(23)) == 0, "23/24 hourly samples within limits (95.8%) passes the 95% check")
ok(chk(runs(22)) == 1, "22/24 within (91.7%) fails the 95% check")
ok(chk(runs(22, missing=1)) == 1, "a missing hour counts as not within (22 ok + 1 missing + 1 stale fails)")
s = rl.sla(runs(23)["hourly"], t); ok(s["hours_within"] == 23 and s["pct_within"] == 95.8, "sla_24h counts", s)
# 3) bootstrap: under 24h of samples -> warning, exit 0 (nothing invented)
hr = t // H * H
ok(chk({"hourly": [{"hour_ms": hr, "ok": True}], "last_run": rl.iso(t)}) == 0, "fewer than 24h of samples: reported as a warning, history not invented")
ok(chk({}) == 0, "missing _runs.json hourly data: warning, exit 0 (bootstrap)")
# 4) record(): one sample per hour, newest run in an hour wins, window trimmed to 24h
with tempfile.TemporaryDirectory() as dd:
    rl.RUNS = os.path.join(dd, "_runs.json"); rl.DERIVS = os.path.join(dd, "derivs.json")
    json.dump({"updated": "x", "assets": {"BTC": {"latest": {"oi_t": rl.now_ms(), "funding_t": rl.now_ms(), "basis_t": rl.now_ms()}}}}, open(rl.DERIVS, "w"))
    old = rl.now_ms() // H * H - 30 * H
    json.dump({"hourly": [{"hour_ms": old, "ok": True}], "runs": []}, open(rl.RUNS, "w"))
    rl.record(); rl.record(); R = json.load(open(rl.RUNS))
    ok(len(R["runs"]) == 2 and len(R["hourly"]) == 1 and R["hourly"][0]["ok"] and R["last_run"], "record(): every run logged, one hourly sample per hour, samples older than 24h dropped", R["hourly"])
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
