#!/usr/bin/env python3
"""tetf_pending.py (17 Nov, light ETF re-fetch, supervisor-approved). data.yml's hourly (non-batch) runs re-run ONLY fetch_etf.py while the newest
row of etf.json datasets.btc.days or datasets.eth.days is pending; with no pending row they do not fetch ETF; the daily batch logic is unchanged and
a pending row never triggers the batch (macro). Runs the REAL plan-step script from data.yml (GitHub expressions filled in) on fixture data/."""
import datetime as dt, json, os, shutil, subprocess, sys, tempfile, importlib.util
import yaml
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
fails = []
def ok(c, n, x=None):
    print(("PASS " if c else "FAIL ") + n + ("" if c or x is None else " :: " + str(x)[:600]))
    if not c: fails.append(n)
sp = importlib.util.spec_from_file_location("rs", os.path.join(ROOT, ".github/scripts/refresh_slot.py")); rs = importlib.util.module_from_spec(sp); sp.loader.exec_module(rs)
BASE = json.load(open(os.path.join(HERE, "fixtures/frozen/data/etf.json")))  # frozen: newest BTC and ETH rows (23 Oct) pending
def etf(btc_pending, eth_pending):
    E = json.loads(json.dumps(BASE))
    for a, p in (("btc", btc_pending), ("eth", eth_pending)):
        d = E["datasets"][a]["days"]
        if not p: E["datasets"][a]["days"] = [x for x in d if not x.get("pending")]
    return E
# unit: refresh_slot.etf_pending
ok(rs.etf_pending(BASE) is True, "frozen etf.json (newest rows pending) -> pending")
ok(rs.etf_pending(etf(True, False)) is True and rs.etf_pending(etf(False, True)) is True, "BTC-only or ETH-only pending newest row -> pending")
ok(rs.etf_pending(etf(False, False)) is False, "no pending row -> not pending")
old = etf(False, False); old["datasets"]["btc"]["days"][0]["pending"] = True
ok(rs.etf_pending(old) is False, "only the NEWEST row counts (an older row flagged pending does not trigger)")
ok(rs.etf_pending({}) is False and rs.etf_pending({"datasets": {"btc": {"days": []}}}) is False and rs.etf_pending("junk") is False, "empty / unreadable -> not pending (daily batch covers it)")
# workflow
W = yaml.safe_load(open(os.path.join(ROOT, ".github/workflows/data.yml"))); steps = W["jobs"]["refresh"]["steps"]
plan = next(s for s in steps if s.get("id") == "plan"); etfs = next(s for s in steps if str(s.get("run", "")).strip() == "python scripts/fetch_etf.py"); mac = next(s for s in steps if "fetch_macro.py" in str(s.get("run", "")))
ok(etfs.get("if") == "steps.plan.outputs.etf == 'true'" and str(etfs.get("run")).strip() == "python scripts/fetch_etf.py", "ETF step runs on plan output etf (fetch_etf.py only)", etfs)
ok(mac.get("if") == "steps.plan.outputs.full == 'true'", "macro step still gated on the daily batch only (a pending ETF row never runs macro)", mac.get("if"))
ok(sum("scripts/fetch_etf.py" in str(s.get("run", "")) for s in steps) == 1 and "fetch_macro" not in str(plan["run"]), "fetch_etf.py runs in exactly one step; the plan step never fetches anything itself")
T = tempfile.mkdtemp(prefix="tetfp-")
def run_plan(event, schedule, full_input, etf_obj, batch_done=True):
    d = os.path.join(T, f"{event}-{schedule}-{full_input}-{len(os.listdir(T))}".replace(" ", "_").replace("*", "x")); os.makedirs(os.path.join(d, "data"))
    os.symlink(os.path.join(ROOT, ".github"), os.path.join(d, ".github"))
    now = dt.datetime.now(dt.timezone.utc); chk = (now if batch_done else now - dt.timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    json.dump({"checked_at": chk, "updated": chk}, open(os.path.join(d, "data/macro.json"), "w"))
    e = json.loads(json.dumps(etf_obj)); e["updated"] = chk; json.dump(e, open(os.path.join(d, "data/etf.json"), "w"))
    script = str(plan["run"]).replace("${{ github.event_name }}", event).replace("${{ inputs.full }}", full_input).replace("${{ github.event.schedule }}", schedule)
    assert "${{" not in script, script
    out = os.path.join(d, "out"); open(out, "w").close()
    r = subprocess.run(["bash", "-e", "-c", script], cwd=d, env={**os.environ, "GITHUB_OUTPUT": out}, capture_output=True, text=True)
    o = dict(l.split("=", 1) for l in open(out).read().split() if "=" in l); return r.returncode, o, r.stdout + r.stderr
try:
    rc, o, log = run_plan("schedule", "17 * * * *", "", BASE)
    ok(rc == 0 and o.get("full") == "false" and o.get("etf") == "true", "hourly :17, batch done, newest row pending -> ETF fetch runs, no batch", (o, log))
    rc, o, log = run_plan("schedule", "47 * * * *", "", etf(False, True))
    ok(rc == 0 and o.get("full") == "false" and o.get("etf") == "true", "hourly :47, only ETH newest row pending -> ETF fetch runs, no batch", (o, log))
    rc, o, log = run_plan("schedule", "17 * * * *", "", etf(False, False))
    ok(rc == 0 and o.get("full") == "false" and o.get("etf") == "false", "hourly, no pending row -> no ETF fetch", (o, log))
    rc, o, log = run_plan("schedule", "20 0 * * *", "", etf(False, False))
    ok(rc == 0 and o.get("full") == "true" and o.get("etf") == "true", "daily 00:20 batch (no pending row) -> batch + ETF as before", (o, log))
    rc, o, log = run_plan("schedule", "0 21 * * 4", "", etf(False, False))
    ok(rc == 0 and o.get("full") == "true" and o.get("etf") == "true", "weekly Thu run -> batch + ETF as before", (o, log))
    rc, o, log = run_plan("schedule", "17 * * * *", "", etf(False, False), batch_done=False)
    ok(rc == 0 and o.get("full") == "true" and o.get("etf") == "true", "hourly with the batch due (missed 00:20) -> catch-up batch as before", (o, log))
    rc, o, log = run_plan("workflow_dispatch", "", "true", etf(False, False))
    ok(rc == 0 and o.get("full") == "true" and o.get("etf") == "true", "dispatch full=true -> batch as before", (o, log))
    rc, o, log = run_plan("workflow_dispatch", "", "false", etf(False, False))
    ok(rc == 0 and o.get("full") == "false" and o.get("etf") == "false", "dispatch full=false, no pending row -> no ETF fetch", (o, log))
    rc, o, log = run_plan("workflow_dispatch", "", "false", BASE)
    ok(rc == 0 and o.get("full") == "false" and o.get("etf") == "true", "dispatch full=false, pending row -> ETF fetch only, never the batch", (o, log))
finally:
    shutil.rmtree(T, ignore_errors=True)
print(f"FAILS: {len(fails)}"); sys.exit(1 if fails else 0)
