#!/usr/bin/env python3
"""1 Nov: OKX-first chain, source-change refusal, 25% OI continuity, funding newest-window merge + 12h freshness, basis never-shrink,
one-off repair_derivs + publish_guard --allow-diff. FIXTURES ONLY (tests/fixtures/repair: trimmed main a0271f9 + live after the 21:50Z deploy),
no network (every venue function is mocked; any real GET fails the test), fixed clock NOW = 2026-10-31T22:35Z."""
import copy, json, os, shutil, subprocess, sys, tempfile, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(ROOT, "scripts"))
import fetch_derivs as fd
H = 3600000; NOW = 1793486100000; T19, T20 = 1793473200000, 1793476800000
FX = os.path.join(ROOT, "tests/fixtures/repair"); MAIN, LIVE = os.path.join(FX, "main-a0271f9.json"), os.path.join(FX, "live-2150z.json")
RP = os.path.join(ROOT, ".github/scripts/repair_derivs.py"); G = os.path.join(ROOT, ".github/scripts/publish_guard.py")
FUND_H = json.load(open(os.path.join(FX, "freshness.json")))["signal_cards"]["funding_h"]
LIST = f"BTC:oi_hourly:{T19},ETH:oi_hourly:{T19},BTC:basis_hourly:{T20},ETH:basis_hourly:{T20}"
fails = []; T = tempfile.mkdtemp(); M = json.load(open(MAIN)); L = json.load(open(LIVE))
def ok(c, m, x=""):
    print(("ok   " if c else "FAIL ") + m + ("" if c else f" :: {x}"))
    if not c: fails.append(m)
def boom(*a, **k): raise RuntimeError("network call in a fixture test")
fd.get = boom; fd.okx = boom; fd.NOW_MS = NOW; BN_FUNDING = fd.bn_funding
def okx_from(d, mut=None):
    """mock OKX = the stored OKX series (+ one new settled hour), so a normal run adds a plausible point"""
    def oi(a, period, days):
        if period == "1D": return [list(p) for p in d["assets"][a]["oi_daily"]["points"]], {"source": "OKX"}
        P = [list(p) for p in d["assets"][a]["oi_hourly"]["points"] if p[0] != T19]
        q = next(p for p in P if p[0] == T19 - H); P.append([T19, round(q[1] * 1.01, 0), round(q[2] * 1.01, 3)]); P.sort()
        if mut: P = mut(a, P)
        return P, {"source": "OKX", "instrument": "x"}
    return oi
def run_fetch(stored, oi=None, funding=None, basis=None, bn=None):
    f = os.path.join(T, "f.json"); json.dump(stored, open(f, "w")); fd.OUT = f
    fd.okx_oi = oi or okx_from(stored)
    fd.okx_funding = funding or (lambda a, days: ([list(p) for p in stored["assets"][a]["funding"]["points"]], {"source": "OKX", "interval_h": 8}))
    fd.okx_basis = basis or (lambda a, days: ([list(p) for p in stored["assets"][a]["basis_hourly"]["points"]], {"source": "OKX (perp close vs spot close)"}))
    bad = bn or (lambda *a: (_ for _ in ()).throw(RuntimeError("HTTP 451 (geo-blocked)")))
    fd.bn_oi = fd.bn_funding = fd.bn_basis = bad
    fd.bybit_oi = fd.bybit_funding = fd.deribit_funding = lambda *a: (_ for _ in ()).throw(RuntimeError("HTTP 403 (geo-blocked)"))
    import io, contextlib
    global ERR; ERR = io.StringIO()
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(ERR): fd.main()
    ERR = ERR.getvalue()
    return json.load(open(f))
