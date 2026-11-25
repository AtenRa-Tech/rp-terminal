#!/usr/bin/env python3
"""tsp500.py (25 Nov supervisor ruling): SP500 freshness is counted in NYSE trading days (scripts/nyse.py, twin of shared/nyse.js), limit 3
(shared/freshness.json sp500_trading_days), NOT the 5-calendar-day 'other daily' rule. Counting convention = nyse.biz_days / the ETF: NYSE trading
days AFTER last_date up to and INCLUDING today's UTC date (today counts even at 01Z, before the open); ok while count <= 3.
Judged the same in runs_log.macro_fresh (_runs.json), data_age.py (the stale alarm, recomputed against now), tests/tsmoke.js and index.html (tests/tsp500.js).
"""
import datetime as dt, json, os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
sys.path.insert(0, os.path.join(ROOT, "scripts")); sys.path.insert(0, os.path.join(ROOT, ".github", "scripts"))
import nyse
sys.argv = ["runs_log.py"]; import runs_log as rl
import data_age
def ok(c, n, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)
ms = lambda s: int(dt.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() * 1000)
P = [["2026-11-20", 1.0]]
def sp(last, now, sid="SP500"):
    return rl.macro_fresh({"series": {sid: {"freq": "Daily", "last_date": last, "points": P}}}, ms(now))[sid]
FR = json.load(open(os.path.join(ROOT, "shared", "freshness.json")))
ok(FR["sp500_trading_days"] == 3 == rl.NYSED_LIM == data_age.NYSED_LIM, "limit: shared/freshness.json sp500_trading_days = 3, read by runs_log.py and data_age.py")
ok(rl.NYSED == data_age.NYSED == ("SP500",), "runs_log.py and data_age.py judge the same series (SP500) in NYSE trading days")
html = open(os.path.join(ROOT, "index.html")).read()
ok(re.search(r"const NYSED=\{ids:\['SP500'\],lim:FRESHNESS\.sp500_trading_days\}", html) is not None, "index.html: NYSED = SP500, limit FRESHNESS.sp500_trading_days (same source)")

# ---- 1. the incident: 2026-11-25T01:18Z, live macro.json (fetched 24 Nov 05:04Z) has SP500 last_date Fri 2026-11-20
NOW1 = "2026-11-25T01:18:00Z"
old_rule = sp("2026-11-20", NOW1, "X")  # a series on the old 'other daily' 5-calendar-day rule: reproduces the red alarm
ok(not old_rule["ok"] and old_rule["age_d"] == 5.1 and old_rule["limit"] == "5 days (daily)", "reproduce 25 Nov 01:18Z: 5-calendar-day rule marks last_date 20 Nov stale (age 5.1d, '5 days (daily)')", old_rule)
r = sp("2026-11-20", NOW1)
ok(r["ok"] and r["biz_days"] == 3 == nyse.biz_days("2026-11-20", ms(NOW1)) and r["limit"] == "3 NYSE trading days", "Wed 25 Nov 01:18Z, last_date Fri 20 Nov: Mon 23 + Tue 24 + Wed 25 = 3 trading days -> PASS (runs_log)", r)
ok(sp("2026-11-23", NOW1)["biz_days"] == 2 and sp("2026-11-23", NOW1)["ok"], "same moment, last_date Mon 23 Nov (FRED caught up): 2 trading days -> PASS")
T = tempfile.mkdtemp()
def last_open(now):  # newest NYSE trading day on or before today's UTC date, so the unrelated ETF check stays green
    x = dt.datetime.fromisoformat(now.replace("Z", "+00:00")).date()
    while not nyse.is_open(x): x -= dt.timedelta(1)
    return str(x)
def alarm(macro, now, sid="SP500"):
    d = {"last_run": now, "runs": [{"feeds": {"BTC oi": {"t": now, "lim_h": 5.0}}}], "market": {"updated": now, "limit_h": 3}, "macro": macro,
         "macro_checked": {"checked_at": now}, "etf": {"ok": True, "limit_days": 2, "last_date": last_open(now)}}
    p = os.path.join(T, "r.json"); json.dump(d, open(p, "w"))
    q = subprocess.run([sys.executable, os.path.join(ROOT, ".github/scripts/data_age.py"), p, "--now", now], capture_output=True, text=True); return q.returncode, q.stdout + q.stderr
