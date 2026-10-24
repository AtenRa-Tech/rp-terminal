#!/usr/bin/env python3
"""Fast publish: path selection, no-regress before any deploy, live never going backwards, and the workflow wiring."""
import importlib.util, json, os, re, subprocess, sys, tempfile, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []; T = tempfile.mkdtemp()
def ok(c, n, x=''):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)
spec = importlib.util.spec_from_file_location("pp", os.path.join(ROOT, ".github/scripts/publish_path.py")); pp = importlib.util.module_from_spec(spec); spec.loader.exec_module(pp)
# 1) path selection
for lab, ch, want in ((["data/derivs.json", "data/_runs.json"], None, "fast"), (["data/derivs.json"], None, "fast"), (["data/_runs.json"], None, "fast"), ([], None, "fast"),
                      (["data/derivs.json", "data/market.json"], None, "fast"), (["data/market.json", "data/macro.json", "data/_runs.json"], None, "fast"), (["data/market.json", "data/etf.json"], None, "fast"), (["data/calendar.json"], None, "fast"), (["data/derivs.json", "index.html"], None, "fast"), (["index.html"], None, "fast"),
                      (["data/etf.json"], None, "fast"), ([".github/workflows/ci.yml", "data/_runs.json"], None, "fast"), (["qa/card-presence.js"], None, "fast")):
    got = pp.select(lab)[0]; ok(got == want, f"path selection {lab or '(no change)'} -> {want}", got)
# 2) no-regress before deploy, and live never backwards
S = os.path.join(T, "site"); os.makedirs(S + "/data")
def files(site_upd, site_run, live_upd, live_run):
    json.dump({"updated": site_upd}, open(S + "/data/derivs.json", "w")); json.dump({"last_run": site_run}, open(S + "/data/_runs.json", "w"))
    json.dump({"updated": live_upd}, open(T + "/ld.json", "w")); json.dump({"last_run": live_run}, open(T + "/lr.json", "w"))
def nr(*a):
    env = dict(os.environ, LIVE_DERIVS=T + "/ld.json", LIVE_RUNS=T + "/lr.json")
    r = subprocess.run([sys.executable, os.path.join(ROOT, ".github/scripts/no_regress.py"), *a], env=env, capture_output=True, text=True); return r.returncode, r.stdout + r.stderr
