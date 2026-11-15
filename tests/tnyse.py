#!/usr/bin/env python3
"""tnyse.py (15 Nov ruling): scripts/nyse.py is the Python twin of shared/nyse.js. Identical holiday lists 2024-2030 and identical trading-day
counts (cross-check through node); the required calendar cases; runs_log.py writes _runs.json etf from it and the stale alarm (data_age.py) fails
past 2 NYSE trading days, skipping NYSE holidays only (Veterans Day counts)."""
import copy, datetime as dt, json, os, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
sys.path.insert(0, os.path.join(ROOT, "scripts")); sys.path.insert(0, os.path.join(ROOT, ".github", "scripts"))
import nyse
def ok(c, n, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)
D = dt.date; ms = lambda s: int(dt.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() * 1000)
# required cases
ok(not nyse.is_open("2027-03-26") and D(2027, 3, 26) in nyse.holidays(2027), "Good Friday 2027 (26 Mar) skipped")
ok(not nyse.is_open("2026-11-26") and not nyse.is_open("2027-11-25"), "Thanksgiving skipped")
ok(nyse.biz_days("2026-12-24", ms("2026-12-29T00:00:00Z")) == 2, "24 Dec -> 29 Dec 2026 counts 2 trading days", nyse.biz_days("2026-12-24", ms("2026-12-29T00:00:00Z")))
ok(nyse.is_open("2026-11-11") and nyse.is_open("2026-10-12"), "Veterans Day 11 Nov 2026 (and Columbus Day) are trading days")
ok(not nyse.is_open("2027-06-18"), "Juneteenth 2027 (Sat) -> Fri 18 Jun 2027 skipped")
ok(nyse.is_open("2027-12-31") and D(2028, 1, 1) not in nyse.holidays(2028), "1 Jan 2028 (Sat) -> Fri 31 Dec 2027 is a trading day")
ok(not nyse.is_open("2027-07-05"), "4 Jul 2027 (Sun) -> Mon 5 Jul skipped")
# cross-check with shared/nyse.js (node)
js = os.path.join(ROOT, "shared", "nyse.js")
pairs = [(str(D(2024, 1, 1) + dt.timedelta(k * 3)), ms(str(D(2024, 1, 1) + dt.timedelta(k * 3 + 1 + k % 9)) + "T12:00:00Z")) for k in range(0, 7 * 122)]
out = json.loads(subprocess.run(["node", "-e", f"const N=require({json.dumps(js)}),P=JSON.parse(process.argv[1]);const h={{}};for(let y=2024;y<=2030;y++)h[y]=N.holidays(y);"
                                 "console.log(JSON.stringify({h,b:P.map(([a,n])=>N.bizDays(Date.parse(a),n))}))", json.dumps(pairs)],
                                capture_output=True, text=True, check=True).stdout)
py = {str(y): sorted(str(d) for d in nyse.holidays(y)) for y in range(2024, 2031)}
ok(out["h"] == py, "shared/nyse.js and scripts/nyse.py give identical NYSE holiday lists 2024-2030", [(y, out["h"][y], py[y]) for y in py if out["h"][y] != py[y]][:2])
pb = [nyse.biz_days(a, n) for a, n in pairs]
ok(out["b"] == pb, f"identical trading-day counts on {len(pairs)} date pairs 2024-2030", [p for p, x, y in zip(pairs, out["b"], pb) if x != y][:3])
# runs_log.py writes _runs.json etf with the NYSE calendar
sys.argv = ["runs_log.py"]; import runs_log as rl
e = rl.etf_fresh({"last_date": "2026-11-10"}, ms("2026-11-12T12:00:00Z"))
ok(e["ok"] and e["biz_days"] == 2 and e["limit_days"] == 2, "runs_log etf: last 10 Nov, 12 Nov -> 2 trading days (Veterans Day counted), ok", e)
e = rl.etf_fresh({"last_date": "2026-11-10"}, ms("2026-11-13T00:30:00Z"))
ok(not e["ok"] and e["biz_days"] == 3, "runs_log etf: 13 Nov -> 3 trading days, stale", e)
e = rl.etf_fresh({"last_date": "2026-12-24"}, ms("2026-12-29T06:00:00Z"))
ok(e["ok"] and e["biz_days"] == 2, "runs_log etf: last 24 Dec, 29 Dec -> 2 (Christmas skipped), ok", e)
ok(not rl.etf_fresh({}, ms("2026-11-12T12:00:00Z"))["ok"], "runs_log etf: missing last_date is not ok")
ok(rl.us_biz_days("2026-11-10", ms("2026-11-12T12:00:00Z")) == 1, "bond calendar us_hol unchanged for H.15 (Veterans Day closed there)")
# stale alarm: data_age.py recomputes etf against now with the NYSE calendar
T = tempfile.mkdtemp()
BASE = {"last_run": "2026-11-12T11:50:00Z", "runs": [{"feeds": {"BTC oi": {"t": "2026-11-12T10:00:00Z", "lim_h": 5.0}}}],
        "market": {"updated": "2026-11-12T11:30:00Z", "limit_h": 3}, "macro": {}, "macro_checked": {"checked_at": "2026-11-12T00:30:00Z"}}
