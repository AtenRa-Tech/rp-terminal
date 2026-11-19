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
plan = next(s for s in steps if s.get("id") == "plan"); etfs = next(s for s in steps if str(s.get("run", "")).strip() == "python scripts/fetch_etf.py"); light = next(s for s in steps if str(s.get("run", "")).strip() == "python scripts/fetch_etf.py --light"); mac = next(s for s in steps if "fetch_macro.py" in str(s.get("run", "")))
ok(etfs.get("if") == "steps.plan.outputs.full == 'true'", "batch ETF step (fetch_etf.py, no flag) runs only in the daily batch, as before", etfs.get("if"))
ok(light.get("if") == "steps.plan.outputs.full != 'true' && steps.plan.outputs.etf == 'true'", "light ETF step (fetch_etf.py --light) runs only outside the batch when plan says etf", light.get("if"))
ok(mac.get("if") == "steps.plan.outputs.full == 'true'", "macro step still gated on the daily batch only (a pending ETF row never runs macro)", mac.get("if"))
ok(sum("scripts/fetch_etf.py" in str(s.get("run", "")) for s in steps) == 2 and "fetch_macro" not in str(plan["run"]), "fetch_etf.py runs in exactly two steps (batch, light); the plan step never fetches anything itself")
T = tempfile.mkdtemp(prefix="tetfp-")
def run_plan(event, schedule, full_input, etf_obj, batch_done=True):
    d = os.path.join(T, f"{event}-{schedule}-{full_input}-{len(os.listdir(T))}".replace(" ", "_").replace("*", "x")); os.makedirs(os.path.join(d, "data"))
    os.symlink(os.path.join(ROOT, ".github"), os.path.join(d, ".github"))
    now = dt.datetime.now(dt.timezone.utc); chk = (now if batch_done else now - dt.timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    json.dump({"checked_at": chk, "updated": chk}, open(os.path.join(d, "data/macro.json"), "w"))
    e = json.loads(json.dumps(etf_obj)); e["updated"] = chk; e["checked_at"] = chk; json.dump(e, open(os.path.join(d, "data/etf.json"), "w"))
    script = str(plan["run"]).replace("${{ github.event_name }}", event).replace("${{ inputs.full }}", full_input).replace("${{ github.event.schedule }}", schedule)
    assert "${{" not in script, script
    out = os.path.join(d, "out"); open(out, "w").close()
    r = subprocess.run(["bash", "-e", "-c", script], cwd=d, env={**os.environ, "GITHUB_OUTPUT": out}, capture_output=True, text=True)
    o = dict(l.split("=", 1) for l in open(out).read().split() if "=" in l)
    o["batch_step"] = "yes" if o.get("full") == "true" else "no"; o["light_step"] = "yes" if o.get("full") != "true" and o.get("etf") == "true" else "no"
    return r.returncode, o, r.stdout + r.stderr
try:
    rc, o, log = run_plan("schedule", "17 * * * *", "", BASE)
    ok(rc == 0 and o.get("full") == "false" and o.get("etf") == "true" and o["light_step"] == "yes" and o["batch_step"] == "no", "hourly :17, batch done, newest row pending -> light ETF fetch (--light) runs, no batch", (o, log))
    rc, o, log = run_plan("schedule", "47 * * * *", "", etf(False, True))
    ok(rc == 0 and o.get("full") == "false" and o.get("etf") == "true", "hourly :47, only ETH newest row pending -> ETF fetch runs, no batch", (o, log))
    rc, o, log = run_plan("schedule", "17 * * * *", "", etf(False, False))
    ok(rc == 0 and o.get("full") == "false" and o.get("etf") == "false" and o["batch_step"] == o["light_step"] == "no", "hourly, no pending row -> no ETF fetch", (o, log))
    rc, o, log = run_plan("schedule", "20 0 * * *", "", etf(False, False))
    ok(rc == 0 and o.get("full") == "true" and o.get("etf") == "true" and o["batch_step"] == "yes" and o["light_step"] == "no", "daily 00:20 batch (no pending row) -> batch ETF fetch (no --light) as before", (o, log))
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
    # ---- fetch_etf.py --light (17 Nov): writes light_checked_at, NEVER checked_at; full run never stamps light_checked_at ----
    sp2 = importlib.util.spec_from_file_location("fe", os.path.join(ROOT, "scripts/fetch_etf.py"))
    def fe_run(prev, argv, changed=False):
        fe = importlib.util.module_from_spec(sp2); sp2.loader.exec_module(fe)
        out = os.path.join(T, f"etf-{len(os.listdir(T))}.json"); json.dump(prev, open(out, "w")); fe.OUT = out
        fe.fetch = lambda url: url
        def parse(url):
            a = "btc" if "bitcoin" in url or url.endswith("/btc/") else "eth"; d = json.loads(json.dumps(prev["datasets"][a]))
            if changed and a == "btc": max(d["days"], key=lambda x: x["date"])["funds"]["IBIT"] = -1.5
            return d["funds"], d["days"]
        fe.parse = parse; fe.main(argv); return json.load(open(out))
    P0 = json.loads(json.dumps(BASE)); P0["checked_at"] = "2026-10-24T00:31:00Z"
    o = fe_run(P0, ["--light"])
    ok(o.get("checked_at") == P0["checked_at"] and o.get("light_checked_at") and {k: v for k, v in o.items() if k != "light_checked_at"} == P0,
       "light re-fetch, no data change: only light_checked_at is stamped; checked_at and everything else untouched", {k: o.get(k) for k in ("checked_at", "light_checked_at", "updated")})
    o = fe_run(P0, ["--light"], changed=True)
    ok(o.get("checked_at") == P0["checked_at"] and o.get("light_checked_at") and max(o["datasets"]["btc"]["days"], key=lambda x: x["date"])["funds"]["IBIT"] == -1.5,
       "light re-fetch with a pending-row change: data written, light_checked_at stamped, checked_at untouched", {k: o.get(k) for k in ("checked_at", "light_checked_at")})
    P1 = {k: v for k, v in P0.items() if k != "checked_at"}
    o = fe_run(P1, ["--light"], changed=True); ok("checked_at" not in o and o.get("light_checked_at"), "light re-fetch never creates checked_at", list(o))
    P2 = dict(P0, light_checked_at="2026-10-24T09:17:00Z")
    o = fe_run(P2, [], changed=True)
    ok(o.get("light_checked_at") == "2026-10-24T09:17:00Z" and o.get("checked_at") and o.get("checked_at") != P0["checked_at"],
       "full (no flag) run writes a new checked_at and never stamps light_checked_at (carries the old one)", {k: o.get(k) for k in ("checked_at", "light_checked_at")})
    o = fe_run(P2, [])  # no data change
    ok(o.get("light_checked_at") == "2026-10-24T09:17:00Z" and o.get("checked_at") and o.get("checked_at") != P0["checked_at"] and o.get("updated") == P2.get("updated"),
       "full run with no data change still writes checked_at; light_checked_at and updated stay", {k: o.get(k) for k in ("checked_at", "light_checked_at", "updated")})
    # ---- ETF freshness comes ONLY from each fund's last complete day: fresh run stamps never make stale ETF fresh ----
    T0 = int(dt.datetime(2026, 10, 24, 15, 26, tzinfo=dt.timezone.utc).timestamp() * 1000)  # runs_log takes ms
    ST = json.loads(json.dumps(BASE))
    for d in ST["datasets"].values(): d["days"] = [x for x in d["days"] if x["date"] <= "2026-10-16"]; d["last_date"] = "2026-10-16"
    ST["last_date"] = "2026-10-16"; stamp = "2026-10-24T15:20:00Z"; ST.update(updated=stamp, checked_at=stamp, light_checked_at=stamp)
    for d in ST["datasets"].values(): d["fetched"] = stamp
    sp3 = importlib.util.spec_from_file_location("rl", os.path.join(ROOT, "scripts/runs_log.py")); rl = importlib.util.module_from_spec(sp3); sp3.loader.exec_module(rl)
    r = rl.etf_fresh(ST, T0); rf = rl.etf_fresh(BASE, T0)
    ok(r.get("ok") is False and all(f.get("ok") is False for f in (r.get("funds") or {}).values()) and rf.get("ok") is True,
       "stale alarm (runs_log.etf_fresh): rows end 16 Oct -> stale although updated/checked_at/light_checked_at/fetched are minutes old; frozen file fresh", {"stale": r, "fresh": rf.get("ok")})
    fst, fba = os.path.join(T, "st.json"), os.path.join(T, "base.json"); json.dump(ST, open(fst, "w")); json.dump(BASE, open(fba, "w"))
    js = ("const m=require(process.argv[1]),fs=require('fs'),J=f=>JSON.parse(fs.readFileSync(f,'utf8')),n=Date.parse('2026-10-24T15:26:00Z');"
          "console.log('@@'+JSON.stringify({s:m.etfFresh(J(process.argv[2]),n).pass,f:m.etfFresh(J(process.argv[3]),n).pass}))")
    rr = subprocess.run(["node", "-e", js, os.path.join(HERE, "tsmoke.js"), fst, fba], capture_output=True, text=True)
    R = json.loads(rr.stdout.split("@@", 1)[1]) if "@@" in rr.stdout else {}
    ok(R == {"s": False, "f": True}, "smoke (tsmoke etfFresh): stale rows fail whatever the run stamps say; frozen file passes", (R, rr.stderr[-300:]))
    src = open(os.path.join(ROOT, "index.html")).read()
    fs = src[src.index("function etfFundState("):][:400]
    ok("checked_at" not in fs and "updated" not in fs and "etfLast" in fs, "page etfFundState judges only the last complete day (no run stamp read)", fs)
    ok("checked_at" not in open(os.path.join(ROOT, "scripts/runs_log.py")).read().split("def etf_fresh", 1)[1].split("\ndef ", 1)[0], "runs_log.etf_fresh reads no checked_at / light_checked_at")
finally:
    shutil.rmtree(T, ignore_errors=True)
print(f"FAILS: {len(fails)}"); sys.exit(1 if fails else 0)
