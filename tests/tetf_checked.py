#!/usr/bin/env python3
"""Supervisor: only the full batch writes checked_at; --light writes only light_checked_at.
refresh_slot.py and the Worker read checked_at (fallback: updated on old files), never light_checked_at.
ETF freshness comes only from last_date / the per-fund NYSE rule; no check-time field ever makes ETF fresh.
Fixtures only; temp output, never data/."""
import datetime as dt, io, contextlib, json, os, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(ROOT, "scripts")); sys.path.insert(0, os.path.join(ROOT, ".github/scripts"))
import fetch_etf as fe, refresh_slot as rs, importlib.util
fails = []
def ok(c, m, x=""):
    print(("ok   " if c else "FAIL ") + m + ("" if c else f" :: {x}"))
    if not c: fails.append(m)
def page(rows):
    tr = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<table class="etf"><tr><th></th><th>IBIT</th><th>FBTC</th><th>ARKB</th><th>Total</th></tr>{tr}</table>'
PENDING = page([["13 Nov 2026", "100.0", "20.0", "0.5", "120.5"], ["16 Nov 2026", "-", "15.0", "2.0", "17.0"]])   # IBIT not in yet -> newest row pending
T = tempfile.mkdtemp(); fe.OUT = os.path.join(T, "etf.json"); fe.fetch = lambda url: PENDING

def run(now, argv=None):
    fe.NOW = now
    with contextlib.redirect_stdout(io.StringIO()) as o, contextlib.redirect_stderr(io.StringIO()):
        fe.main([] if argv is None else argv)
    return json.load(open(fe.OUT)), o.getvalue()

# (b) a full run writes checked_at and not light_checked_at; a light run the reverse
D1 = dt.datetime(2026, 11, 16, 0, 25, tzinfo=dt.timezone.utc)
j1, _ = run(D1)
ok(j1["datasets"]["btc"]["days"][-1]["pending"] is True and j1["datasets"]["btc"]["last_date"] == "2026-11-13",
   "fixture: newest BTC row pending, last complete day 13 Nov", j1["datasets"]["btc"])
ok(j1["checked_at"] == "2026-11-16T00:25:00Z" and "light_checked_at" not in j1,
   "(b) full run writes checked_at and not light_checked_at", {k: j1.get(k) for k in ("checked_at", "light_checked_at", "updated")})

D1L = dt.datetime(2026, 11, 16, 15, 17, tzinfo=dt.timezone.utc)
j1l, o1l = run(D1L, ["--light"])
ok(j1l.get("checked_at") == "2026-11-16T00:25:00Z" and j1l.get("light_checked_at") == "2026-11-16T15:17:00Z" and j1l.get("updated") == j1.get("updated"),
   "(b) light run writes only light_checked_at; checked_at and updated stay", {**{k: j1l.get(k) for k in ("checked_at", "light_checked_at", "updated")}, "out": o1l})

# (a) a light re-fetch after 00:20 UTC leaves the daily batch due
D2 = dt.datetime(2026, 11, 17, 0, 24, tzinfo=dt.timezone.utc)   # after 00:20, still pending, light only
j2, o2 = run(D2, ["--light"])
ok(j2.get("checked_at") == "2026-11-16T00:25:00Z" and j2.get("light_checked_at") == "2026-11-17T00:24:00Z",
   "light re-fetch after 00:20 UTC: light_checked_at is today, checked_at is still yesterday's full run", {k: j2.get(k) for k in ("checked_at", "light_checked_at")})
now = dt.datetime(2026, 11, 17, 15, 7, tzinfo=dt.timezone.utc)
macro_yday = "2026-11-16T00:25:00Z"
ok(rs.batch_due(rs.checked_at([fe.OUT]) + [macro_yday], now) is True,
   "(a) refresh_slot: light re-fetch after 00:20 UTC leaves the daily batch due", (j2.get("checked_at"), j2.get("light_checked_at")))
