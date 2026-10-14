#!/usr/bin/env python3
"""_runs.json market (2h) and macro per-series freshness (Fed daily 3 US business days skipping bond holidays; weekly 12 days)."""
import datetime as dt, importlib.util, json, os, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
spec = importlib.util.spec_from_file_location("rl", os.path.join(ROOT, "scripts", "runs_log.py")); rl = importlib.util.module_from_spec(spec); spec.loader.exec_module(rl)
def ok(c, n, x=''):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)
ms = lambda s: int(dt.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() * 1000)
t = ms("2026-10-15T12:00:00Z")
ok(rl.market_fresh({"updated": "2026-10-15T10:30:00Z"}, t)["ok"], "market 1.5h old -> fresh")
ok(not rl.market_fresh({"updated": "2026-10-15T09:30:00Z"}, t)["ok"], "market 2.5h old -> stale (limit 2h)")
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
ok(r["DEXUSEU"]["ok"] and "10 days" in r["DEXUSEU"]["limit"], "H.10 daily FX keeps its 10-day limit", r["DEXUSEU"])
ok(not r["BAD"]["ok"], "series without an observation date -> stale")
with tempfile.TemporaryDirectory() as d:
    rl.RUNS, rl.DERIVS, rl.MARKET, rl.MACRO = (os.path.join(d, x) for x in ("_runs.json", "derivs.json", "market.json", "macro.json"))
    json.dump({"assets": {}}, open(rl.DERIVS, "w")); json.dump({"updated": rl.iso(rl.now_ms())}, open(rl.MARKET, "w")); json.dump(M, open(rl.MACRO, "w"))
    rl.record(); R = json.load(open(rl.RUNS))
    ok(R["market"]["ok"] and "DGS10" in R["macro"] and "macro_stale" in R["runs"][-1] and "market" in R["runs"][-1], "record() writes market + per-series macro freshness into _runs.json", list(R))
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
