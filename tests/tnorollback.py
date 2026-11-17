#!/usr/bin/env python3
"""tnorollback.py (narrow no-rollback ruling, supervisor 12 Nov). The CI-and-deploy smoke skips its rollback ONLY when every failing smoke check is
a freshness check AND each stale data file is byte-identical to what live served before the deploy. Fixtures only (no network, no data/ writes):
  (a) ETF stale and unchanged since before the deploy        -> no rollback
  (b) a feed that went backwards (changed AND older), stale  -> rollback   (ETF and derivs)
  (c) a non-freshness smoke failure (alone or with (a))      -> rollback
plus fail-closed cases (crash / no summary / incomplete / stale file with no pre-deploy copy), the smoke-side classifier and summary writer
(tests/tsmoke.js freshFile/classify/writeOut, run through node), no_regress.py `files`, and both workflows (17 Nov ruling): the REAL ci.yml and
data.yml smoke-step scripts run against fixtures (data.yml: stale unchanged ETF -> no rollback; changed/backwards -> rollback; other failure -> rollback),
and pages-tested moves after a stale-only pass ONLY when every non-freshness check passed (any other failure leaves the tag where it is)."""
import json, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SO = os.path.join(ROOT, ".github/scripts/stale_only.py"); NR = os.path.join(ROOT, ".github/scripts/no_regress.py")
FROZEN = os.path.join(HERE, "fixtures/frozen/data")
fails = []
def ok(c, n, x=None):
    print(("PASS " if c else "FAIL ") + n + ("" if c or x is None else " :: " + str(x)[:600]))
    if not c: fails.append(n)
T = tempfile.mkdtemp(prefix="tnorb-")
def raw(name): return open(os.path.join(FROZEN, name), "rb").read()
ETF = raw("etf.json"); DER = raw("derivs.json")
def etf_back():  # the same feed, one day BACKWARDS (older last complete day) and still stale
    E = json.loads(ETF)
    for d in E["datasets"].values(): d["days"] = [x for x in d["days"] if x["date"] < d["last_date"]]; d["last_date"] = max(x["date"] for x in d["days"] if not x.get("pending"))
    E["last_date"] = min(d["last_date"] for d in E["datasets"].values()); return json.dumps(E, separators=(",", ":")).encode()
def der_back():
    D = json.loads(DER); D["updated"] = "2026-10-01T00:00:00Z"; return json.dumps(D, separators=(",", ":")).encode()
def smoke(case, fails_names, files):
    """run tests/tsmoke.js's own writeOut (SMOKE_OUT) with these failing check names and served files -> the dir CI hands to stale_only.py"""
    d = os.path.join(T, case, "smoke"); os.makedirs(d, exist_ok=True); src = os.path.join(T, case, "served"); os.makedirs(src, exist_ok=True)
    for n, b in files.items(): open(os.path.join(src, n + ".json"), "wb").write(b)
    js = ("const fs=require('fs'),path=require('path'),m=require(process.argv[1]);const src=process.argv[2],RAW={};"
          "for(const f of fs.readdirSync(src))RAW[f.replace(/\\.json$/,'')]=fs.readFileSync(path.join(src,f));m.writeOut(JSON.parse(process.argv[3]),RAW)")
    r = subprocess.run(["node", "-e", js, os.path.join(HERE, "tsmoke.js"), src, json.dumps(fails_names)], env={**os.environ, "SMOKE_OUT": d}, capture_output=True, text=True)
    if r.returncode: print(r.stdout, r.stderr)
    return d
def before(case, files):
    """pre-deploy live copies through no_regress.py `files` (LIVE_FILES_DIR stands in for the live site)"""
    live = os.path.join(T, case, "live"); os.makedirs(live, exist_ok=True)
    for n, b in files.items(): open(os.path.join(live, n), "wb").write(b)
    out = os.path.join(T, case, "before")
    r = subprocess.run([sys.executable, NR, "files", out], env={**os.environ, "LIVE_FILES_DIR": live}, capture_output=True, text=True)
    if r.returncode: print(r.stdout, r.stderr)
    return out