def run(d, now):
    p = os.path.join(T, "r.json"); json.dump(d, open(p, "w"))
    r = subprocess.run([sys.executable, os.path.join(ROOT, ".github/scripts/data_age.py"), p, "--now", now], capture_output=True, text=True); return r.returncode, r.stdout + r.stderr
def at(now, ld):
    d = copy.deepcopy(BASE); d["last_run"] = now; d["runs"][0]["feeds"]["BTC oi"]["t"] = now; d["market"]["updated"] = now; d["macro_checked"]["checked_at"] = now
    if ld is not None: d["etf"] = {"ok": True, "last_date": ld, "limit_days": 2}
    return run(d, now)
rc, o = at("2026-11-12T12:00:00Z", "2026-11-10"); ok(rc == 0, "alarm: ETF 2 trading days old (Veterans Day counted) passes", o)
rc, o = at("2026-11-13T00:30:00Z", "2026-11-10"); ok(rc == 1 and "etf" in o and "3 NYSE trading days" in o, "alarm: ETF 3 trading days old fails, recomputed against now (written ok:true ignored)", o)
rc, o = at("2026-12-29T06:00:00Z", "2026-12-24"); ok(rc == 0, "alarm: last 24 Dec, 29 Dec passes (Christmas skipped)", o)
rc, o = at("2027-03-29T12:00:00Z", "2027-03-24"); ok(rc == 0, "alarm: last Wed 24 Mar 2027, Mon 29 Mar passes (Good Friday skipped)", o)
rc, o = at("2026-11-12T12:00:00Z", None); ok(rc == 0 and "etf missing" in o, "alarm: older _runs.json without etf warns, does not fail", o)
# --- held-back newest row: fetch_etf.py keeps the newest days[] row pending (total None) until every fund reports; it is NOT published.
def etf(last, held=None, top=None):
    rows = lambda: [{"date": last, "pending": False, "total": -95.0}] + ([{"date": held, "pending": True, "total": None}] if held else [])
    return {"last_date": top or last, "datasets": {k: {"status": "ok", "last_date": last, "days": rows()} for k in ("btc", "eth")}}
ok(nyse.etf_last_complete(etf("2026-11-10", "2026-11-11", top="2026-11-11")) == ("2026-11-10", "2026-11-11"),
   "last complete day = newest non-pending row; the pending 11 Nov row is held back even if a top-level last_date named it")
ok(nyse.etf_last_complete(etf("2026-11-10")) == ("2026-11-10", None), "no pending row: nothing held back")
ok(nyse.etf_last_complete({"last_date": "2026-11-09"}) == ("2026-11-09", None), "old shape without datasets falls back to last_date")
live = json.load(open(os.path.join(ROOT, "data", "etf.json")))  # read only
lc = nyse.etf_last_complete(live); pend = [r["date"] for d in live["datasets"].values() for r in d["days"] if r.get("pending")]
ok(lc[0] == max(d["last_date"] for d in live["datasets"].values() if d.get("last_date")) and (lc[1] is None) == (not pend or max(pend) <= lc[0]),
   "data/etf.json (read only): last complete day equals fetch_etf.py's per-dataset last_date; held matches its pending rows", (lc, pend))
def alarm(E, now):
    d = copy.deepcopy(BASE); d["last_run"] = now; d["runs"][0]["feeds"]["BTC oi"]["t"] = now; d["market"]["updated"] = now; d["macro_checked"]["checked_at"] = now
    d["etf"] = rl.etf_fresh(E, ms(now)); return (d["etf"],) + run(d, now)
