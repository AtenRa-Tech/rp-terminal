#!/usr/bin/env python3
"""1 Nov: OKX-first chain, source-change refusal, 25% OI continuity, funding newest-window merge + 12h freshness, basis never-shrink,
publish guard vs live (17 Nov: the one-off repair_derivs / restore_hours dispatch inputs and --allow-diff were removed). FIXTURES ONLY (tests/fixtures/repair: trimmed main a0271f9 + live after the 21:50Z deploy),
no network (every venue function is mocked; any real GET fails the test), fixed clock NOW = 2026-10-31T22:35Z."""
import copy, json, os, shutil, subprocess, sys, tempfile, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(ROOT, "scripts"))
import fetch_derivs as fd
H = 3600000; NOW = 1793486100000; T19, T20 = 1793473200000, 1793476800000
FX = os.path.join(ROOT, "tests/fixtures/repair"); MAIN, LIVE = os.path.join(FX, "main-a0271f9.json"), os.path.join(FX, "live-2150z.json")
G = os.path.join(ROOT, ".github/scripts/publish_guard.py")
FUND_H = json.load(open(os.path.join(FX, "freshness.json")))["signal_cards"]["funding_h"]
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
# ---- publish guard vs live (no exemptions exist any more) ----
def sp(args): r = subprocess.run([sys.executable] + args, env=dict(os.environ, NOW_MS=str(NOW)), capture_output=True, text=True); return r.returncode, r.stdout + r.stderr
o = run_fetch(M); fo = os.path.join(T, "after.json"); json.dump(o, open(fo, "w"))
rc, o_ = sp([G, fo, MAIN, "--ref", "live"]); ok(rc == 0, "guard vs reference passes when every overlapping hour is unchanged", o_)
o5 = copy.deepcopy(o); o5["assets"]["BTC"]["oi_hourly"]["points"][-6][1] += 1; f5 = os.path.join(T, "o5.json"); json.dump(o5, open(f5, "w"))
rc, o_ = sp([G, f5, MAIN, "--ref", "live"]); ok(rc == 1 and "BTC oi_hourly: 1 hour" in o_, "a changed stored OI hour is refused", o_)
t6 = o5["assets"]["BTC"]["oi_hourly"]["points"][-6][0]
rc, o_ = sp([G, f5, MAIN, "--ref", "live", "--allow-diff", f"BTC:oi_hourly:{t6}"]); ok(rc == 1 and "allow" not in open(G).read().lower(), "no exemption flag exists any more: the changed hour is still refused", o_)
ok(not os.path.exists(os.path.join(ROOT, ".github/scripts/repair_derivs.py")) and not os.path.exists(os.path.join(ROOT, ".github/scripts/restore_hours.py")), "one-off repair/restore scripts removed")
# ---- workflow wiring ----
W = yaml.safe_load(open(os.path.join(ROOT, ".github/workflows/data.yml"))); on = W.get("on", W.get(True))
ok(set(on["workflow_dispatch"]["inputs"]) == {"full"}, "data.yml: the only dispatch input is 'full' (restore_hours / repair_derivs removed)", on["workflow_dispatch"]["inputs"])
raw = open(os.path.join(ROOT, ".github/workflows/data.yml")).read() + open(os.path.join(ROOT, ".github/scripts/snapshot.sh")).read()
ok(not any(x in raw for x in ("restore_hours", "repair_derivs", "REPAIR_DERIVS", "RESTORE_HOURS", "PUBLISH_ALLOW_DIFF", "allow-diff")), "no repair/restore wiring left in data.yml or snapshot.sh")
print(f"FAILS: {len(fails)}"); sys.exit(1 if fails else 0)
