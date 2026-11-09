#!/usr/bin/env python3
"""_runs.json market (3h, 21 Oct ruling) and macro per-series freshness (Fed daily 3 US business days skipping bond holidays; weekly 12 days; H.10 FX 14 days)."""
import datetime as dt, importlib.util, json, os, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
spec = importlib.util.spec_from_file_location("rl", os.path.join(ROOT, "scripts", "runs_log.py")); rl = importlib.util.module_from_spec(spec); spec.loader.exec_module(rl)
def ok(c, n, x=''):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)
ms = lambda s: int(dt.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() * 1000)
t = ms("2026-10-15T12:00:00Z")
ok(rl.market_fresh({"updated": "2026-10-15T10:30:00Z"}, t)["ok"], "market 1.5h old -> fresh")
ok(rl.market_fresh({"updated": "2026-10-15T09:30:00Z"}, t)["ok"], "market 2.5h old -> fresh (limit 3h)")
ok(not rl.market_fresh({"updated": "2026-10-15T08:54:00Z"}, t)["ok"], "market 3.1h old -> stale (limit 3h)")
ok(rl.market_fresh({"updated": "2026-10-15T09:30:00Z"}, t)["limit_h"] == 3 == rl.FRESHNESS["market_h"], "market limit_h written to _runs.json = shared/freshness.json market_h = 3")
ok(not rl.market_fresh({}, t)["ok"], "market missing -> stale, never fresh")
ok(dt.date(2026, 10, 12) in rl.us_hol(2026) and dt.date(2026, 11, 11) in rl.us_hol(2026) and dt.date(2026, 7, 3) in rl.us_hol(2026), "bond holidays: Columbus Day 12 Oct, Veterans Day 11 Nov, 4 Jul observed Fri 3 Jul 2026")
# Fri 9 Oct -> Thu 15 Oct: Mon 12 Oct is a bond holiday, so Tue, Wed, Thu = 3 business days -> fresh; Fri 16 -> 4 -> stale
P = [["2026-10-09", 4.1]]
M = {"series": {"DGS10": {"freq": "Daily", "last_date": "2026-10-09", "points": P}, "WALCL": {"freq": "Weekly, as of Wednesday", "last_date": "2026-10-03", "points": P},
                "WTREGEN": {"freq": "Weekly", "last_date": "2026-10-02", "points": P}, "DEXUSEU": {"freq": "Daily", "last_date": "2026-10-09", "points": P}, "BAD": {"freq": "Daily"}}}
r = rl.macro_fresh(M, t)
ok(r["DGS10"]["ok"] and r["DGS10"]["biz_days"] == 3, "Fed daily: 9 Oct -> 15 Oct is 3 US business days (12 Oct holiday skipped) -> fresh", r["DGS10"])
r2 = rl.macro_fresh(M, ms("2026-10-16T12:00:00Z"))
ok(not r2["DGS10"]["ok"] and r2["DGS10"]["biz_days"] == 4, "Fed daily: 4 business days -> stale", r2["DGS10"])
ok(not r["WTREGEN"]["ok"] and "12 days" in r["WTREGEN"]["limit"], "weekly 13.5 days old -> stale (limit 12 days)", r["WTREGEN"])
ok(rl.macro_fresh({"series": {"W": {"freq": "Weekly", "last_date": "2026-10-04", "points": P}}}, t)["W"]["ok"], "weekly 11.5 days old -> fresh")
ok(r["DEXUSEU"]["ok"] and "14 days" in r["DEXUSEU"]["limit"], "H.10 daily FX limit 14 days (9 Nov ruling)", r["DEXUSEU"])
ok(rl.FRESHNESS["h10_days"] == 14, "H.10 limit comes from shared/freshness.json h10_days = 14")
# Fri 30 Oct 2026 value (the 9 Nov stale-alarm case); age from 00:00 UTC of last_date
fx = lambda now: {s: rl.macro_fresh({"series": {s: {"freq": "Daily", "last_date": "2026-10-30", "points": P}}}, ms(now))[s] for s in ("DEXUSEU", "DEXJPUS", "DEXCHUS", "DTWEXBGS")}
for lbl, now, want in (("10.5 days (9 Nov 12:00Z, before the Monday release)", "2026-11-09T12:00:00Z", True),
                       ("11.0 days (Tue 00:20Z daily batch after a normal Monday release)", "2026-11-10T00:20:00Z", True),
                       ("12.0 days (Wed 00:20Z batch after a holiday-Monday Tuesday release)", "2026-11-11T00:20:00Z", True),
                       ("13.9 days", "2026-11-12T21:36:00Z", True),
                       ("exactly 14 days", "2026-11-13T00:00:00Z", True),
                       ("14.1 days -> stale", "2026-11-13T02:24:00Z", False)):
    v = fx(now); ok(all(x["ok"] is want for x in v.values()), f"H.10 DEXUSEU/DEXJPUS/DEXCHUS/DTWEXBGS {lbl}", v)
ok(not rl.macro_fresh({"series": {"DGS10": {"freq": "Daily", "last_date": "2026-10-30", "points": P}}}, ms("2026-11-09T12:00:00Z"))["DGS10"]["ok"], "widening H.10 does not touch Fed H.15 daily (DGS10 still on 3 business days)")
ok(not rl.macro_fresh({"series": {"X": {"freq": "Daily", "last_date": "2026-10-30", "points": P}}}, ms("2026-11-09T12:00:00Z"))["X"]["ok"], "other daily series keep 5 days")
ok(not r["BAD"]["ok"], "series without an observation date -> stale")
with tempfile.TemporaryDirectory() as d:
    rl.RUNS, rl.DERIVS, rl.MARKET, rl.MACRO = (os.path.join(d, x) for x in ("_runs.json", "derivs.json", "market.json", "macro.json"))
    json.dump({"assets": {}}, open(rl.DERIVS, "w")); json.dump({"updated": rl.iso(rl.now_ms())}, open(rl.MARKET, "w")); json.dump(M, open(rl.MACRO, "w"))
    rl.record(); R = json.load(open(rl.RUNS))
    ok(R["market"]["ok"] and "DGS10" in R["macro"] and "macro_stale" in R["runs"][-1] and "market" in R["runs"][-1], "record() writes market + per-series macro freshness into _runs.json", list(R))
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