# the exact _runs.json shape the old code wrote at 01:10Z (ok false, age_d 5.1, limit '5 days (daily)') must NOT fail the alarm any more: data_age recomputes SP500 in NYSE days
OLD = {"SP500": {"ok": False, "last_date": "2026-11-20", "age_d": 5.1, "limit": "5 days (daily)"}}
rc, out = alarm(OLD, "2026-11-25T01:18:00Z")
ok("SP500" not in out and "macro" not in out.replace("macro_checked", ""), "stale alarm (data_age.py) 25 Nov 01:18Z, old-shape _runs.json (ok:false, 5 days) with last_date 20 Nov: no SP500 failure", (rc, out))
NEW = lambda last, now: {"SP500": sp(last, now)}
rc, out = alarm(NEW("2026-11-20", "2026-11-25T01:18:00Z"), "2026-11-25T01:18:00Z"); ok(rc == 0, "stale alarm, new-shape _runs.json, last_date 20 Nov at 25 Nov 01:18Z -> exit 0", (rc, out))

# ---- 2. Thanksgiving week (NYSE closed Thu 26 Nov 2026; Fri 27 Nov is a half day, open)
ok(not nyse.is_open("2026-11-26") and nyse.is_open("2026-11-27"), "NYSE: Thu 26 Nov 2026 closed, Fri 27 Nov open (half day)")
cases = [  # (last_date, now, expected trading days, expect ok, label)
    ("2026-11-25", "2026-11-30T01:00:00Z", 2, True, "last Wed 25, Mon 30 Nov 01Z: Fri 27 + Mon 30 (Thu closed)"),
    ("2026-11-25", "2026-12-01T01:00:00Z", 3, True, "last Wed 25, Tue 1 Dec 01Z: Fri 27 + Mon 30 + Tue 1 = 3 (at the limit)"),
    ("2026-11-27", "2026-12-01T01:00:00Z", 2, True, "last Fri 27, Tue 1 Dec 01Z (FRED one trading day behind): Mon 30 + Tue 1"),
    ("2026-11-24", "2026-11-26T01:00:00Z", 1, True, "last Tue 24, Thanksgiving Thu 26: Wed 25 only (Thu closed)"),
    ("2026-11-25", "2026-11-27T01:00:00Z", 1, True, "last Wed 25, Fri 27"),
    ("2026-11-20", "2026-11-26T12:00:00Z", 3, True, "last Fri 20, Thanksgiving Thu 26: Mon, Tue, Wed (Thu closed)"),
    ("2026-11-25", "2026-12-02T01:00:00Z", 4, False, "last Wed 25 still on Wed 2 Dec: 4 -> stalled, FAIL"),
]
for last, now, want, good, lbl in cases:
    r = sp(last, now); ok(r["biz_days"] == want == nyse.biz_days(last, ms(now)) and r["ok"] is good, f"Thanksgiving week: {lbl} -> {want} days, {'PASS' if good else 'FAIL'}", r)
# a day-by-day walk Wed 25 Nov .. Tue 1 Dec, each at 01Z, newest value = k-th trading day before that day (FRED lag k)
td = [dt.date(2026, 11, 18) + dt.timedelta(i) for i in range(0, 20) if nyse.is_open(dt.date(2026, 11, 18) + dt.timedelta(i))]
walk = {}
for k in (1, 2):
    for i in range(7):
        day = dt.date(2026, 11, 25) + dt.timedelta(i); prior = [x for x in td if x < day]; last = prior[-k]
        r = sp(str(last), f"{day}T01:00:00Z"); walk[(k, str(day))] = (str(last), r["biz_days"], r["ok"])