A, B = "2026-10-14T18:00:00Z", "2026-10-14T18:15:00Z"
files(B, B, A, A); ok(nr("check", S)[0] == 0, "check: newer than live -> publish")
files(A, A, A, A); ok(nr("check", S)[0] == 0, "check: same as live -> publish (re-deploy)")
files(A, B, B, B); rc, o = nr("check", S); ok(rc == 1 and "Refusing to publish" in o, "check: derivs.json updated older than live -> refuse", o)
files(B, A, B, B); rc, o = nr("check", S); ok(rc == 1 and "last_run" in o, "check: _runs.json last_run older than live -> refuse", o)
files(None, None, A, A); rc, o = nr("check", S); ok(rc == 0 and "::warning" in o, "check: missing value on the new side is reported, not treated as newer", o)
snap = T + "/snap.json"
files(B, B, A, A); nr("snapshot", snap)  # live before deploy = A
files(B, B, B, B); ok(nr("after", snap)[0] == 0, "after: live moved forward -> OK")
files(B, B, A, A); ok(nr("after", snap)[0] == 0, "after: live unchanged -> OK")
json.dump({"updated": B, "last_run": B}, open(snap, "w"))
files(B, B, A, B); rc, o = nr("after", snap); ok(rc == 1 and "went backwards" in o, "after: live derivs.json 'updated' went backwards -> FAIL", o)
files(B, B, B, A); rc, o = nr("after", snap); ok(rc == 1, "after: live _runs.json last_run went backwards -> FAIL", o)
# 3) wiring
W = lambda f: yaml.safe_load(open(os.path.join(ROOT, ".github/workflows", f)))
pub, ci = W("data.yml"), W("ci.yml")  # 21 Oct: the publish path lives in data.yml (publish-derivs.yml and derivs.yml removed)
ok(pub["concurrency"]["group"] == "refresh-data" and pub["concurrency"]["group"] != str(ci["concurrency"]["group"]), "data+publish path has its own concurrency group (never queued behind full CI)", pub["concurrency"])
ok(pub["concurrency"]["cancel-in-progress"] is False, "a running fast publish is never cancelled")
gate = "\n".join(st.get("run", "") for st in pub["jobs"]["gates"]["steps"])
need = ["qa/fixture-consistency.js", "tests/tclosed_hours.py", "qa/stale-derivs2.js", "qa/stale-captions.js", "qa/card-presence.js", "qa/oicap-label.js", "qa/caption-sweep.js"]
ok(all(n in gate for n in need), "fast gates include all 7 required checks", [n for n in need if n not in gate])
ok("tests/run-all.sh" not in gate, "fast gates do not run the full node suite")
ok(pub["jobs"]["gates"]["needs"] == "refresh" and "pushed == 'true'" in pub["jobs"]["gates"]["if"] and "gates" in pub["jobs"]["deploy"]["needs"] and "deploy" in pub["jobs"]["smoke"]["needs"] and pub["jobs"]["rollback"]["needs"] == "smoke", "refresh (pushed) -> gates -> deploy -> smoke -> rollback")
dep = "\n".join(st.get("run", "") for st in pub["jobs"]["deploy"]["steps"]); cid = "\n".join(st.get("run", "") for st in ci["jobs"]["deploy"]["steps"])
ok("snapshot.sh" in dep and "snapshot.sh" in cid, "both deploy paths build via snapshot.sh (tested code + newest data/, no-regress + guard)")
ds = pub["jobs"]["deploy"]["steps"]; iN = [i for i, st in enumerate(ds) if "snapshot.sh" in st.get("run", "")]; iD = [i for i, st in enumerate(ds) if "deploy-pages" in str(st.get("uses", ""))]
cs_ = ci["jobs"]["deploy"]["steps"]; jN = [i for i, st in enumerate(cs_) if "snapshot.sh" in st.get("run", "")]; jD = [i for i, st in enumerate(cs_) if "deploy-pages" in str(st.get("uses", ""))]
ok(iN and iD and iN[0] < iD[0] and jN and jD and jN[0] < jD[0], "no-regress runs before deploy-pages in both paths", (iN, iD, jN, jD))
ok("_runs.json" in dep and "minutes_to_deploy" in dep, "publish timing logged into _runs.json")
sm = "\n".join(st.get("run", "") for st in pub["jobs"]["smoke"]["steps"]); cs = "\n".join(st.get("run", "") for st in ci["jobs"]["smoke"]["steps"])
ok("no_regress.py after" in sm and "no_regress.py after" in cs, "both smoke jobs fail if live went backwards")
ok(not os.path.exists(os.path.join(ROOT, ".github/workflows/publish-derivs.yml")) and not os.path.exists(os.path.join(ROOT, ".github/workflows/derivs.yml")), "no separate publish or derivatives workflow (one data run publishes itself)")
# 4) last good deploy pick: 'null null' (no successful run yet) and junk are ignored; newest real one wins
A1, A2 = "a" * 40, "b" * 40
ok(pp.pick_good(["null null", f"2026-10-14T18:00:00Z {A1}"]) == A1, "pick: 'null null' from a workflow with no good run is ignored (was picked by sort before)")
ok(pp.pick_good([f"2026-10-14T18:00:00Z {A1}", f"2026-10-14T19:00:00Z {A2}"]) == A2, "pick: newest good deploy wins")
ok(pp.pick_good(["", "null null"]) == "", "pick: none -> empty (caller takes the FULL path)")
ok(pp.pick_good(["2026-10-14T19:00:00Z HEAD"]) == "", "pick: non-sha ignored")
lg = open(os.path.join(ROOT, ".github/scripts/last_good.sh")).read()
ok("x['name']=='smoke'" in lg and "success" in lg and "data-sha " in lg and "--workflow data.yml" in lg, "a data run counts as a good deploy only when its smoke job succeeded, using the deployed data sha (not the run's headSha)")
ok("last_good.sh" in "\n".join(st.get("run", "") for st in pub["jobs"]["rollback"]["steps"]), "rollback uses last_good.sh (data of the last good deploy)")
# 5) market/macro fast path
ok(pp.market_changed(["data/market.json"]) and pp.market_changed(["data/macro.json", "data/derivs.json"]) and not pp.market_changed(["data/derivs.json", "data/_runs.json"]), "market flag set only when market.json/macro.json changed")
gate = "\n".join(st.get("run", "") for st in pub["jobs"]["gates"]["steps"])
ok(all(n in gate for n in ("tdollar.js", "tests/tbreadth.py", "qa/pulse-movers.js", "qa/caption-sweep.js")) and "steps.path.outputs.market" in gate, "market/macro gates: tdollar, breadth rebuild, pulse movers, caption sweep", gate[-600:])
for k, f in (("market_updated", "market.json"), ("macro_updated", "macro.json")):
    json.dump({"updated": A}, open(S + "/data/" + f, "w")); json.dump({"updated": B}, open(T + "/" + f, "w"))
