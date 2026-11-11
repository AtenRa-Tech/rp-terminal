#!/usr/bin/env python3
"""21 Oct (slow schedule): no cron fires more often than hourly; data jobs never overlap; the required `test` check always reports.
9 Nov: data.yml may have two hourly slots (:17, :47) only with the slot gate that exits before any fetch or deploy when derivatives
were fetched under 45 minutes ago, so there is still at most one real refresh an hour."""
import os, sys, yaml, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
def ok(c, n, x=None):
    print(("PASS " if c else "FAIL ") + n + ("" if c or x is None else " :: " + str(x)[:300]))
    c or F.append(n)
W = {os.path.basename(f): yaml.safe_load(open(f)) for f in glob.glob(os.path.join(ROOT, ".github/workflows/*.yml"))}
on = lambda w: w.get(True) or w.get("on") or {}
crons = {f: [c["cron"] for c in (on(w).get("schedule") or [])] for f, w in W.items() if isinstance(on(w), dict)}
def per_day(c):
    # 25 Oct: counts step (*/3, 0-12/2) and range fields too; '*/3' used to count as 1 hour instead of 8
    def n(f, size, lo):
        t = 0
        for part in f.split(","):
            r, _, st = part.partition("/"); st = int(st or 1)
            a, b = (lo, lo + size - 1) if r == "*" else ((int(r.split("-")[0]), int(r.split("-")[1])) if "-" in r else (int(r), int(r) if not st or "/" not in part else lo + size - 1))
            t += len(range(a, b + 1, st))
        return t
    m, h, dom, mon, dow = c.split()
    return n(m, 60, 0) * n(h, 24, 0) * (n(dow, 7, 0) / 7 if dow != "*" else 1)
for f, cs in crons.items():
    for c in cs:
        m = c.split()[0]; ok("/" not in m and m != "*" and "," not in m, f"{f}: cron '{c}' fires at most once an hour", c)
ok(crons.get("data.yml") == ["17 * * * *", "47 * * * *", "20 0 * * *", "0 21 * * 4"], "data.yml: hourly :17 and :47 slots + daily 00:20 UTC batch + weekly Thu 21:00", crons.get("data.yml"))
# 9 Nov: a second hourly slot is allowed only with the early-exit gate in front of every fetch/deploy job
DJ = W["data.yml"]["jobs"]; SL = DJ.get("slot") or {}; slrun = "\n".join(str(x.get("run", "")) for x in SL.get("steps", []))
two = sum(1 for c in crons.get("data.yml", []) if c.split()[1:] == ["*", "*", "*", "*"])
gated = ("refresh_slot.py" in slrun and "data/_runs.json" in slrun and DJ["refresh"].get("needs") == "slot" and DJ["refresh"].get("if") == "needs.slot.outputs.go == 'true'"
         and "slot" in DJ["stale-alarm"]["needs"] and "needs.slot.outputs.go == 'true'" in DJ["stale-alarm"]["if"])
