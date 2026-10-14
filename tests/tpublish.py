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
                      (["data/derivs.json", "data/market.json"], None, "fast"), (["data/market.json", "data/macro.json", "data/_runs.json"], None, "fast"), (["data/market.json", "data/etf.json"], None, "full"), (["data/calendar.json"], None, "full"), (["data/derivs.json", "index.html"], None, "full"), (["index.html"], None, "full"),
                      (["data/etf.json"], None, "full"), ([".github/workflows/ci.yml", "data/_runs.json"], None, "full"), (["qa/card-presence.js"], None, "full")):
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
pub, ci, dv = W("publish-derivs.yml"), W("ci.yml"), W("derivs.yml")
ok(pub["concurrency"]["group"] == "publish-derivs" and pub["concurrency"]["group"] != str(ci["concurrency"]["group"]), "fast path has its own concurrency group", pub["concurrency"])
ok(pub["concurrency"]["cancel-in-progress"] is False, "a running fast publish is never cancelled")
gate = "\n".join(st.get("run", "") for st in pub["jobs"]["gates"]["steps"])
need = ["qa/fixture-consistency.js", "tests/tclosed_hours.py", "qa/stale-derivs2.js", "qa/stale-captions.js", "qa/card-presence.js", "qa/oicap-label.js", "qa/caption-sweep.js"]
ok(all(n in gate for n in need), "fast gates include all 7 required checks", [n for n in need if n not in gate])
ok("tests/run-all.sh" not in gate, "fast gates do not run the full node suite")
ok(pub["jobs"]["deploy"]["needs"] == "gates" and pub["jobs"]["smoke"]["needs"] == "deploy" and pub["jobs"]["rollback"]["needs"] == "smoke", "gates -> deploy -> smoke -> rollback")
dep = "\n".join(st.get("run", "") for st in pub["jobs"]["deploy"]["steps"]); cid = "\n".join(st.get("run", "") for st in ci["jobs"]["deploy"]["steps"])
ok("newest_data.sh" in dep and "newest_data.sh" in cid, "both deploy paths take newest derivs from main HEAD and run the no-regress check")
ds = pub["jobs"]["deploy"]["steps"]; iN = [i for i, st in enumerate(ds) if "newest_data.sh" in st.get("run", "")]; iD = [i for i, st in enumerate(ds) if "deploy-pages" in str(st.get("uses", ""))]
cs_ = ci["jobs"]["deploy"]["steps"]; jN = [i for i, st in enumerate(cs_) if "newest_data.sh" in st.get("run", "")]; jD = [i for i, st in enumerate(cs_) if "deploy-pages" in str(st.get("uses", ""))]
ok(iN and iD and iN[0] < iD[0] and jN and jD and jN[0] < jD[0], "no-regress runs before deploy-pages in both paths", (iN, iD, jN, jD))
ok("_runs.json" in dep and "minutes_to_deploy" in dep, "publish timing logged into _runs.json")
sm = "\n".join(st.get("run", "") for st in pub["jobs"]["smoke"]["steps"]); cs = "\n".join(st.get("run", "") for st in ci["jobs"]["smoke"]["steps"])
ok("no_regress.py after" in sm and "no_regress.py after" in cs, "both smoke jobs fail if live went backwards")
dvr = "\n".join(st.get("run", "") for st in dv["jobs"]["refresh"]["steps"])
ok("publish-derivs.yml" in dvr and "ci.yml" not in dvr, "derivs.yml dispatches the fast path, not the full CI")
# 4) last good deploy pick: 'null null' (no successful run yet) and junk are ignored; newest real one wins
A1, A2 = "a" * 40, "b" * 40
ok(pp.pick_good(["null null", f"2026-10-14T18:00:00Z {A1}"]) == A1, "pick: 'null null' from a workflow with no good run is ignored (was picked by sort before)")
ok(pp.pick_good([f"2026-10-14T18:00:00Z {A1}", f"2026-10-14T19:00:00Z {A2}"]) == A2, "pick: newest good deploy wins")
ok(pp.pick_good(["", "null null"]) == "", "pick: none -> empty (caller takes the FULL path)")
ok(pp.pick_good(["2026-10-14T19:00:00Z HEAD"]) == "", "pick: non-sha ignored")
lg = open(os.path.join(ROOT, ".github/scripts/last_good.sh")).read()
ok('select(.name=="smoke")' in lg and "success" in lg, "a fast run counts as a good deploy only when its smoke job succeeded (handover runs deployed nothing)")
ok(all("last_good.sh" in "\n".join(st.get("run", "") for st in pub["jobs"][j]["steps"]) for j in ("gates", "rollback")), "path selection and rollback both use last_good.sh")
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
ok("publish-derivs.yml" in dd and "gh workflow run ci.yml" not in dd, "data.yml dispatches the fast path (it hands over to full CI itself)")
ok("market.json" in open(os.path.join(ROOT, ".github/scripts/newest_data.sh")).read(), "newest data at deploy time includes market/macro")
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