os.environ.update(LIVE_MARKET=T + "/market.json", LIVE_MACRO=T + "/macro.json")
files(B, B, A, A); rc, o = nr("check", S); ok(rc == 1 and "market_updated" in o and "macro_updated" in o, "check: market.json/macro.json older than live -> refuse", o)
for f in ("market.json", "macro.json"): json.dump({"updated": B}, open(S + "/data/" + f, "w"))
rc, o = nr("check", S); ok(rc == 0, "check: market/macro same as live -> publish", o)
json.dump({"updated": B, "last_run": B, "market_updated": "2026-10-14T19:00:00Z", "macro_updated": B}, open(snap, "w"))
json.dump({"updated": "2026-10-14T18:30:00Z"}, open(T + "/market.json", "w")); files(B, B, B, B)
rc, o = nr("after", snap); ok(rc == 1 and "market_updated" in o, "after: live market.json 'updated' went backwards -> FAIL", o)
dd = "\n".join(st.get("run", "") for st in W("data.yml")["jobs"]["refresh"]["steps"])
ok("gh workflow run" not in dd and "pushed=true" in dd and "sha=" in dd, "data.yml refresh dispatches nothing; it hands the pushed sha to its own publish jobs")
ok("market.json" in open(os.path.join(ROOT, ".github/scripts/newest_data.sh")).read(), "newest data at deploy time includes market/macro")
# 6) smoke rollback never makes live updated / last_run go backwards: code from the last good commit, data/ newest of main HEAD and live
rb = T + "/rb"; os.makedirs(rb + "/data", exist_ok=True)
C, Dn = "2026-10-14T20:00:00Z", "2026-10-14T21:00:00Z"
def rbset(site, live):  # site = data/ the rollback starts from (main HEAD copy); live = what is on the site now
    for k, (f, fld, ev) in (("updated", ("derivs.json", "updated", "LIVE_DERIVS")), ("last_run", ("_runs.json", "last_run", "LIVE_RUNS")), ("m", ("market.json", "updated", "LIVE_MARKET")), ("x", ("macro.json", "updated", "LIVE_MACRO"))):
        json.dump({fld: site, "src": "head"}, open(f"{rb}/data/{f}", "w")); json.dump({fld: live, "src": "live"}, open({"LIVE_DERIVS": T + "/ld.json", "LIVE_RUNS": T + "/lr.json", "LIVE_MARKET": T + "/market.json", "LIVE_MACRO": T + "/macro.json"}[ev], "w"))
