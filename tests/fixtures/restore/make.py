#!/usr/bin/env python3
"""Rebuild the small derivs fixtures used by tests/tkeep_hours.py and tests/trestore_hours.py (never read repo data/ at test time).
Sources: git show 647d8af:data/derivs.json, git show 4f2fee1:data/derivs.json, live 21 Oct derivs.json (ci-review/post32/live-derivs.json).
Run: python3 tests/fixtures/restore/make.py <647d8af.json> <4f2fee1.json> <live.json>"""
import json, os, sys
H = 3600000; T1, T2 = 1791118800000, 1791475200000; D21 = 1792512000000
OUT = os.path.dirname(os.path.abspath(__file__))
a647, a4f, live = (json.load(open(p)) for p in sys.argv[1:4])
def common_equal(m, l, a, k, n=3):
    L = {p[0]: p for p in l["assets"][a][k]["points"]}
    return [p[0] for p in m["assets"][a][k]["points"] if p[0] in L and L[p[0]] == p][-n:]
def cut(src, keep, note):
    out = {"_fixture": note, "updated": src["updated"], "assets": {}}
    for a, A in src["assets"].items():
        B = {}
        for k, v in A.items():
            if k == "latest": B[k] = v; continue
            P = v["points"]; want = set(keep.get((a, k), []))
            if k in ("oi_hourly", "basis_hourly"): want |= {p[0] for p in P[-8:]}
            elif k == "oi_daily": want |= {p[0] for p in P[-3:]} | {D21}
            else: want |= {p[0] for p in P[-3:]}
            pts = [p for p in P if p[0] in want]
            B[k] = dict(v, points=pts, last=pts[-1][0] if pts else v.get("last"))
        out["assets"][a] = B
    return out
eq = {(a, k): common_equal(a4f, live, a, k) for a in ("BTC", "ETH") for k in ("oi_hourly", "basis_hourly")}
keep = {(a, k): list(v) for (a, k), v in eq.items()}; keep[("BTC", "oi_hourly")] += [T1, T2]
w = lambda n, o: json.dump(o, open(os.path.join(OUT, n), "w"), separators=(",", ":"))
w("derivs-647d8af.json", cut(a647, {("BTC", "oi_hourly"): [T1, T2]}, "subset of 647d8af data/derivs.json (BTC+ETH oi_hourly/basis_hourly last 8 + restated hours, oi_daily last 3 + 21 Oct bar)"))
w("derivs-4f2fee1.json", cut(a4f, keep, "subset of 4f2fee1 data/derivs.json (last 8 hourly, 2 restore hours, 3 hours equal to live per series)"))
lv = {"_fixture": "subset of live derivs.json served since 21 Oct (restore hours + hours equal to main)", "updated": live["updated"], "assets": {}}
for a in ("BTC", "ETH"):
    lv["assets"][a] = {k: dict(live["assets"][a][k], points=[p for p in live["assets"][a][k]["points"] if p[0] in set(keep[(a, k)])]) for k in ("oi_hourly", "basis_hourly")}
w("live-21oct.json", lv)
