#!/usr/bin/env python3
"""31 Oct: closed history is never rewritten by a refresh, and the publish guard tells a coin restatement from a rewrite.
fetch_derivs.py: oi_hourly / basis_hourly hours already stored are kept as stored (new hours only are filled);
oi_daily: a bar within 2 days of its close is replaced by the fresh fetch, older stored bars are kept (age alone decides).
publish_guard.py: oi_usd exact, oi_coin within 1e-4 relative, basis exact; messages name the reference (main or live).
Fixed clock: NOW = 2026-10-31T08:27Z (main 647d8af refresh). Uses main's committed data/derivs.json (read only, copied to a temp dir)."""
import copy, importlib.util, json, os, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); H = 3600_000; DAY = 24 * H
NOW = 1793442420000  # 2026-10-31T08:27:00Z
fails = []
def ok(c, m, x=""):
    print(("ok   " if c else "FAIL ") + m + ("" if c else f" :: {x}"))
    if not c: fails.append(m)
def mod(name, p):
    s = importlib.util.spec_from_file_location(name, os.path.join(ROOT, p)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
fd = mod("fetch_derivs", "scripts/fetch_derivs.py"); pg = mod("publish_guard", ".github/scripts/publish_guard.py")
fd.NOW_MS = NOW
MAIN = json.load(open(os.path.join(ROOT, "data/derivs.json")))
T = tempfile.mkdtemp(); fd.OUT = os.path.join(T, "derivs.json"); json.dump(MAIN, open(fd.OUT, "w"))
D21 = 1792512000000  # 21 Oct daily bar (OKX day starts 00:00 UTC+8 = 20 Oct 16:00Z)
REV_H = 1791118800000  # the BTC hour OKX restated on 31 Oct (coin .624 -> .483)

def fetched(a, key):
    """What the venue returns now: the stored series with restatements, plus new closed hours/days."""
    P = [list(p) for p in MAIN["assets"][a][key]["points"]]
    if key == "oi_hourly":
        P = [[p[0], p[1], p[2] * 1.00001] if p[0] == REV_H else p for p in P]
        P += [[P[-1][0] + H * i, P[-1][1] + i, P[-1][2] + i] for i in (1, 2)]
    elif key == "basis_hourly":
        P = [[p[0], p[1] + 5, p[2], p[3] + 0.01] if p[0] == P[-5][0] else p for p in P]
        P += [[P[-1][0] + H, P[-1][1], P[-1][2], P[-1][3]]]
    elif key == "oi_daily":
        P = [[p[0], p[1] * 1.02, p[2] * 1.02] if p[0] in (D21, P[-1][0]) else p for p in P]
    return P
def fake_chain(label, fns, attempts):
    a, key = label.split()[0], label.split()[1]
    if key == "funding": return MAIN["assets"][a]["funding"]["points"], {"source": MAIN["assets"][a]["funding"].get("source")}
    pts = fetched(a, key)
    if key == "oi_hourly": pts = [p for p in pts if p[0] + 2 * H <= NOW and p[0] < (NOW // H) * H]
    return pts, {"source": MAIN["assets"][a][key].get("source")}
fd.chain = fake_chain
fd.main()
OUT = json.load(open(fd.OUT))
for a in ("BTC", "ETH"):
    for key in ("oi_hourly", "basis_hourly"):
        old = {p[0]: p for p in MAIN["assets"][a][key]["points"]}; new = OUT["assets"][a][key]["points"]
        ok(all(old[p[0]] == p for p in new if p[0] in old) and set(old) <= {p[0] for p in new}, f"{a} {key}: every stored hour kept exactly as stored")
        ok(len(new) > len(old) and all(p[0] not in old for p in new[len(old):]), f"{a} {key}: new hours filled after the stored ones", (len(old), len(new)))
btc = {p[0]: p for p in OUT["assets"]["BTC"]["oi_hourly"]["points"]}
ok(btc[REV_H] == [REV_H, 2425427717.0, 28465.483], "revised old hourly point (BTC 1791118800000) kept as stored, not the restated fetch", btc.get(REV_H))
md = {p[0]: p for p in MAIN["assets"]["BTC"]["oi_daily"]["points"]}; od = {p[0]: p for p in OUT["assets"]["BTC"]["oi_daily"]["points"]}
last = max(md)
ok(NOW - (last + DAY) <= 2 * DAY and od[last] != md[last] and abs(od[last][1] - md[last][1] * 1.02) < 1, "oi_daily: bar within 2 days of its close restated -> replaced by the fresh fetch", (od[last], md[last]))
ok(NOW - (D21 + DAY) > 2 * DAY and od[D21] == md[D21], "oi_daily: main's 21 Oct bar (>2 days since close) stays as stored", (od.get(D21), md.get(D21)))
ok(fd.keep_old_days([[0, 1, 1]], [[0, 9, 9]], DAY + 2 * DAY) == [[0, 1, 1]] and fd.keep_old_days([[0, 1, 1]], [[0, 9, 9]], DAY + 2 * DAY + 1) == [[0, 9, 9]], "oi_daily boundary: exactly 2 days after close replaced, 2 days + 1ms kept")
ok(fd.keep_stored_hours([[1, 1, 1], [2, 2, 2]], [[1, 5, 5], [-9, 0, 0]]) == [[1, 5, 5], [2, 2, 2]], "hourly: stored kept, new filled, stored older than the window drop off")
# guard
def file(pts, k="oi_hourly"): return {"assets": {"BTC": {k: {"points": pts}}}}
ref = file([[REV_H, 2425427717.0, 28465.624]])
ok(pg.check(file([[REV_H, 2425427717.0, 28465.483]]), ref, NOW) == [], "guard: the real 31 Oct coin restatement (.624 -> .483, USD identical) passes")
ok(pg.check(file([[REV_H, 2425427717.0, 28465.624 * (1 + 0.99e-4)]]), ref, NOW) == [], "guard: coin within 1e-4 relative passes")
b = pg.check(file([[REV_H, 2425427717.0, 28465.624 * (1 + 1.01e-4)]]), ref, NOW, "live"); ok(b and "differ from live" in b[0], "guard: coin outside 1e-4 fails (and names live)", b)
b = pg.check(file([[REV_H, 2425427718.0, 28465.624]]), ref, NOW); ok(b and "differ from main" in b[0], "guard: USD change of 1 fails", b)
b = pg.check(file([[REV_H, 2425427717.0, None]]), ref, NOW); ok(b != [], "guard: coin turned non-numeric fails", b)
bp = [REV_H, 100.0, 99.0, 1.0101]
ok(pg.check(file([bp], "basis_hourly"), file([list(bp)], "basis_hourly"), NOW) == [] and pg.check(file([[REV_H, 100.0, 99.0, 1.01011]], "basis_hourly"), file([bp], "basis_hourly"), NOW) != [], "guard: basis compared exactly (1e-5 change fails)")
# CLI on the 31 Oct case, both refs
ff = lambda o, n: (json.dump(o, open(os.path.join(T, n), "w")), os.path.join(T, n))[1]
G = os.path.join(ROOT, ".github/scripts/publish_guard.py"); e = dict(os.environ, NOW_MS=str(NOW))
r = subprocess.run([sys.executable, G, ff(file([[REV_H, 2425427717.0, 28465.483]]), "p.json"), ff(ref, "l.json"), "--ref", "live"], env=e, capture_output=True, text=True)
ok(r.returncode == 0 and "vs live" in r.stdout, "CLI --ref live: 31 Oct case passes", r.stdout + r.stderr)
r = subprocess.run([sys.executable, G, ff(file([[REV_H, 2425427718.0, 28465.483]]), "p2.json"), ff(ref, "l.json")], env=e, capture_output=True, text=True)
ok(r.returncode == 1 and "vs main" in r.stdout and "differ from main" in r.stdout, "CLI default ref main: USD change refused, message says main", r.stdout)
snap = open(os.path.join(ROOT, ".github/scripts/snapshot.sh")).read()
ok('.live-derivs.json" --ref live' in snap and '.main-derivs.json"; rm' in snap, "snapshot.sh labels the live comparison live and the main one main")
print(f"tkeep_hours: {len(fails)} FAILS"); print(f"FAILS: {len(fails)}"); sys.exit(1 if fails else 0)