# same files, if someone read light_checked_at the min stamp would be today and the batch would look done — prove we didn't
stamps = rs.checked_at([fe.OUT])
ok(stamps == [j2["checked_at"]] and "2026-11-17T00:24:00Z" not in stamps,
   "refresh_slot.checked_at returns checked_at, never light_checked_at", stamps)

# full batch later that day would clear it
j3, o3 = run(dt.datetime(2026, 11, 17, 0, 25, tzinfo=dt.timezone.utc), [])
ok(j3.get("checked_at") == "2026-11-17T00:25:00Z" and j3.get("light_checked_at") == "2026-11-17T00:24:00Z" and "no data change" in o3,
   "full run after the light re-fetch writes checked_at (content unchanged); light_checked_at carried", {**{k: j3.get(k) for k in ("checked_at", "light_checked_at")}, "out": o3})
ok(rs.batch_due(rs.checked_at([fe.OUT]) + ["2026-11-17T00:25:00Z"], now) is False,
   "after the full batch, batch_due is false", j3.get("checked_at"))

# old file without checked_at: fallback is updated, still not light_checked_at
old_path = os.path.join(T, "old.json")
json.dump({"updated": "2026-11-16T00:25:00Z", "light_checked_at": "2026-11-17T00:24:00Z"}, open(old_path, "w"))
ok(rs.checked_at([old_path]) == ["2026-11-16T00:25:00Z"],
   "old file with no checked_at: fallback is updated, never light_checked_at", rs.checked_at([old_path]))
ok(rs.batch_due(rs.checked_at([old_path]) + [macro_yday], now) is True,
   "old file: a light stamp today does not clear a stale updated", None)

# source: checked_at() body never reads light_checked_at as a value
src = open(os.path.join(ROOT, ".github/scripts/refresh_slot.py")).read()
body = src.split("def checked_at", 1)[1].split("if __name__", 1)[0]
ok('j.get("light_checked_at")' not in body and 'j["light_checked_at"]' not in body and 'j.get("checked_at") or j["updated"]' in body,
   "refresh_slot.checked_at implementation does not read light_checked_at as a value", body)

# (c) no check-time field makes stale ETF fresh
spec = importlib.util.spec_from_file_location("rl", os.path.join(ROOT, "scripts", "runs_log.py"))
rl = importlib.util.module_from_spec(spec); spec.loader.exec_module(rl)
# 17 Nov 15:07 UTC: last complete day 13 Nov is 2 NYSE sessions back (Fri 13, then Mon 16, Tue 17) -> at limit? 
# Safer: use a clearly stale last_date well past 2 trading days, with brand-new stamps.
t0 = int(dt.datetime(2026, 11, 17, 15, 7, tzinfo=dt.timezone.utc).timestamp() * 1000)
stale = json.loads(json.dumps(j3))
for d in stale["datasets"].values():
    d["days"] = [x for x in d["days"] if x["date"] <= "2026-11-10"]
    d["last_date"] = "2026-11-10"
    d["fetched"] = "2026-11-17T15:00:00Z"
stale["last_date"] = "2026-11-10"
stale.update(updated="2026-11-17T15:00:00Z", checked_at="2026-11-17T15:00:00Z", light_checked_at="2026-11-17T15:00:00Z")
r = rl.etf_fresh(stale, t0)
ok(r.get("ok") is False,
   "(c) stale last_date stays stale even when updated/checked_at/light_checked_at/fetched are minutes old", r)
fresh_page = open(os.path.join(ROOT, "index.html")).read()
fn = fresh_page[fresh_page.index("function etfFundState("):][:500]
ok("checked_at" not in fn and "light_checked_at" not in fn and "updated" not in fn and "etfLast" in fn,
   "(c) page etfFundState does not read any check-time field", fn)
etf_fn = open(os.path.join(ROOT, "scripts/runs_log.py")).read().split("def etf_fresh", 1)[1].split("\ndef ", 1)[0]
ok("checked_at" not in etf_fn and "light_checked_at" not in etf_fn,
   "(c) runs_log.etf_fresh does not read checked_at or light_checked_at")

print(f"FAILS: {len(fails)}")
sys.exit(1 if fails else 0)
