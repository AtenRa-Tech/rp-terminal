#!/usr/bin/env python3
"""17 Nov: an ETF row held back (pending: true, waiting on a fund) never makes the daily batch 'due' by itself.
fetch_etf.py writes checked_at EVERY run (even when nothing but timestamps changed), and refresh_slot.py batch_due reads checked_at
before updated. Fixture HTML only, no network (fetch_etf.fetch is mocked); temp output file, never data/."""
import datetime as dt, io, contextlib, json, os, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(ROOT, "scripts")); sys.path.insert(0, os.path.join(ROOT, ".github/scripts"))
import fetch_etf as fe, refresh_slot as rs
fails = []
def ok(c, m, x=""):
    print(("ok   " if c else "FAIL ") + m + ("" if c else f" :: {x}"))
    if not c: fails.append(m)
def page(rows):
    tr = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<table class="etf"><tr><th></th><th>IBIT</th><th>FBTC</th><th>ARKB</th><th>Total</th></tr>{tr}</table>'
PENDING = page([["13 Nov 2026", "100.0", "20.0", "0.5", "120.5"], ["16 Nov 2026", "-", "15.0", "2.0", "17.0"]])   # IBIT not in yet -> newest row pending
T = tempfile.mkdtemp(); fe.OUT = os.path.join(T, "etf.json"); fe.fetch = lambda url: PENDING
def run(now):
    fe.NOW = now
    with contextlib.redirect_stdout(io.StringIO()) as o, contextlib.redirect_stderr(io.StringIO()): fe.main()
    return json.load(open(fe.OUT)), o.getvalue()
D1 = dt.datetime(2026, 11, 16, 0, 25, tzinfo=dt.timezone.utc); D2 = dt.datetime(2026, 11, 17, 0, 24, tzinfo=dt.timezone.utc)
j1, _ = run(D1)
ok(j1["datasets"]["btc"]["days"][-1]["pending"] is True and j1["datasets"]["btc"]["last_date"] == "2026-11-13", "fixture: newest BTC row pending, last complete day 13 Nov", j1["datasets"]["btc"])
ok(j1["checked_at"] == j1["updated"] == "2026-11-16T00:25:00Z", "first run: checked_at = updated = fetch time", j1)
j2, o2 = run(D2)   # next day's batch: Farside unchanged (IBIT still '-')
ok(j2["updated"] == "2026-11-16T00:25:00Z" and j2["checked_at"] == "2026-11-17T00:24:00Z" and "no data change" in o2, "unchanged pending row next day: updated stays, checked_at = this run", (j2.get("updated"), j2.get("checked_at"), o2))
ok({k: v for k, v in j2.items() if k != "checked_at"} == {k: v for k, v in j1.items() if k != "checked_at"}, "only checked_at changed (data identical)")
macro_today = "2026-11-17T00:24:30Z"; now = dt.datetime(2026, 11, 17, 15, 7, tzinfo=dt.timezone.utc)
ok(rs.batch_due(rs.checked_at([fe.OUT]) + [macro_today], now) is False, "batch_due: pending ETF row + batch ran today -> NOT due (no full=true run)")
old = dict(j2); old.pop("checked_at"); f = os.path.join(T, "old.json"); json.dump(old, open(f, "w"))
ok(rs.batch_due(rs.checked_at([f]) + [macro_today], now) is True, "control: without checked_at the stale 'updated' would have made it due (the bug this fixes)")
print(f"FAILS: {len(fails)}"); sys.exit(1 if fails else 0)
