#!/usr/bin/env python3
"""tnorollback.py (narrow no-rollback ruling, supervisor 12 Nov). The CI-and-deploy smoke skips its rollback ONLY when every failing smoke check is
a freshness check AND each stale data file is byte-identical to what live served before the deploy. Fixtures only (no network, no data/ writes):
  (a) ETF stale and unchanged since before the deploy        -> no rollback
  (b) a feed that went backwards (changed AND older), stale  -> rollback   (ETF and derivs)
  (c) a non-freshness smoke failure (alone or with (a))      -> rollback
plus fail-closed cases (crash / no summary / incomplete / stale file with no pre-deploy copy), the smoke-side classifier and summary writer
(tests/tsmoke.js freshFile/classify/writeOut, run through node), no_regress.py `files`, and the ci.yml wiring."""
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
    # ci.yml wiring
    ci = open(os.path.join(ROOT, ".github/workflows/ci.yml")).read()
    ok("no_regress.py files live-before-files" in ci and "live-before-files/" in ci, "ci.yml deploy saves pre-deploy live files into the live-before artifact")
    ok('SMOKE_OUT="$out" node tests/tsmoke.js' in ci and 'stale_only.py "$out" live-before-files' in ci, "ci.yml smoke step runs stale_only.py only after a failed smoke")
    ok("if: failure() && needs.smoke.result == 'failure' && github.event_name != 'merge_group'" in ci, "ci.yml rollback condition unchanged (any failed smoke step still rolls back)")
finally:
    shutil.rmtree(T, ignore_errors=True)
print(f"FAILS: {len(fails)}"); sys.exit(1 if fails else 0)
