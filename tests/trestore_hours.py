#!/usr/bin/env python3
"""31 Oct one-off restore (data.yml input restore_hours -> .github/scripts/restore_hours.py). Uses main's derivs.json as of 4f2fee1 frozen in
tests/fixtures/restore/derivs-4f2fee1.json (temp copies; a frozen copy so the 4 Oct hour never ages out of the 30-day window) and the saved live 21 Oct file (tests/fixtures/restore/live-21oct.json). Fixed clock NOW = 2026-10-31T16:00Z."""
import json, os, re, shutil, subprocess, sys, tempfile, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); NOW = 1793462400000
S = os.path.join(ROOT, ".github/scripts/restore_hours.py"); G = os.path.join(ROOT, ".github/scripts/publish_guard.py")
LIVE = os.path.join(ROOT, "tests/fixtures/restore/live-21oct.json"); MAIN = os.path.join(ROOT, "tests/fixtures/restore/derivs-4f2fee1.json")
T1, T2 = 1791118800000, 1791475200000; fails = []; T = tempfile.mkdtemp()
def ok(c, m, x=""):
    print(("ok   " if c else "FAIL ") + m + ("" if c else f" :: {x}"))
    if not c: fails.append(m)
def run(arg, live=LIVE, now=NOW):
    f = os.path.join(T, "d.json"); shutil.copy(MAIN, f)
    r = subprocess.run([sys.executable, S, arg, f], env=dict(os.environ, LIVE_DERIVS=live, NOW_MS=str(now)), capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr, open(f, encoding="utf-8").read()
def guard(f, ref):
    r = subprocess.run([sys.executable, G, f, LIVE, "--ref", ref], env=dict(os.environ, NOW_MS=str(NOW)), capture_output=True, text=True); return r.returncode, r.stdout
raw = open(MAIN, encoding="utf-8").read(); M = json.loads(raw); L = json.load(open(LIVE))
lp = {p[0]: p for p in L["assets"]["BTC"]["oi_hourly"]["points"]}; mp = {p[0]: p for p in M["assets"]["BTC"]["oi_hourly"]["points"]}
need = [t for t in (T1, T2) if mp.get(t) != lp.get(t)]
f0 = os.path.join(T, "m.json"); shutil.copy(MAIN, f0); g0 = guard(f0, "live")
ok(need == [] or (g0[0] == 1 and "differ from live" in g0[1]), "precondition: main's file differs from live at the 2 hours and the vs-live guard refuses it", g0)
rc, o, out = run(f"{T1},{T2}")
ok(rc == 0, "restore of the 2 allowlisted hours succeeds", o)
J = json.loads(out); rp = {p[0]: p for p in J["assets"]["BTC"]["oi_hourly"]["points"]}
ok(rp[T1] == lp[T1] and rp[T2] == lp[T2], "both points now equal live's WHOLE point", (rp[T1], rp[T2]))
exp = raw
for t in need: exp = exp.replace(json.dumps(mp[t], separators=(",", ":")), json.dumps(lp[t], separators=(",", ":")), 1)
ok(out == exp, "everything else byte-identical (file = main with exactly those 2 points substituted)")
ok(all(f"{t}: before" in o for t in (T1, T2)) and ("diff summary" in o or not need), "before/after printed per point + diff summary", o)
f1 = os.path.join(T, "d.json"); g1 = guard(f1, "live"); ok(g1[0] == 0, "restored file passes publish_guard vs live", g1[1])
g2 = subprocess.run([sys.executable, G, f1, MAIN], env=dict(os.environ, NOW_MS=str(NOW)), capture_output=True, text=True)
ok(g2.returncode == 1 and "differ from main" in g2.stdout, "control: vs-main guard on CI still sees exactly the restored hours as differing (USD exact, not weakened)", g2.stdout)
rc, o, out = run(""); ok(rc == 0 and out == raw and "nothing to do" in o, "empty input = no-op, file byte-identical", o)
rc, o, out = run("  "); ok(rc == 0 and out == raw, "blank input = no-op")
for arg, why in (("1791118800000,1791475200000,1791118800000", "duplicate"), (",".join(str(T1 + i * 3600000) for i in range(6)), "more than 5"),
                 ("1791118800001", "not hour-aligned"), ("1791118800000.0", "non-integer"), ("abc", "non-integer"), ("-1791118800000", "negative"),
                 ("1791122400000", "aligned but not on the allowlist"), (f"{T1},1791122400000", "one allowed + one not")):
    rc, o, out = run(arg); ok(rc == 1 and out == raw, f"refused ({why}): exit 1, file untouched", o)
L2 = json.loads(json.dumps(L)); L2["assets"]["BTC"]["oi_hourly"]["points"] = [p for p in L2["assets"]["BTC"]["oi_hourly"]["points"] if p[0] != T2]
fl = os.path.join(T, "l2.json"); json.dump(L2, open(fl, "w"))
rc, o, out = run(f"{T1},{T2}", live=fl); ok(rc == 1 and "not present in both" in o and out == raw, "refused: hour absent from live, nothing written", o)
rc, o, out = run(f"{T1}", now=T1 + 3600000 - 1); ok(rc == 1 and "not a closed hour" in o and out == raw, "refused: hour not closed at fetch time", o)
rc, o, out = run(f"{T1}", live=os.path.join(T, "missing.json")); ok(rc != 0 and out == raw, "refused: live unreadable, nothing written")
# >1% safety stop: a live value far from the file is never copied in
L3 = json.loads(json.dumps(L))
for p in L3["assets"]["BTC"]["oi_hourly"]["points"]:
    if p[0] == T1: p[2] = p[2] * 1.02
fl3 = os.path.join(T, "l3.json"); json.dump(L3, open(fl3, "w"))
rc, o, out = run(f"{T1},{T2}", live=fl3); ok(rc == 1 and "safety stop" in o and out == raw, "refused: live differs >1% from the file (safety stop), nothing written", o)
# LIVE_OUT: the exact live snapshot is saved for the guard step
lo = os.path.join(T, "lo.json"); f = os.path.join(T, "d.json"); shutil.copy(MAIN, f)
r = subprocess.run([sys.executable, S, f"{T1},{T2}", f], env=dict(os.environ, LIVE_DERIVS=LIVE, NOW_MS=str(NOW), LIVE_OUT=lo), capture_output=True, text=True)
ok(r.returncode == 0 and json.load(open(lo)) == L, "LIVE_OUT holds the live snapshot the restore used")
# keep-stored after: the next hourly fetch (fetch_derivs.keep_stored_hours) keeps both restored points even if OKX returns the restated values
sys.path.insert(0, os.path.join(ROOT, "scripts")); import fetch_derivs as fd
R = json.load(open(f))["assets"]["BTC"]["oi_hourly"]["points"]
fetched = [list(q) for q in R]; fetched = [[q[0], q[1] * 0.999, q[2] * 0.999] + q[3:] if q[0] in (T1, T2) else q for q in fetched] + [[R[-1][0] + 3600000] + R[-1][1:]]
K = {q[0]: q for q in fd.keep_stored_hours(fetched, R)}
ok(K[T1] == lp[T1] and K[T2] == lp[T2] and R[-1][0] + 3600000 in K, "keep-stored after: next fetch keeps both restored points, adds the new hour", (K.get(T1), K.get(T2)))
# workflow wiring: input is dispatch-only, step before the derivs fetch, empty = skipped, refused restore pushes nothing
W = yaml.safe_load(open(os.path.join(ROOT, ".github/workflows/data.yml"))); on = W.get("on", W.get(True))
inp = on["workflow_dispatch"]["inputs"]["restore_hours"]; ok(inp["type"] == "string" and inp.get("default", "") == "", "restore_hours: string input, default empty", inp)
ok([c["cron"] for c in on["schedule"]] == ["17 * * * *", "20 0 * * *", "0 21 * * 4"], "schedule unchanged")
st = W["jobs"]["refresh"]["steps"]; nm = [s.get("name", "") for s in st]
ir = [i for i, s in enumerate(st) if "restore_hours.py" in s.get("run", "")]; idv = [i for i, s in enumerate(st) if "fetch_derivs.py" in s.get("run", "")]
ok(len(ir) == 1 and idv and ir[0] < idv[0], "restore step runs once, before the derivs fetch")
r = st[ir[0]]; ok("workflow_dispatch" in r["if"] and "inputs.restore_hours != ''" in r["if"], "restore step only on dispatch with a non-empty input (scheduled runs skip it)", r["if"])
ok("${{" not in r["run"] and r["env"]["RESTORE_HOURS"] == "${{ inputs.restore_hours }}", "input reaches the script via env, never interpolated into the shell")
cm = [s for s in st if s.get("id") == "commit"][0]; ok("steps.restore.outcome != 'failure'" in cm["if"], "a refused restore commits and pushes nothing", cm["if"])
ig = [i for i, s in enumerate(st) if s.get("id") == "restore_guard"]; ic = [i for i, s in enumerate(st) if s.get("id") == "commit"]
ok(len(ig) == 1 and ic and ig[0] < ic[0] and st[ig[0]]["if"] == "steps.restore.outcome == 'success'" and "publish_guard.py data/derivs.json" in st[ig[0]]["run"] and "--ref live" in st[ig[0]]["run"], "restore runs: publish_guard vs live on data/derivs.json before commit", st[ig[0]] if ig else None)
ok("steps.restore_guard.outcome != 'failure'" in cm["if"], "a restore failing the vs-live guard commits nothing", cm["if"])
ok(r["env"].get("LIVE_OUT", "").endswith("restore-live-derivs.json") and "restore-live-derivs.json" in st[ig[0]]["run"], "guard checks the same live snapshot the restore used")
ok(sum("git push" in s.get("run", "") for s in st) == 1, "still ONE push step (deploy-key path)")
print(f"trestore_hours: {len(fails)} FAILS"); print(f"FAILS: {len(fails)}"); sys.exit(1 if fails else 0)