e, rc, o = alarm(etf("2026-11-10", "2026-11-11"), "2026-11-12T12:00:00Z")
ok(rc == 0 and e["ok"] and e["biz_days"] == 2 and e["held_back"] == "2026-11-11", "alarm: last complete day 2 trading days old with a pending newer row passes", (e, o))
e, rc, o = alarm(etf("2026-11-10", "2026-11-11"), "2026-11-13T00:30:00Z")
msg = "etf: last complete day 2026-11-10 is 3 NYSE trading days old > limit 2; newest row 2026-11-11 held back (pending)"
ok(rc == 1 and not e["ok"] and msg in o, "alarm: 3 trading days old fails; message names the last complete day and the held-back row", o)
e, rc, o = alarm(etf("2026-11-10"), "2026-11-13T00:30:00Z")
ok(rc == 1 and "etf: last complete day 2026-11-10 is 3 NYSE trading days old > limit 2; no row held back" in o, "alarm message without a pending row: 'no row held back'", o)
e, rc, o = alarm({"datasets": {"btc": {"days": [{"date": "2026-11-11", "pending": True, "total": None}]}}}, "2026-11-12T12:00:00Z")
ok(rc == 1 and "etf: no complete day" in o and "newest row 2026-11-11 held back (pending)" in o, "alarm: only a pending row is not a published day (fails, names it)", o)
# --- alarm (runs_log.py -> data_age.py) and smoke (tests/tsmoke.js bizDays + etfLast) give the same answer on the same (etf.json, now) pairs
CASES = [("2026-12-24", None, "2026-12-29T06:00:00Z"), ("2026-12-24", "2026-12-28", "2026-12-29T06:00:00Z"), ("2026-12-23", None, "2026-12-29T06:00:00Z"),
         ("2027-03-24", None, "2027-03-29T12:00:00Z"), ("2027-03-24", "2027-03-25", "2027-03-29T12:00:00Z"), ("2027-03-24", None, "2027-03-30T00:10:00Z"),
         ("2026-11-10", None, "2026-11-12T12:00:00Z"), ("2026-11-10", "2026-11-11", "2026-11-13T00:30:00Z"), ("2026-11-09", None, "2026-11-11T23:00:00Z"),
         ("2027-06-16", None, "2027-06-21T12:00:00Z"), ("2027-06-16", "2027-06-17", "2027-06-22T01:00:00Z"),
         ("2027-12-29", None, "2028-01-03T12:00:00Z"), ("2027-12-30", "2027-12-31", "2028-01-03T12:00:00Z"), ("2027-12-30", None, "2027-12-31T20:00:00Z"),
         ("2027-07-02", None, "2027-07-06T12:00:00Z"), ("2027-07-01", "2027-07-02", "2027-07-07T12:00:00Z")]
# CRYPTO GOD 15 Nov fixtures (limit 2): counted from last_date (last complete day), never from `updated`
CG = [("2026-11-13", "2026-11-15T12:00:00Z", 0, True), ("2026-11-13", "2026-11-17T12:00:00Z", 2, True),
      ("2026-11-13", "2026-11-18T12:00:00Z", 3, False), ("2026-11-25", "2026-11-27T12:00:00Z", 1, True)]
CASES += [(a, None, n) for a, n, _, _ in CG]
EJ = [etf(a, h) for a, h, _ in CASES]
sm = json.loads(subprocess.run(["node", "-e", "const s=require('./tsmoke.js'),C=JSON.parse(process.argv[1]);console.log(JSON.stringify(C.map(([E,n])=>{const L=s.etfLast(E),b=L.last?s.bizDays(Date.parse(L.last+'T00:00:00Z'),Date.parse(n)):null;return {last:L.last,held:L.held,biz:b,pass:b!==null&&b<=2}})))",
                                json.dumps([[E, n] for E, (_, _, n) in zip(EJ, CASES)])], cwd=os.path.join(ROOT, "tests"), capture_output=True, text=True, check=True).stdout.strip().splitlines()[-1])  # tsmoke prints its own self-test line on require
diff = []
for E, (a, h, n), s_ in zip(EJ, CASES, sm):
    e, rc, o = alarm(E, n)
    al = {"last": e.get("last_date"), "held": e.get("held_back"), "biz": e.get("biz_days"), "pass": rc == 0}
    if al != s_ or e["ok"] != s_["pass"]: diff.append((a, h, n, al, s_, o[-200:]))
ok(not diff and len(sm) == len(CASES), f"alarm (runs_log.py + data_age.py) and smoke (tsmoke.js bizDays/etfLast) agree on {len(CASES)} pairs: Christmas, Good Friday 2027, Veterans Day, Juneteenth 2027, 31 Dec 2027, 5 Jul 2027, with and without a held-back row", diff[:3])
for (a, n, bd, green), s_ in zip(CG, sm[-len(CG):]):
    E = etf(a); E["updated"] = "2026-10-01T00:00:00Z" if green else n  # an old/fresh `updated` must not change the answer
    e, rc, o = alarm(E, n)
    ok(e["biz_days"] == bd and (rc == 0) == green and s_["biz"] == bd and s_["pass"] == green,
       f"last {a}, now {n}: {bd} trading days -> {'green' if green else 'red'} in both the alarm and smoke (updated ignored)", (e, rc, s_, o[-160:]))
ok("updated" not in open(os.path.join(ROOT, "scripts", "runs_log.py")).read().split("def etf_fresh")[1].split("\ndef ")[0], "runs_log etf_fresh never reads `updated`")
ok(sum(x["pass"] for x in sm) not in (0, len(sm)), "the shared pairs include both passing and failing cases", [x["pass"] for x in sm])
print("\nFAILS:", len(F), json.dumps(F)); sys.exit(1 if F else 0)
