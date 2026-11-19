#!/usr/bin/env python3
"""Rebuild the small derivs fixtures used by tests/tkeep_hours.py (17 Nov: the restore_hours fixtures were removed with that dispatch input) (never read repo data/ at test time).
Source: git show 647d8af:data/derivs.json.
Run: python3 tests/fixtures/restore/make.py <647d8af.json>"""
import json, os, sys
H = 3600000; T1, T2 = 1791118800000, 1791475200000; D21 = 1792512000000
OUT = os.path.dirname(os.path.abspath(__file__))
a647 = json.load(open(sys.argv[1]))
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
w = lambda n, o: json.dump(o, open(os.path.join(OUT, n), "w"), separators=(",", ":"))
w("derivs-647d8af.json", cut(a647, {("BTC", "oi_hourly"): [T1, T2]}, "subset of 647d8af data/derivs.json (BTC+ETH oi_hourly/basis_hourly last 8 + restated hours, oi_daily last 3 + 21 Oct bar)"))