ok(two <= 1 or gated, "two hourly slots only with the slot gate: refresh and stale-alarm run only when slot says go", (two, DJ["refresh"].get("needs"), DJ["refresh"].get("if"), DJ["stale-alarm"].get("if")))
ok(all("fetch_" not in str(x.get("run", "")) and "deploy" not in str(x.get("uses", "")) for x in SL.get("steps", [])), "slot job fetches nothing and deploys nothing (it only reads main's _runs.json)")
import importlib.util, datetime as _d
sp = importlib.util.spec_from_file_location("rs", os.path.join(ROOT, ".github/scripts/refresh_slot.py")); rs = importlib.util.module_from_spec(sp); sp.loader.exec_module(rs)
N = _d.datetime(2026, 11, 9, 10, 47, 30, tzinfo=_d.timezone.utc); lr = lambda m: {"last_run": (N - _d.timedelta(minutes=m)).strftime("%Y-%m-%dT%H:%M:%SZ")}
g = lambda ev, sch, R: rs.decide(ev, sch, R, N)[0]
ok(rs.SKIP_MIN == 45, "slot gate threshold is 45 minutes")
ok(g("schedule", "47 * * * *", lr(30)) is False and g("schedule", "47 * * * *", lr(44)) is False, ":47 skips when :17 fetched 30 or 44 min ago (one real refresh an hour)")
ok(g("schedule", "47 * * * *", lr(46)) is True and g("schedule", "17 * * * *", lr(120)) is True, ":47 runs when the last fetch is 46 min old (:17 was dropped); :17 runs after a 2h gap")
ok(g("schedule", "17 * * * *", lr(30)) is False, ":17 skips when the :47 slot fetched 30 min ago")
ok(g("workflow_dispatch", "", lr(1)) and g("schedule", "20 0 * * *", lr(1)) and g("schedule", "0 21 * * 4", lr(1)), "dispatches, the 00:20 UTC daily batch and the weekly run always go")
B = lambda h, m=0, d=11: _d.datetime(2026, 11, d, h, m, tzinfo=_d.timezone.utc); iso = lambda x: x.strftime("%Y-%m-%dT%H:%M:%SZ")
ok(rs.batch_due([iso(B(7, 34, 10)), iso(B(0, 25, 11))], B(6, 17)) is True, "11 Nov case: macro checked 10 Nov 07:34, 00:20 run dropped -> batch due at 06:17")
ok(rs.batch_due([iso(B(7, 34, 10))], B(6, 13)) is True, "CRYPTO GOD case: macro checked yesterday 07:34 UTC, run at 06:13 UTC today -> full batch")
ok(rs.batch_due([iso(B(0, 31)), iso(B(0, 31))], B(6, 47)) is False, "batch done at 00:31 today -> not due")
ok(rs.batch_due([iso(B(0, 31, 10)), iso(B(0, 31, 10))], B(0, 17)) is False and rs.batch_due([iso(B(0, 31, 10))], B(0, 47)) is True, "before 00:20 yesterday's batch counts; at 00:47 a missed 00:20 is due")
ok(rs.batch_due([], B(5)) is True and rs.batch_due(["junk"], B(5)) is True, "unknown macro/etf time -> due")
N2 = B(6, 47); ok(rs.decide("schedule", "47 * * * *", {"last_run": iso(B(6, 20))}, N2, [iso(B(7, 34, 10))])[0] is True, ":47 goes despite a fetch 27 min ago when the daily batch is due")
ok(rs.decide("schedule", "47 * * * *", {"last_run": iso(B(6, 20))}, N2, [iso(B(0, 31))])[0] is False, ":47 still skips when the batch is done and derivs are fresh")
P = W["data.yml"]["jobs"]["refresh"]["steps"]; pl = next(x["run"] for x in P if x.get("id") == "plan")
ok("refresh_slot.py --batch-due data/macro.json data/etf.json" in pl and "-ge 26" not in pl and "macro.json" in slrun and "etf.json" in slrun, "plan runs the daily batch when it is due since the last 00:20 slot; the slot job reads macro/etf too")
ok(g("schedule", "47 * * * *", {}) is True and g("schedule", "47 * * * *", {"last_run": "garbage"}) is True, "unreadable or missing runs log: runs (fail open)")
ok("derivs.yml" not in W and "publish-derivs.yml" not in W, "derivs.yml and publish-derivs.yml removed (folded into data.yml)", sorted(W))
tot = sum(per_day(c) for f, cs in crons.items() for c in cs if not (f == "data.yml" and c == "47 * * * *" and gated))  # a gated :47 slot is a chance, not a second refresh
ok(per_day("47 */3 * * *") == 8 and per_day("0 21 * * 4") == 1/7 and per_day("17 * * * *") == 24, "per_day counts */n steps and weekdays", (per_day("47 */3 * * *"), per_day("0 21 * * 4")))
ok(tot <= 27, f"real scheduled refreshes/day {tot:.2f} <= 27 (the gated :47 slot adds chances, not refreshes; publishing is part of the data run)", tot)
ok(sum(per_day(c) for cs in crons.values() for c in cs) <= 51, "all scheduled starts/day incl. skipped slots <= 51")
cc = W["data.yml"]["concurrency"]; ok(cc["group"] == "refresh-data" and cc["cancel-in-progress"] is False, "data.yml: refresh-data group, never cancelled mid-push/mid-publish", cc)
J = W["data.yml"]["jobs"]; ok(J["gates"]["needs"] == "refresh" and "pushed == 'true'" in J["gates"]["if"] and J["deploy"]["concurrency"]["group"] == "pages" and "rollback-alert" in J, "data.yml publishes in the same run (gates -> deploy[pages] -> smoke -> rollback -> rollback-alert), only after a push")
sm = J["smoke"]["steps"]; ok(any(str(s.get("name", "")).startswith("data-sha ${{ needs.gates.outputs.sha }}") for s in sm) and "data.yml" in open(os.path.join(ROOT, ".github/scripts/last_good.sh")).read(), "smoke names the deployed data sha; last_good.sh reads data.yml runs")
steps = W["data.yml"]["jobs"]["refresh"]["steps"]; run = "\n".join(s.get("run", "") for s in steps)
ok("fetch_derivs.py" in run and "fetch_market.py" in run and run.count("git commit") == 2, "data.yml: derivs + market in one run, one commit (re-made once on main in the push loop)")
ok("git add data/" in run and "git add -A -- data/" in run and "ssh-key" in str(steps[0]), "data.yml: stages only data/, pushes with the deploy key")
ok("gh workflow run" not in run, "data.yml refresh dispatches no other workflow (no per-push publish run)")
ci = W["ci.yml"]; t = ci["jobs"]["test"]
ok("if" not in t and "paths" not in str(on(ci).get("pull_request") or {}), "ci.yml test job always runs on PRs (required check never stuck)")
ts = t["steps"]; sc = [i for i, s in enumerate(ts) if s.get("id") == "scope"]
ok(sc and sc[0] <= 1, "scope step decides data-only vs full first")
heavy = [s["name"] for s in ts if "run-all.sh" in s.get("run", "") or "caption-sweep" in s.get("run", "")]
ok(heavy and all("full == 'true'" in str(s.get("if", "")) for s in ts if s.get("name") in heavy), "full suite only on code changes", heavy)
do = "\n".join(s.get("run", "") for s in ts if "full == 'false'" in str(s.get("if", "")))
ok("publish_guard.py" in do and "tsmoke.js" in do, "data-only change: publish guard + smoke test")
fb = "\n".join(s.get("run", "") for s in ci["jobs"]["smoke"]["steps"])
ok("derivs.yml" not in fb and fb.count("gh workflow run") == 1 and "busy" in fb, "smoke fallback: at most one data dispatch, only when none is queued/running")
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