for lab, site_t, live_t in (("live newer than main HEAD", C, Dn), ("main HEAD newer than live", Dn, C), ("equal", C, C)):
    rbset(site_t, live_t); json.dump({"updated": live_t, "last_run": live_t, "market_updated": live_t, "macro_updated": live_t}, open(snap, "w"))
    rc1, o1 = nr("newest", rb); rc2, o2 = nr("check", rb)
    got = {f: json.load(open(f"{rb}/data/{f}")) for f in ("derivs.json", "_runs.json", "market.json", "macro.json")}
    newest = max(site_t, live_t); vals = [got["derivs.json"]["updated"], got["_runs.json"]["last_run"], got["market.json"]["updated"], got["macro.json"]["updated"]]
    # after the rollback deploy, live = this site folder: it must not be older than live before
    for f, fld in (("derivs.json", "updated"), ("_runs.json", "last_run"), ("market.json", "updated"), ("macro.json", "updated")):
        json.dump(got[f], open({"derivs.json": T + "/ld.json", "_runs.json": T + "/lr.json", "market.json": T + "/market.json", "macro.json": T + "/macro.json"}[f], "w"))
    rc3, o3 = nr("after", snap)
    ok(rc1 == 0 and rc2 == 0 and rc3 == 0 and all(v == newest for v in vals), f"rollback ({lab}): data = newest of main HEAD and live; live updated/last_run never go backwards", (o1, o2, o3, vals))
rj = ci["jobs"]["rollback"]; rs = "\n".join(st.get("run", "") for st in rj["steps"])
ok("snapshot.sh" in rs and "--rollback" in rs and "tested_sha.sh" in rs, "ci.yml rollback restores tested code only (pages-tested) via snapshot.sh --rollback", rs[-400:])
ix = [i for i, st in enumerate(rj["steps"]) if "snapshot.sh" in st.get("run", "")]; iy = [i for i, st in enumerate(rj["steps"]) if "deploy-pages" in str(st.get("uses", ""))]
ok(ix and iy and ix[0] < iy[0], "rollback data step runs before deploy-pages", (ix, iy))
rbs = open(os.path.join(ROOT, ".github/scripts/rollback_data.sh")).read()
ok("FETCH_HEAD" in rbs and "no_regress.py\" newest" in rbs.replace('"$(dirname "$0")/no_regress.py" newest', 'no_regress.py" newest') and "check" in rbs, "rollback_data.sh: main HEAD data, then newest-from-live, then never-backwards check")
# 7) publish guard on the exact derivs.json: test copies (hermetic.js) refused, clean file accepted, open hours / changed history refused
G = os.path.join(ROOT, ".github/scripts/publish_guard.py"); MAIN = os.path.join(ROOT, "data/derivs.json"); HR = 3600000
def guard(f, now, main=MAIN):
    r = subprocess.run([sys.executable, G, f] + ([main] if main else []), env=dict(os.environ, NOW_MS=str(now)), capture_output=True, text=True); return r.returncode, r.stdout + r.stderr