ok(all(v[2] for v in walk.values()), "walk 25 Nov -> 1 Dec 2026 at 01Z with FRED lag of 1 and 2 trading days: every day PASSES", {k: v for k, v in walk.items() if not v[2]})
print("  walk (lag, day, last_date, days):", [(k[0], k[1], v[0], v[1]) for k, v in walk.items()])
ok(max(v[1] for v in walk.values()) <= 3, "walk: highest count in the week is <= 3")
rc, out = alarm(NEW("2026-11-25", "2026-12-01T01:00:00Z"), "2026-12-01T01:00:00Z"); ok(rc == 0, "stale alarm 1 Dec 01Z, last_date Wed 25 Nov (3 days) -> exit 0", (rc, out))

# ---- 3. a genuinely stalled series must still go red (every layer)
for last, now, want in (("2026-11-18", "2026-11-25T01:18:00Z", 5), ("2026-11-19", "2026-11-25T01:18:00Z", 4), ("2026-11-20", "2026-11-27T12:00:00Z", 4), ("2026-11-24", "2026-12-02T01:00:00Z", 5)):
    r = sp(last, now); ok(not r["ok"] and r["biz_days"] == want, f"stalled: last_date {last} at {now[:16]}Z = {want} trading days -> FAIL (runs_log)", r)
    rc, out = alarm({"SP500": r}, now); ok(rc == 1 and "macro SP500: past its limit" in out and f"{want} NYSE trading days old" in out, f"stalled: stale alarm exits 1 and names SP500 ({want} NYSE trading days old)", (rc, out))
# even an old-shape / ok:true payload cannot hide a stalled SP500 from the alarm: it is recomputed against now
rc, out = alarm({"SP500": {"ok": True, "last_date": "2026-11-18", "limit": "5 days (daily)"}}, "2026-11-25T01:18:00Z"); ok(rc == 1 and "SP500" in out, "stalled: alarm recomputes against now, an ok:true payload with last_date 18 Nov still fails on 25 Nov", (rc, out))
ok(not rl.macro_fresh({"series": {"SP500": {"freq": "Daily", "last_date": None, "points": P}}}, ms(NOW1))["SP500"]["ok"], "SP500 with no observation date -> stale")
rc, out = alarm({"SP500": {"ok": False, "why": "missing or invalid observation date"}}, NOW1); ok(rc == 1 and "SP500" in out, "alarm: SP500 without last_date still fails via its ok flag", (rc, out))

# ---- other series are untouched
ok(sp("2026-11-23", NOW1, "RRPONTSYD")["limit"] == "5 days (daily)" and sp("2026-11-23", NOW1, "RRPONTSYD")["ok"] and not sp("2026-11-19", NOW1, "RRPONTSYD")["ok"], "RRPONTSYD (other daily) keeps the 5-calendar-day rule")
ok(rl.CAD["Daily"] == 5 and rl.FEDD == ("DGS10", "DGS2", "DFII10", "T10Y2Y") and rl.FEDD_LIM == 3 and sp("2026-11-20", NOW1, "DGS10")["limit"] == "3 US business days", "CAD Daily 5, Fed H.15 (US business days, 3) unchanged")

# ---- Python and JS count identically (shared/nyse.js)
pairs = [(l, n) for l, n, *_ in cases] + [("2026-11-20", NOW1), ("2026-11-18", NOW1), ("2026-11-19", NOW1), ("2026-11-20", "2026-11-27T12:00:00Z")]
jr = (subprocess.run(["node", "-e", "const N=require(process.argv[1]);console.log(JSON.stringify(JSON.parse(process.argv[2]).map(([a,n])=>N.bizDays(Date.parse(a),Date.parse(n)))))", os.path.join(ROOT, "shared", "nyse.js"), json.dumps(pairs)], capture_output=True, text=True)); js = json.loads(jr.stdout) if jr.returncode == 0 else jr.stderr[:400]
ok(js == [nyse.biz_days(a, ms(n)) for a, n in pairs], "shared/nyse.js and scripts/nyse.py count the same trading days on every case above", js)

print("FAILS:", len(F), F); sys.exit(1 if F else 0)
