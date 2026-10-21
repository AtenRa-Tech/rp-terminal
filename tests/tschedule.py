#!/usr/bin/env python3
"""21 Oct (slow schedule): no workflow runs more often than hourly; data jobs never overlap; the required `test` check always reports."""
import os, sys, yaml, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
def ok(c, n, x=None):
    print(("PASS " if c else "FAIL ") + n + ("" if c or x is None else " :: " + str(x)[:300]))
    c or F.append(n)
W = {os.path.basename(f): yaml.safe_load(open(f)) for f in glob.glob(os.path.join(ROOT, ".github/workflows/*.yml"))}
on = lambda w: w.get(True) or w.get("on") or {}
crons = {f: [c["cron"] for c in (on(w).get("schedule") or [])] for f, w in W.items() if isinstance(on(w), dict)}
def per_day(c):
    m, h, dom, mon, dow = c.split()
    nm = len(m.split(",")) if m != "*" else 60; nh = 24 if h == "*" else len(h.split(","))
    return nm * nh / (7 if dow != "*" else 1)
for f, cs in crons.items():
    for c in cs:
        m = c.split()[0]; ok("/" not in m and m != "*" and "," not in m, f"{f}: cron '{c}' fires at most once an hour", c)
ok(crons.get("data.yml") == ["17 * * * *", "20 0 * * *", "0 21 * * 4"], "data.yml: hourly :17 + daily 00:20 UTC batch + weekly Thu 21:00", crons.get("data.yml"))
ok("derivs.yml" not in W and "publish-derivs.yml" not in W, "derivs.yml and publish-derivs.yml removed (folded into data.yml)", sorted(W))
tot = sum(per_day(c) for cs in crons.values() for c in cs); ok(tot <= 27, f"scheduled runs/day {tot:.2f} <= 27 (publishing adds no runs: it is part of the data run)", tot)
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
