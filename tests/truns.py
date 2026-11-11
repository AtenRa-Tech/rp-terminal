#!/usr/bin/env python3
"""tests for scripts/runs_log.py: per-feed freshness from latest.*_t (never 'updated'); >=95% SLA judged by live data age through each hour (9 Nov), an hour without a run is not a miss on its own."""
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
# 2) SLA (9 Nov ruling): each hour is judged by what live served through it, not by whether a run happened in it.
# Feed timestamps as fetch_derivs writes them: an OI/basis hour is stored once start+2h <= fetch (2 Nov repair: fetched 08:29Z, newest OI 06:00Z),
# funding is the last 8h settlement.
def run_at(ft, oi_lag=True, basis_lag=True):
    hr = (ft - 2 * H) // H * H
    F = {"oi_t": hr if oi_lag else ft, "basis_t": hr if basis_lag else ft, "funding_t": ft // (8 * H) * (8 * H)}
    return {"t": rl.iso(ft), "feeds": rl.feeds({"assets": {a: {"latest": F} for a in ("BTC", "ETH")}}, ft)}
def chk(R, now=t):
    p = tempfile.mktemp(suffix=".json"); json.dump(R, open(p, "w")); return rl.check(95, p, now)
def every(gap_h, **kw):
    first = t - 30 * H; return {"runs": [run_at(first + k * gap_h * H, **kw) for k in range(int(30 / gap_h) + 1) if first + k * gap_h * H <= t]}
R2 = every(2); s2 = rl.sla(R2["runs"], t)
ok(chk(R2) == 0 and s2["pct_within"] == 100.0, "runs every 2h: live OI peaks ~4.5h (under 5h) -> every hour within, passes", s2)
ok(s2["hours_sampled"] == 12, "runs every 2h: only 12 of 24 hours have a run, and the empty hours are not misses on their own", s2)
R3 = every(3); s3 = rl.sla(R3["runs"], t)
ok(chk(R3) == 1 and s3["pct_within"] < 95, "runs every 3h: live OI reaches ~5.5h just before the next run -> those hours miss, fails", s3)
s3b = rl.sla(every(3, basis_lag=False)["runs"], t)
s3c = rl.sla(every(3, oi_lag=False, basis_lag=False)["runs"], t)
ok(s3b["pct_within"] < 95 and s3c["pct_within"] == 100.0, "the 3h-gap misses come from open interest age (fresh basis still fails; fresh OI and basis pass)", (s3b, s3c))
# 8 Nov: the real run times (IST 11:54 AM, 2:33 PM, 9:32 PM, then 2:02 AM and 6:28 AM on 9 Nov), checked at live-lag time 01:50Z on 9 Nov
ms = lambda x: rl._ms(x)
nov8 = {"runs": [run_at(ms(x)) for x in ("2026-11-08T01:31:00Z", "2026-11-08T06:24:00Z", "2026-11-08T09:03:00Z", "2026-11-08T16:02:00Z", "2026-11-08T20:32:00Z", "2026-11-09T00:58:00Z")]}
s8 = rl.sla(nov8["runs"], ms("2026-11-09T01:50:00Z"))
ok(chk(nov8, ms("2026-11-09T01:50:00Z")) == 1 and s8["pct_within"] < 95, "8 Nov 7h gap (09:03Z to 16:02Z) and the other long gaps fail the check", s8)
hours_in_gap = [h for h in range(10, 16)]
gap_ok = [rl._served_ok(run_at(ms("2026-11-08T09:03:00Z")), ms(f"2026-11-08T{h:02d}:00:00Z")) for h in hours_in_gap]
ok(gap_ok[0] is True and gap_ok[-1] is False, "inside the 7h gap live OI is fresh at 10:00Z and past 5h by 15:00Z", gap_ok)
ok(not rl._served_ok({"t": rl.iso(t), "feeds": {"BTC oi": {"t": None, "lim_h": 5}}}, t) and not rl._served_ok(None, t), "a feed with no timestamp, or an hour with no earlier run, is a miss")
# 3) bootstrap: runs log covering less than 24h -> warning, exit 0 (nothing invented)
ok(chk({"runs": [run_at(t - 2 * H)]}) == 0, "runs log under 24h: reported as a warning, history not invented")
ok(chk({}) == 0, "missing _runs.json runs: warning, exit 0 (bootstrap)")
# 4) record(): one sample per hour, newest run in an hour wins, window trimmed to 24h
with tempfile.TemporaryDirectory() as dd:
    rl.RUNS = os.path.join(dd, "_runs.json"); rl.DERIVS = os.path.join(dd, "derivs.json")
    json.dump({"updated": "x", "assets": {"BTC": {"latest": {"oi_t": rl.now_ms(), "funding_t": rl.now_ms(), "basis_t": rl.now_ms()}}}}, open(rl.DERIVS, "w"))
    old = rl.now_ms() // H * H - 30 * H
    json.dump({"hourly": [{"hour_ms": old, "ok": True}], "runs": []}, open(rl.RUNS, "w"))
    rl.record(); rl.record(); R = json.load(open(rl.RUNS))
    ok(len(R["runs"]) == 2 and len(R["hourly"]) == 1 and R["hourly"][0]["ok"] and R["last_run"], "record(): every run logged, one hourly sample per hour, samples older than 24h dropped", R["hourly"])
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
