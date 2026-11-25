#!/usr/bin/env python3
"""tmacro_cadence.py (25 Nov): macro (FRED) is re-fetched by ANY refresh run once data/macro.json checked_at is >= 6h old (refresh_slot.py --macro-due,
data.yml plan output macro=true), not only by the daily 00:20 UTC batch. Before, macro.json was fetched once or twice a day and GitHub dropping crons left
15-24h gaps (24 Nov 10:11Z -> 25 Nov 01:22Z); dispatches (full=false) never ran macro. The batch, its catch-up and ETF logic are unchanged."""
import datetime as dt, json, os, subprocess, sys, tempfile
import yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
sys.path.insert(0, os.path.join(ROOT, ".github", "scripts"))
import refresh_slot as rs
def ok(c, n, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)
# ---- macro fetch cadence (25 Nov): any run re-fetches macro once macro.json checked_at is >= 6h old
t = lambda s: dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
ok(rs.MACRO_MAX_H == 6, "macro re-fetch age = 6h")
ok(rs.macro_due("2026-11-24T10:11:13Z", t("2026-11-25T01:06:00Z")), "incident: dispatch 25 Nov 01:06Z, macro checked 24 Nov 10:11Z (14.9h) -> macro due (old plan: no macro, batch only)")
ok(not rs.macro_due("2026-11-25T01:22:17Z", t("2026-11-25T07:22:00Z")) and rs.macro_due("2026-11-25T01:22:17Z", t("2026-11-25T07:22:17Z")), "5h59m -> not due, exactly 6h -> due")
ok(rs.macro_due(None, t("2026-11-25T01:06:00Z")) and rs.macro_due("garbage", t("2026-11-25T01:06:00Z")), "missing/unreadable checked_at -> due")
# replay of the real runs of 24 Nov (data.yml run list) with the new rule: every run that starts >= 6h after the last macro fetch re-fetches
runs = ["2026-11-24T10:06:39Z", "2026-11-24T13:56:06Z", "2026-11-24T15:59:03Z", "2026-11-24T17:17:43Z", "2026-11-24T19:03:03Z", "2026-11-24T21:11:03Z", "2026-11-24T23:03:42Z", "2026-11-25T01:06:00Z"]
last = t("2026-11-24T05:04:13Z"); fetches = []
for r_ in runs:
    if rs.macro_due(last.strftime("%Y-%m-%dT%H:%M:%SZ"), t(r_)) or r_ == runs[0]: last = t(r_) + dt.timedelta(minutes=5); fetches.append(r_)
ok(fetches == ["2026-11-24T10:06:39Z", "2026-11-24T17:17:43Z", "2026-11-25T01:06:00Z"] , "replay of the 24-25 Nov runs: macro fetched 10:06, 17:17 and 01:06Z (max gap ~8h, was 15h)", fetches)
W = yaml.safe_load(open(os.path.join(ROOT, ".github/workflows/data.yml"))); steps = W["jobs"]["refresh"]["steps"]
plan = next(s for s in steps if s.get("id") == "plan"); mac = next(s for s in steps if "fetch_macro.py" in str(s.get("run", "")))
ok(mac.get("if") == "steps.plan.outputs.full == 'true' || steps.plan.outputs.macro == 'true'", "data.yml macro step: batch OR plan macro=true", mac.get("if"))
def run_plan(event, full_input, macro_age_h):
    d = tempfile.mkdtemp(prefix="tsp500-"); os.makedirs(os.path.join(d, "data")); os.symlink(os.path.join(ROOT, ".github"), os.path.join(d, ".github"))
    now = dt.datetime.now(dt.timezone.utc); fmt = lambda x: x.strftime("%Y-%m-%dT%H:%M:%SZ")
    json.dump({"checked_at": fmt(now - dt.timedelta(hours=macro_age_h)), "updated": fmt(now)}, open(os.path.join(d, "data/macro.json"), "w"))
    json.dump({"checked_at": fmt(now), "updated": fmt(now), "datasets": {}}, open(os.path.join(d, "data/etf.json"), "w"))
    script = str(plan["run"]).replace("${{ github.event_name }}", event).replace("${{ inputs.full }}", full_input).replace("${{ github.event.schedule }}", "")
    out = os.path.join(d, "out"); open(out, "w").close()
    r = subprocess.run(["bash", "-e", "-c", script], cwd=d, env={**os.environ, "GITHUB_OUTPUT": out}, capture_output=True, text=True)
    return r.returncode, dict(l.split("=", 1) for l in open(out).read().split() if "=" in l), r.stdout + r.stderr
rc, o, lg = run_plan("workflow_dispatch", "false", 7); ok(rc == 0 and o.get("full") == "false" and o.get("macro") == "true", "plan: dispatch (full=false), macro checked 7h ago -> macro=true, no batch", (o, lg))
rc, o, lg = run_plan("workflow_dispatch", "false", 1); ok(rc == 0 and o.get("full") == "false" and o.get("macro") == "false", "plan: dispatch (full=false), macro checked 1h ago -> macro=false", (o, lg))
rc, o, lg = run_plan("workflow_dispatch", "true", 1); ok(rc == 0 and o.get("full") == "true" and o.get("macro") == "true", "plan: dispatch full=true -> macro=true (batch)", (o, lg))
cl = subprocess.run([sys.executable, os.path.join(ROOT, ".github/scripts/refresh_slot.py"), "--macro-due", "/nonexistent.json"], capture_output=True, text=True).stdout.strip(); ok(cl == "true", "refresh_slot.py --macro-due with an unreadable file -> true", cl)
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