def decide(sd, bd):
    r = subprocess.run([sys.executable, SO, sd, bd], capture_output=True, text=True); return r.returncode, r.stdout
ETFN = "etf.json last day within 2 US business days"; DERN = "derivs.json under 36h"
ALL = {"derivs.json": DER, "market.json": raw("market.json"), "etf.json": ETF, "macro.json": raw("macro.json"), "calendar.json": raw("calendar.json")}
served = {k[:-5]: v for k, v in ALL.items()}
try:
    # (a) ETF stale, file byte-identical to pre-deploy live -> no rollback
    rc, out = decide(smoke("a", [ETFN], served), before("a", ALL))
    ok(rc == 0 and "NO ROLLBACK" in out and "etf.json" in out, "(a) ETF stale and unchanged since before the deploy -> no rollback", out)
    # (a2) several freshness fails (ETF + macro H.10 + Fed daily), all unchanged -> no rollback
    rc, out = decide(smoke("a2", [ETFN, "macro DEXUSEU within 14 days (H.10 weekly release)", "macro DGS10 within 2 US business days (app limit, card not stale)"], served), before("a2", ALL))
    ok(rc == 0, "(a) ETF + macro freshness fails, both files unchanged -> no rollback", out)
    # (b) ETF went backwards: changed AND older -> rollback
    rc, out = decide(smoke("b", [ETFN], {**served, "etf": etf_back()}), before("b", ALL))
    ok(rc == 1 and "etf.json: stale AND changed" in out, "(b) ETF went backwards (changed and older) -> rollback", out)
    # (b2) derivs went backwards -> rollback (even though ETF is unchanged stale too)
    rc, out = decide(smoke("b2", [ETFN, DERN], {**served, "derivs": der_back()}), before("b2", ALL))
    ok(rc == 1 and "derivs.json: stale AND changed" in out, "(b) derivs went backwards while ETF stale-unchanged -> rollback", out)
    # (c) a non-freshness failure -> rollback, alone and next to an unchanged stale ETF
    rc, out = decide(smoke("c", ["tab studio renders"], served), before("c", ALL))
    ok(rc == 1 and "not a freshness check: tab studio renders" in out, "(c) non-freshness smoke failure (tab renders) -> rollback", out)
    rc, out = decide(smoke("c2", [ETFN, "no page errors or app console errors"], served), before("c2", ALL))
    ok(rc == 1 and "not a freshness check" in out, "(c) unchanged stale ETF + a page error -> rollback", out)
    rc, out = decide(smoke("c3", ["data/etf.json served"], {k: v for k, v in served.items() if k != "etf"}), before("c3", ALL))
    ok(rc == 1, "(c) etf.json not served (not a freshness check) -> rollback", out)
    # fail closed
    e = os.path.join(T, "empty"); os.makedirs(e)
    rc, out = decide(e, before("x1", ALL)); ok(rc == 1 and "no smoke summary" in out, "crash (no summary.json) -> rollback", out)
    sd = smoke("x2", [ETFN], served); S = json.load(open(os.path.join(sd, "summary.json"))); S["complete"] = False; json.dump(S, open(os.path.join(sd, "summary.json"), "w"))
    rc, out = decide(sd, before("x2", ALL)); ok(rc == 1, "incomplete smoke summary -> rollback", out)
    rc, out = decide(smoke("x3", [], served), before("x3", ALL)); ok(rc == 1, "smoke exited non-zero with no failing check recorded -> rollback", out)
    rc, out = decide(smoke("x4", [ETFN], served), before("x4", {k: v for k, v in ALL.items() if k != "etf.json"}))
    ok(rc == 1 and "no copy of what live served before" in out, "stale ETF with no pre-deploy copy (live fetch failed) -> rollback", out)
    # no_regress.py files: exact bytes, unreadable/non-JSON live file left out
    bd = before("f", {**ALL, "macro.json": b"<html>503</html>"})
    ok(open(os.path.join(bd, "etf.json"), "rb").read() == ETF and not os.path.exists(os.path.join(bd, "macro.json")), "no_regress.py files saves exact bytes; a non-JSON live answer is not saved")
    # classifier (tests/tsmoke.js): every data-age check is fresh with its file; nothing else is
    names = [DERN, "market.json under 36h", ETFN, "macro DEXUSEU within 14 days (H.10 weekly release)", "macro WALCL within 12 days", "macro M2SL within 100 days of month start",
             "macro DGS10 within 2 US business days (app limit, card not stale)", "india.json and data/india.json serve no content (no 2xx; 5xx retried)", "data/etf.json served",
             "data/etf.json is JSON", "tab today renders", "no page errors or app console errors", "bizDays counts weekdays after the date through today (Fri->Mon=1, Mon->Wed=2)",
             "usBizDays: Mon 5 Oct->Wed 7 Oct = 2; Columbus Day 12 Oct and Veterans Day 11 Nov skipped"]
    r = subprocess.run(["node", "-e", "console.log('@@'+JSON.stringify(require(process.argv[1]).classify(JSON.parse(process.argv[2]))))", os.path.join(HERE, "tsmoke.js"), json.dumps(names)], capture_output=True, text=True)
    C = json.loads(r.stdout.split("@@", 1)[1]) if "@@" in r.stdout else []
    want = ["derivs.json", "market.json", "etf.json", "macro.json", "macro.json", "macro.json", "macro.json"] + [None] * 7
    ok([c["file"] for c in C] == want and [c["fresh"] for c in C] == [w is not None for w in want], "tsmoke classify: 7 data-age checks fresh (with file), 7 others not", C)
    src = open(os.path.join(HERE, "tsmoke.js")).read()
    ok("SMOKE_OUT" in src and "writeOut(F,RAW)" in src, "tsmoke writes the summary only after a completed run (writeOut before the final exit)")
    # ---- workflow wiring: ONE helper (.github/scripts/smoke_or_stale.sh) in ci.yml AND data.yml (17 Nov ruling) ----
    import yaml
    CI = yaml.safe_load(open(os.path.join(ROOT, ".github/workflows/ci.yml"))); DY = yaml.safe_load(open(os.path.join(ROOT, ".github/workflows/data.yml")))
    def runs(job): return "\n".join(str(st.get("run", "")) for st in job["steps"])
    for nm, W in (("ci.yml", CI), ("data.yml", DY)):
        ok("no_regress.py files live-before-files" in runs(W["jobs"]["deploy"]) and any("live-before-files/" in str((st.get("with") or {}).get("path", "")) for st in W["jobs"]["deploy"]["steps"]),
           f"{nm} deploy saves pre-deploy live files (live-before-files/) into the live-before artifact")
        ok("smoke_or_stale.sh \"$SITE_URL\" live-before-files" in runs(W["jobs"]["smoke"]) and "node tests/tsmoke.js" not in runs(W["jobs"]["smoke"]), f"{nm} smoke runs tsmoke only through smoke_or_stale.sh")
        ok(str(W["jobs"]["rollback"]["if"]).startswith("failure() && needs.smoke.result == 'failure'"), f"{nm} rollback condition unchanged (any failed smoke step rolls back)", W["jobs"]["rollback"]["if"])
        ok(not any(st.get("continue-on-error") for st in W["jobs"]["smoke"]["steps"]), f"{nm} smoke job: no continue-on-error step (every failure fails the job)")
    # Behavioural: execute the REAL smoke-step scripts from both workflows in a scratch dir (.github + tests symlinked), with a stand-in tsmoke
    # (TSMOKE) that prints FAIL lines and writes the summary through tests/tsmoke.js's own writeOut.
    FAKE = os.path.join(T, "fake-smoke.js")
    open(FAKE, "w").write("const m=require(%s),fs=require('fs'),path=require('path');const F=JSON.parse(process.env.FAKE_FAILS||'[]'),src=process.env.FAKE_SERVED,RAW={};"
        "for(const f of fs.readdirSync(src))RAW[f.replace(/\\.json$/,'')]=fs.readFileSync(path.join(src,f));F.forEach(n=>console.log('FAIL '+n));m.writeOut(F,RAW);"
        "console.log('SMOKE FAILS:',F.length);process.exit(F.length?1:0)" % json.dumps(os.path.join(HERE, "tsmoke.js")))
    def step_run(W, job, pred):
        return next(str(st["run"]) for st in W["jobs"][job]["steps"] if pred(st))
    def scratch(case, smoke_fails, served_over=None, before_over=None, live_now=None):
        d = os.path.join(T, "wf-" + case); os.makedirs(d)
        os.symlink(os.path.join(ROOT, ".github"), os.path.join(d, ".github")); os.symlink(HERE, os.path.join(d, "tests"))
        bf = os.path.join(d, "live-before-files"); os.makedirs(bf)
        for n, b in {**ALL, **(before_over or {})}.items(): open(os.path.join(bf, n), "wb").write(b)
        sv = os.path.join(d, "served"); os.makedirs(sv)
        for n, b in {**served, **(served_over or {})}.items(): open(os.path.join(sv, n + ".json"), "wb").write(b)
        # live-before.json snapshot for `no_regress.py after` (LIVE_* = what live serves now)
        lv = os.path.join(d, "live-now"); os.makedirs(lv)
        for n, b in {**ALL, "_runs.json": raw("_runs.json"), **(live_now or {})}.items(): open(os.path.join(lv, n), "wb").write(b)
        env = {**os.environ, "TSMOKE": FAKE, "FAKE_FAILS": json.dumps(smoke_fails), "FAKE_SERVED": sv, "RUNNER_TEMP": d, "SITE_URL": "http://127.0.0.1:9/",
               "LIVE_DERIVS": os.path.join(lv, "derivs.json"), "LIVE_RUNS": os.path.join(lv, "_runs.json"), "LIVE_MARKET": os.path.join(lv, "market.json"), "LIVE_MACRO": os.path.join(lv, "macro.json")}
        env.pop("GITHUB_STEP_SUMMARY", None); env.pop("GITHUB_OUTPUT", None)
        json.dump({k: json.loads(raw(f)).get(fld) for k, (f, fld) in {"updated": ("derivs.json", "updated"), "last_run": ("_runs.json", "last_run"),
                   "market_updated": ("market.json", "updated"), "macro_updated": ("macro.json", "updated")}.items()}, open(os.path.join(d, "live-before.json"), "w"))
        return d, env
    def bash(script, d, env):
        r = subprocess.run(["bash", "-e", "-c", script], cwd=d, env=env, capture_output=True, text=True); return r.returncode, r.stdout + r.stderr
    # data.yml smoke step (no_regress after -> smoke_or_stale.sh -> card presence). Card presence is replaced by a stand-in we control (CARD=0/1);
    # every other line runs exactly as in data.yml.
    DSTEP = step_run(DY, "smoke", lambda st: "smoke_or_stale.sh" in str(st.get("run", "")))
    ok('node qa/card-presence.js "$SITE_URL"' in DSTEP and DSTEP.index("no_regress.py after") < DSTEP.index("smoke_or_stale.sh") < DSTEP.index("card-presence"),
       "data.yml smoke step order: never-backwards check, smoke (no-rollback rule), card presence", DSTEP)
    def data_step(case, card_ok=True, **kw):
        d, env = scratch("d" + case, **kw); return bash(DSTEP.replace('node qa/card-presence.js "$SITE_URL"', "true" if card_ok else "echo 'FAIL card presence'; false"), d, env)
    rc, out = data_step("1", smoke_fails=[ETFN]); ok(rc == 0 and "NO ROLLBACK" in out, "data.yml: stale ETF unchanged since before the publish -> step passes, no rollback", out[-600:])
    rc, out = data_step("2", smoke_fails=[ETFN], served_over={"etf": etf_back()}); ok(rc == 1 and "stale AND changed" in out, "data.yml: stale ETF changed/backwards -> step fails, rollback", out[-600:])
    rc, out = data_step("3", smoke_fails=[ETFN, "tab news renders"]); ok(rc == 1 and "not a freshness check" in out, "data.yml: other smoke failure (tab) -> rollback", out[-600:])
    rc, out = data_step("4", card_ok=False, smoke_fails=[ETFN]); ok(rc == 1 and "FAIL card presence" in out, "data.yml: stale-only smoke but card presence fails -> rollback", out[-600:])
    rc, out = data_step("5", smoke_fails=[ETFN], live_now={"derivs.json": der_back()}); ok(rc == 1 and "went backwards" in out and "NO ROLLBACK" not in out, "data.yml: live derivs went backwards -> rollback (before smoke runs)", out[-600:])
    rc, out = data_step("6", smoke_fails=[]); ok(rc == 0, "data.yml: clean smoke -> passes", out[-400:])
    # ci.yml smoke job: run the real smoke step, then model GitHub step semantics for the pages-tested promote step (if: success() && ...):
    # it runs only if NO earlier step failed (no continue-on-error anywhere). Ruling: after a stale-only pass the tag moves ONLY if every
    # non-freshness check passed; any other failure leaves the tag where it is (and the job fails -> rollback).
    steps = CI["jobs"]["smoke"]["steps"]; names = [st.get("name", st.get("uses", "")) for st in steps]
    pi = next(i for i, st in enumerate(steps) if "pages-tested" in str(st.get("name", "")) and "Promote" in str(st.get("name", "")))
    si = next(i for i, st in enumerate(steps) if "smoke_or_stale.sh" in str(st.get("run", "")))
    ok(str(steps[pi].get("if", "")).replace(" ", "").startswith("success()&&"), "ci.yml promote step gated on success() (every earlier step passed)", steps[pi].get("if"))
    checks = [i for i, st in enumerate(steps[:pi]) if i != si and "run" in st and not str(st.get("if", "")).startswith("always()") and ("live site" in str(st.get("name", "")) or "backwards" in str(st.get("name", "")))]
    ok(len(checks) >= 8 and si < pi, "ci.yml: the non-freshness live checks (export, pulse, OI label, card presence, lint, stale gate, axis, range, backwards) all run before promote", [names[i] for i in checks])
    def tag_moves(smoke_rc, failing):  # failing = indexes of other steps that fail
        outcomes = {i: "success" for i in range(pi)}; outcomes[si] = "success" if smoke_rc == 0 else "failure"
        for i in failing: outcomes[i] = "failure"
        return all(v == "success" for v in outcomes.values()), any(v == "failure" for v in outcomes.values())
    SSTEP = str(steps[si]["run"])
    def ci_smoke(case, **kw):
        d, env = scratch("c" + case, **kw); return bash(SSTEP, d, env)
    rc, out = ci_smoke("1", smoke_fails=[ETFN]); mv, rb = tag_moves(rc, [])
    ok(rc == 0 and mv and not rb, "ci.yml: stale-only (ETF unchanged) and every other check passes -> no rollback, pages-tested moves", out[-400:])
    for i in checks:
        mv, rb = tag_moves(rc, [i]); ok(not mv and rb, f"ci.yml: stale-only smoke but '{names[i][:60]}' fails -> pages-tested stays, rollback")
    rc, out = ci_smoke("2", smoke_fails=[ETFN, "no page errors or app console errors"]); mv, rb = tag_moves(rc, [])
    ok(rc == 1 and not mv and rb, "ci.yml: stale ETF + a page error in smoke -> pages-tested stays, rollback", out[-400:])
    rc, out = ci_smoke("3", smoke_fails=[ETFN], served_over={"etf": etf_back()}); mv, rb = tag_moves(rc, [])
    ok(rc == 1 and not mv and rb, "ci.yml: stale ETF changed/backwards -> pages-tested stays, rollback", out[-400:])
    ok(os.path.exists(os.path.join(T, "wf-c1", "gates", "smoke.log")) and "NO ROLLBACK" in open(os.path.join(T, "wf-c1", "gates", "smoke.log")).read(), "ci.yml: decision logged to the gates smoke.log")
finally:
    shutil.rmtree(T, ignore_errors=True)
print(f"FAILS: {len(fails)}"); sys.exit(1 if fails else 0)