mj = json.load(open(MAIN)); lastP = max(p[0] for A in mj["assets"].values() for k in ("oi_hourly", "basis_hourly") for p in (A.get(k) or {}).get("points", []))
now = lastP + 5 * HR + 20 * 60000; top = (now // HR) * HR  # 5h20m after main's newest hourly point
hj = lambda end: subprocess.run(["node", os.path.join(ROOT, "tests/hermetic.js"), str(now), str(end)], capture_output=True, text=True).stdout.strip()
f_open, f_closed = hj(top), hj(top - HR)
ok(f_open.startswith(tempfile.gettempdir()) and f_closed.startswith(tempfile.gettempdir()) and "/data/" not in f_open, "hermetic.js writes only to a temp dir", (f_open, f_closed))
jo = json.load(open(f_open)); ok(jo.get("_test_only") is True and any(p[-1] == "cf" for p in jo["assets"]["BTC"]["oi_hourly"]["points"]), "hermetic copy stamped _test_only and carried-forward points marked cf")
rc, o = guard(f_open, now); ok(rc == 1 and "not yet closed" in o and "_test_only" in o, "guard refuses a carried-forward file ending at the OPEN hour", o)
rc, o = guard(f_closed, now); ok(rc == 1 and "carried-forward" in o, "guard refuses a carried-forward file ending at the last CLOSED hour", o)
rc, o = guard(MAIN, now); ok(rc == 0, "guard accepts the clean committed derivs.json (closed hours only, identical to main)", o)
c = json.loads(json.dumps(mj)); c["assets"]["BTC"]["oi_hourly"]["points"].append([top, 1.0, 2.0]); cf_ = T + "/g_open.json"; json.dump(c, open(cf_, "w"))
rc, o = guard(cf_, now); ok(rc == 1 and "not yet closed" in o, "guard refuses an unmarked point for the open hour", o)
c = json.loads(json.dumps(mj)); p0 = c["assets"]["ETH"]["basis_hourly"]["points"][-3]; p0[-1] = p0[-1] + 0.001; json.dump(c, open(cf_, "w"))
rc, o = guard(cf_, now); ok(rc == 1 and "differ from main" in o, "guard refuses a published hour that differs from main (e.g. a newer live copy that rewrote history)", o)
for wf, job in (("ci.yml", "rollback"), ("data.yml", "rollback")):
    rs = "\n".join(st.get("run", "") for st in W(wf)["jobs"][job]["steps"]); ok("publish_guard" in rs or "snapshot.sh" in rs, f"{wf} {job} runs the publish guard", rs[-300:])
ok("publish_guard.py" in open(os.path.join(ROOT, ".github/scripts/snapshot.sh")).read() and "publish_guard.py" in open(os.path.join(ROOT, ".github/scripts/rollback_data.sh")).read(), "every deploy (snapshot.sh) and rollback_data.sh run the publish guard")
# 8) handover after a code change runs the full suites
ok(pp.code_changed(["index.html", "data/market.json"]) and not pp.code_changed(["data/etf.json", "data/market.json"]), "code flag: any non-data file")
hv = "\n".join(st.get("run", "") for st in pub["jobs"]["gates"]["steps"] if "ci.yml" in st.get("run", ""))
ok("steps.path.outputs.code" in str([st.get("if") for st in pub["jobs"]["gates"]["steps"] if "ci.yml" in st.get("run", "")]) and "data_redeploy=false" in hv, "code change requests the full suites (data_redeploy=false)", hv)
# 9) 16 Oct starvation fix: the data path always deploys the snapshot itself; in-flight runs are never cancelled
pg = "\n".join(st.get("run", "") for st in pub["jobs"]["gates"]["steps"])
ok("tested_sha.sh" in pg and "last_good.sh" not in pg, "path compares HEAD with the TESTED code commit (pages-tested), not the last good deploy")
ok(not any("outputs.path == 'full'" in str(st.get("if", "")) for st in pub["jobs"]["gates"]["steps"]) and pub["jobs"]["deploy"]["if"] == "needs.gates.outputs.path == 'fast'", "no full-CI handover branch: every data push reaches the deploy job")
hv2 = [st for st in pub["jobs"]["gates"]["steps"] if "ci.yml" in st.get("run", "")]
ok(len(hv2) == 1 and "outputs.code == 'true'" in str(hv2[0].get("if")) and "data_redeploy=false" in hv2[0]["run"] and "busy" in hv2[0]["run"], "full CI requested only when code differs from the tested commit, and only if none is queued/running", hv2)
ok(all(W(f).get("concurrency", {}).get("cancel-in-progress") is False for f in ("ci.yml", "data.yml")), "workflow groups never cancel an in-flight run (cancel-in-progress false)")
ok(all(pp.select(c)[0] == "fast" for c in (["data/derivs.json"], ["data/etf.json"], ["index.html", "data/_runs.json"], [])), "every change set takes the deploying (fast) path")
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