def tried(o, s): return next(x["tried"] for x in o["attempts"] if x["series"] == s)
def pts(o, a, k): return {p[0]: p for p in o["assets"][a][k]["points"]}
# ---- chain order + source refusal ----
calls = []
o = run_fetch(M, bn=lambda *a: calls.append(a) or ([[NOW - 3 * H, 1.0, 1.0]], {"source": "Binance USD-M"}))
ok(not calls and tried(o, "BTC oi_hourly")[0]["source"] == "OKX", "OKX is tried first and wins; Binance never called when OKX answers", tried(o, "BTC oi_hourly"))
def okx_down(*a): raise RuntimeError("OKX down")
BN_OI = lambda a, p, d: ([[t, v * 2.9, c * 2.9] for t, v, c in M["assets"][a]["oi_hourly"]["points"]], {"source": "Binance USD-M"})
o = run_fetch(M, oi=okx_down, bn=BN_OI)
t = tried(o, "BTC oi_hourly")
ok(t[1]["source"] == "Binance" and not t[1]["ok"] and "source change refused" in t[1]["error"], "Binance fallback for an OKX series is refused (source change)", t)
ok(o["assets"]["BTC"]["oi_hourly"]["points"] == M["assets"]["BTC"]["oi_hourly"]["points"] and o["assets"]["BTC"]["oi_hourly"]["source"] == "OKX", "no allowed candidate -> stored oi_hourly kept unchanged")
o = run_fetch(M, funding=okx_down, basis=okx_down, bn=lambda *a: ([[NOW - 30 * H, 1e-4, 1, 1]], {"source": "Binance USD-M basis (perp vs index)"}))
ok(o["assets"]["ETH"]["funding"]["points"] == M["assets"]["ETH"]["funding"]["points"] and "source change refused" in json.dumps(tried(o, "ETH funding")), "funding: Binance fallback refused, stored OKX funding kept")
ok(o["assets"]["ETH"]["basis_hourly"]["points"] == M["assets"]["ETH"]["basis_hourly"]["points"] and o["assets"]["ETH"]["basis_hourly"]["source"].startswith("OKX"), "basis: Binance fallback refused, stored OKX basis kept")
ok(fd.venue("OKX (perp close vs spot close)") == "okx" and fd.venue("Binance USD-M basis (perp vs index)") == "binance" and fd.venue("Binance USD-M") == "binance", "venue names normalised")
S = copy.deepcopy(M); del S["assets"]["BTC"]["oi_hourly"]   # no stored series: any venue allowed (first run)
o = run_fetch(S, oi=okx_down, bn=lambda a, p, d: ([list(x) for x in M["assets"][a]["oi_hourly"]["points"]][:-3], {"source": "Binance USD-M"}))
ok(o["assets"]["BTC"]["oi_hourly"]["source"] == "Binance USD-M", "no stored series -> fallback allowed")
# ---- continuity ----
R = copy.deepcopy(M)
for a in ("BTC", "ETH"): R["assets"][a]["oi_hourly"]["points"] = [p for p in R["assets"][a]["oi_hourly"]["points"] if p[0] != T19]
o = run_fetch(R, oi=okx_from(R, lambda a, P: [p if p[0] != T19 else [p[0], p[1] * 2.9, p[2] * 2.9] for p in P]))
ok("continuity" in json.dumps(tried(o, "BTC oi_hourly")) and o["assets"]["BTC"]["oi_hourly"]["points"] == R["assets"]["BTC"]["oi_hourly"]["points"], "a 2.9x new OI hour refuses the series (stored kept, attempt failed)")
ok("::warning title=derivs series refused::BTC oi_hourly" in ERR and "continuity" in ERR, "refused OI series is visible in the run log (warning annotation + reason)", ERR)
ok(any(x["series"] == "BTC oi_hourly" and not x["tried"][-1]["ok"] and "continuity" in x["tried"][-1]["error"] for x in o["attempts"]) and o["assets"]["BTC"]["oi_hourly"].get("stale_copy") is True, "refused OI series is visible in data attempts (ok false + reason) and the stored series is marked stale_copy")
# the stale alarm fires on the refused (stale_copy) series: latest.oi_t stays at the stored tail, runs_log feeds go not-ok past the 5h limit, data_age.py fails naming it
import datetime as _dt
sys.path.insert(0, os.path.join(ROOT, "scripts")); sys.path.insert(0, os.path.join(ROOT, ".github/scripts"))
import runs_log, data_age
ref = o   # the refused run above
tail = R["assets"]["BTC"]["oi_hourly"]["points"][-1][0]
ok(ref["assets"]["BTC"]["oi_hourly"].get("stale_copy") is True and ref["assets"]["BTC"]["latest"]["oi_t"] == tail, "refused series: latest.oi_t stays at the stored tail (no fake freshness)", ref["assets"]["BTC"]["latest"])
iso = lambda ms: _dt.datetime.fromtimestamp(ms / 1000, _dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
def alarm(now_ms):
    fd = runs_log.feeds(ref, now_ms); lim = fd["BTC oi"]["lim_h"]
    d = {"last_run": iso(now_ms - 600000), "runs": [{"feeds": fd}], "market": {"updated": iso(now_ms - 3600000), "limit_h": 3},
         "macro": {}, "macro_checked": {"checked_at": iso(now_ms - 3600000), "limit_h": 7}}
    return data_age.check(d, data_age.P(iso(now_ms))), lim
bad, lim = alarm(tail + 2 * H)
ok(not any("BTC oi" in b for b in bad), f"refused series 2h after its tail: inside the {lim}h limit, alarm quiet (it stays quiet until the limit)", bad)
bad, lim = alarm(tail + int((lim + 1) * H))
ok(any(b.startswith("BTC oi") and "limit" in b for b in bad), "refused series past its limit: the stale alarm (data_age) fires and names BTC oi", bad)
o = run_fetch(R)
ok(tried(o, "BTC oi_hourly")[-1]["ok"] and len(o["assets"]["BTC"]["oi_hourly"]["points"]) == len(R["assets"]["BTC"]["oi_hourly"]["points"]) + 1, "a normal 1% move passes (OKX 19:00Z re-added)")
mid = [list(p) for p in M["assets"]["BTC"]["oi_hourly"]["points"]]; st = [p for p in mid if p[0] != T19]
bad = [p if p[0] != T19 else [T19, 7563709837.0, 97491.971] for p in mid]; good = [p if p[0] != T19 else [T19, 2650833139.0, 34196.974] for p in mid]
ok(fd.continuity_error(bad, st) and fd.continuity_error(good, st) is None, "continuity: Binance 19:00Z point refused, OKX-scale 19:00Z point accepted between stored neighbours")
# ---- funding ----
okf = [list(p) for p in M["assets"]["BTC"]["funding"]["points"]]
newest = max(p[0] for p in okf)
ok(NOW - newest <= FUND_H * H, f"freshness: fixture newest funding within funding_h={FUND_H}h of the fixed clock")
def fresh(o, a): return NOW - o["assets"][a]["latest"]["funding_t"] <= FUND_H * H
old_only = [list(p) for p in L["assets"]["BTC"]["funding"]["points"]]   # the Binance bug shape: ends 30 Sep
merged, err = fd.merge_funding(old_only, okf, NOW); ok(merged is None and "older than stored" in err, "a funding fetch returning only old data is refused", err)
o = run_fetch(M, funding=lambda a, d: ([list(p) for p in L["assets"][a]["funding"]["points"]], {"source": "OKX", "interval_h": 8}))
ok(o["assets"]["BTC"]["funding"]["points"] == okf and fresh(o, "BTC") and "older than stored" in json.dumps(tried(o, "BTC funding")), "old-only funding fetch keeps stored series; latest funding stays fresh (<=12h)")
ok(not (NOW - max(p[0] for p in old_only) <= FUND_H * H), "freshness check FAILS on the 30 Sep series (bug shape is detected as stale)")
nxt = [newest + 8 * H, 2e-4]; part = okf[-5:] + [nxt]
merged, err = fd.merge_funding(part, okf, NOW + 8 * H)
ok(err is None and merged[:-1] == okf and merged[-1] == nxt, "funding merge: stored older points kept, newer event added")
url = []; fd.get = lambda u, **k: url.append(u) or []
BN_FUNDING("BTC", 300); fd.get = boom
ok("endTime=" in url[0] and "startTime" not in url[0], "Binance funding asks for the NEWEST events (endTime, no startTime)", url)
# ---- basis never-shrink ----
o = run_fetch(M, basis=lambda a, d: ([list(p) for p in M["assets"][a]["basis_hourly"]["points"]][-20:], {"source": "OKX (perp close vs spot close)"}))
ok(o["assets"]["BTC"]["basis_hourly"]["points"] == M["assets"]["BTC"]["basis_hourly"]["points"], "basis: a shorter fetch does not cut the stored series")
o = run_fetch(M)
for a in ("BTC", "ETH"):
    A = o["assets"][a]; la = A["latest"]
    ok(la["oi_t"] == A["oi_hourly"]["points"][-1][0] and la["funding_t"] == A["funding"]["points"][-1][0] and la["basis_t"] == A["basis_hourly"]["points"][-1][0], f"{a} latest.* equal series tails")
# ---- repair_derivs ----
def rep(args, src=MAIN, live=LIVE, extra=None):
    f = os.path.join(T, "r.json"); shutil.copy(src, f) if isinstance(src, str) else json.dump(src, open(f, "w"))
    before = open(f).read()
    r = subprocess.run([sys.executable, RP] + args + [f], env=dict(os.environ, LIVE_DERIVS=live, **(extra or {})), capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr, before, open(f).read(), f
def sp_(args, live): r = subprocess.run([sys.executable] + args, env=dict(os.environ, LIVE_DERIVS=live, NOW_MS=str(NOW)), capture_output=True, text=True); return r.returncode, r.stdout + r.stderr
rc, o_, b, a_, f = rep([LIST]); J = json.loads(a_)
ok(rc == 0 and all(T19 not in pts(J, x, "oi_hourly") and T20 not in pts(J, x, "basis_hourly") for x in ("BTC", "ETH")), "repair removes exactly the 4 Binance points", o_)
E2 = json.loads(b)
for x in ("BTC", "ETH"):
    E2["assets"][x]["oi_hourly"]["points"] = [p for p in E2["assets"][x]["oi_hourly"]["points"] if p[0] != T19]
    E2["assets"][x]["basis_hourly"]["points"] = [p for p in E2["assets"][x]["basis_hourly"]["points"] if p[0] != T20]
ok(J == E2 and o_.count("before") == 4 and "diff summary" in o_, "everything else identical; before/after + diff summary printed")
rc2, o2, b2, a2, _ = rep([LIST], src=J); ok(rc2 == 0 and a2 == b2, "second repair is a no-op (already removed)", o2)
for arg, why in (("", "empty"), ("  ", "blank")):
    rc, o_, b, a_, _ = rep([arg]); ok(rc == 0 and a_ == b, f"{why} input = no-op, file untouched")
for arg, why in ((f"BTC:oi_hourly:{T19 - H}", "other hour"), (f"BTC:funding:{T19}", "other series"), (f"SOL:oi_hourly:{T19}", "other asset"),
                 (f"BTC:oi_hourly:{T19},BTC:oi_hourly:{T19}", "duplicate"), ("BTC:oi_hourly", "malformed"), (f"BTC:oi_hourly:{T19};rm -rf /", "injection text")):
    rc, o_, b, a_, _ = rep([arg]); ok(rc == 1 and a_ == b, f"refused ({why}): exit 1, file untouched", o_)
L2 = copy.deepcopy(L)
for x in ("BTC", "ETH"):
    for k in ("oi_hourly", "basis_hourly"): L2["assets"][x][k]["source"] = "OKX"   # live labelled OKX over the Binance points (state after the 22:35Z fetch)
fl = os.path.join(T, "l2.json"); json.dump(L2, open(fl, "w"))
rc, o_, b, a_, _ = rep([LIST], live=fl); J2 = json.loads(a_) if rc == 0 else {}
ok(rc == 0 and all(T19 not in pts(J2, x, "oi_hourly") and T20 not in pts(J2, x, "basis_hourly") for x in ("BTC", "ETH")), "live labelled OKX over the Binance points: the repair still removes exactly the 4 (no source-label stop)", o_)
rc, o_ = sp_([RP, "--verify", LIST, MAIN], fl); ok(rc == 1 and "still equals live's Binance point" in o_, "verify with an OKX label: a file still holding live's Binance points fails (identical to live)", o_)
L3 = copy.deepcopy(L)
for p in L3["assets"]["ETH"]["basis_hourly"]["points"]:
    if p[0] == T20: p[1] += 1
fl = os.path.join(T, "l3.json"); json.dump(L3, open(fl, "w"))
rc, o_, b, a_, _ = rep([LIST], live=fl); ok(rc == 1 and "safety stop" in o_ and a_ == b, "safety stop: file point != live point -> nothing written", o_)
M4 = copy.deepcopy(M); L4 = copy.deepcopy(L)
for D in (M4, L4):
    for p in D["assets"]["BTC"]["oi_hourly"]["points"]:
        if p[0] == T19: p[1], p[2] = 2650833139.0, 34196.974
fl = os.path.join(T, "l4.json"); json.dump(L4, open(fl, "w"))
rc, o_, b, a_, _ = rep([f"BTC:oi_hourly:{T19}"], src=M4, live=fl); ok(rc == 1 and "no >25% step" in o_ and a_ == b, "safety stop: an OI point with no step is never removed", o_)
lo = os.path.join(T, "lo.json"); rc, *_ = rep([LIST], extra={"LIVE_OUT": lo}); ok(rc == 0 and json.load(open(lo)) == L, "LIVE_OUT holds the live snapshot the repair used")
# verify + guard, end to end: repair -> OKX fetch (mock re-adds OKX-scale 19:00 / 20:00) -> verify -> guard vs live with the exemption
_, _, _, a_, f = rep([LIST]); Rj = json.loads(a_)
def oi_back(a, period, days):
    if period == "1D": return [list(p) for p in M["assets"][a]["oi_daily"]["points"]], {"source": "OKX"}
    P = {p[0]: list(p) for p in M["assets"][a]["oi_hourly"]["points"]}; q = P[T19 - H]; P[T19] = [T19, round(q[1] * 0.999, 0), round(q[2] * 0.999, 3)]
    return [P[t] for t in sorted(P)], {"source": "OKX"}
def basis_back(a, d):
    P = {p[0]: list(p) for p in M["assets"][a]["basis_hourly"]["points"]}; q = P[T20 - H]; P[T20] = [T20, q[1], q[2], q[3]]
    return [P[t] for t in sorted(P)], {"source": "OKX (perp close vs spot close)"}
o = run_fetch(Rj, oi=oi_back, basis=basis_back); fo = os.path.join(T, "after.json"); json.dump(o, open(fo, "w"))
def sp(args): r = subprocess.run([sys.executable] + args, env=dict(os.environ, LIVE_DERIVS=LIVE, NOW_MS=str(NOW)), capture_output=True, text=True); return r.returncode, r.stdout + r.stderr
rc, o_ = sp([RP, "--verify", LIST, fo]); ok(rc == 0 and o_.count("re-added") == 4, "verify: all 4 hours re-added from OKX and continuous", o_)
ok(o["assets"]["BTC"]["oi_hourly"]["points"][-1][0] >= T19 and pts(o, "BTC", "oi_hourly")[T19][2] < 40000, "19:00Z BTC OI is OKX scale (~34k coin), not 97k")
rc, o_ = sp([RP, "--verify", LIST, f]); ok(rc == 1 and "not re-added" in o_, "verify fails when the fetch did not re-add an hour (commit blocked)")
# OKX down at the dispatch: repair removed 4 points, nothing refills them -> the fetch keeps the repaired file, --verify FAILS (workflow then skips the commit)
od = run_fetch(Rj, oi=okx_down, funding=okx_down, basis=okx_down); fd_ = os.path.join(T, "okxdown.json"); json.dump(od, open(fd_, "w"))
ok(T19 not in pts(od, "BTC", "oi_hourly") and T20 not in pts(od, "ETH", "basis_hourly") and "OKX down" in json.dumps(tried(od, "BTC oi_hourly")), "OKX down after the repair: the 4 hours are NOT refilled (Binance refused, no other source)")
rc, o_ = sp([RP, "--verify", LIST, fd_]); ok(rc == 1 and "was not re-added" in o_, "OKX down at dispatch: --verify exits 1, so the commit is skipped and live keeps what it serves", o_)
rc, o_ = sp([G, fd_, LIVE, "--ref", "live", "--allow-diff", LIST]); ok(rc == 0, "OKX-down file itself would pass the guard (only --verify blocks it: documents why verify is required)", o_)
rc, o_ = sp([G, fo, LIVE, "--ref", "live", "--allow-diff", LIST]); ok(rc == 0, "guard vs live passes with exactly the 4 exempted hours", o_)
rc, o_ = sp([G, fo, LIVE, "--ref", "live"]); ok(rc == 1 and o_.count("differ from live") == 4, "without the exemption the same file is refused (4 series)", o_)
o5 = copy.deepcopy(o); o5["assets"]["BTC"]["oi_hourly"]["points"][-6][1] += 1; f5 = os.path.join(T, "o5.json"); json.dump(o5, open(f5, "w"))
rc, o_ = sp([G, f5, LIVE, "--ref", "live", "--allow-diff", LIST]); ok(rc == 1 and "BTC oi_hourly: 1 hour" in o_, "with the exemption, any OTHER changed hour is still refused", o_)
o6 = copy.deepcopy(o); o6["assets"]["ETH"]["basis_hourly"]["points"][-10][3] += 0.001; json.dump(o6, open(f5, "w"))
rc, o_ = sp([G, f5, LIVE, "--ref", "live", "--allow-diff", LIST]); ok(rc == 1, "with the exemption, another basis hour change is still refused")
rc, o_ = sp([G, fo, LIVE, "--ref", "live", "--allow-diff", f"BTC:oi_hourly:{T19 - H}"]); ok(rc == 2 and "allowlist" in o_, "--allow-diff off the allowlist exits 2")
rc, o_ = sp([G, fo, MAIN, "--allow-diff", LIST]); ok(rc == 2, "--allow-diff with --ref main exits 2 (live only)")
rc, o_ = sp([G, fo, LIVE, "--ref", "live", "--allow-diff", ""]); ok(rc == 1, "empty --allow-diff exempts nothing")
# ---- workflow wiring ----
W = yaml.safe_load(open(os.path.join(ROOT, ".github/workflows/data.yml"))); on = W.get("on", W.get(True))
ok(on["workflow_dispatch"]["inputs"]["repair_derivs"]["default"] == "", "data.yml: repair_derivs input, default empty")
st = {s.get("id"): s for s in W["jobs"]["refresh"]["steps"] if s.get("id")}; names = [s.get("name", "") for s in W["jobs"]["refresh"]["steps"]]
ok("inputs.repair_derivs" not in st["repair"]["run"] and st["repair"]["env"]["REPAIR_DERIVS"] == "${{ inputs.repair_derivs }}" and "workflow_dispatch" in st["repair"]["if"], "repair step: input via env var only, dispatch only")
ok(names.index(st["repair"]["name"]) < next(i for i, n in enumerate(names) if n.startswith("Derivatives OI")), "repair runs before the fetch")
ok("steps.repair.outcome != 'failure'" in st["commit"]["if"] and "steps.repair_guard.outcome != 'failure'" in st["commit"]["if"], "commit skipped if repair or its guard fails")
ok("--verify" in st["repair_guard"]["run"] and "--allow-diff" in st["repair_guard"]["run"], "repair guard: verify + vs-live guard with the exemption")
snap = next(s for s in W["jobs"]["deploy"]["steps"] if "snapshot.sh" in str(s.get("run", "")))
ok("inputs.repair_derivs" in snap["env"]["PUBLISH_ALLOW_DIFF"] and "workflow_dispatch" in snap["env"]["PUBLISH_ALLOW_DIFF"], "deploy snapshot passes the exemption only on a repair dispatch")
ok('${PUBLISH_ALLOW_DIFF:+--allow-diff "$PUBLISH_ALLOW_DIFF"}' in open(os.path.join(ROOT, ".github/scripts/snapshot.sh")).read(), "snapshot.sh: exemption only when PUBLISH_ALLOW_DIFF is set")
print(f"FAILS: {len(fails)}"); sys.exit(1 if fails else 0)
