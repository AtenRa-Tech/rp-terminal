#!/usr/bin/env python3
"""OI/basis store only CLOSED hours (and daily only CLOSED days).
Fails if the last stored hour/day has not closed yet. Pure unit test of scripts/fetch_derivs.closed_bars
plus a check against data/derivs.json when present."""
import importlib.util, json, os, sys, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("fd", os.path.join(ROOT, "scripts", "fetch_derivs.py"))
fd = importlib.util.module_from_spec(spec); spec.loader.exec_module(fd)
F = []
def ok(c, n, x=None):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)

H, D = fd.HOUR, fd.DAY
# Fixed "now": 14:30:00 UTC on an arbitrary day
now = 1_700_000_000_000 // H * H + 30 * 60_000  # xx:30 inside an hour
forming_h = now // H * H          # start of the forming hour
closed_h  = forming_h - H         # last closed hour
earlier_h = closed_h - H

pts = [[earlier_h, 1, 1], [closed_h, 2, 2], [forming_h, 3, 3], [forming_h + H, 4, 4]]
got = fd.closed_bars(pts, H, now)
ok(got == [[earlier_h, 1, 1], [closed_h, 2, 2]],
   "closed_bars(1h): drops the forming hour and any future hour", got)
ok(got[-1][0] + H <= now, "last stored hour has closed (t + 1h <= now)", (got[-1][0], now))

# Exactly on the hour boundary: the hour that just ended is closed; the new one is forming
edge = forming_h  # now == start of a new hour
pts2 = [[closed_h, 1, 1], [forming_h, 2, 2]]
got2 = fd.closed_bars(pts2, H, edge)
ok(got2 == [[closed_h, 1, 1]], "at exact hour boundary the new hour is still forming and is dropped", got2)

# Daily
forming_d = now // D * D
closed_d = forming_d - D
pts_d = [[closed_d - D, 1, 1], [closed_d, 2, 2], [forming_d, 3, 3]]
got_d = fd.closed_bars(pts_d, D, now)
ok(got_d == [[closed_d - D, 1, 1], [closed_d, 2, 2]], "closed_bars(1d): drops the forming day", got_d)
ok(got_d[-1][0] + D <= now, "last stored day has closed", (got_d[-1][0], now))

ok(fd.closed_bars([], H, now) == [], "empty input stays empty")
ok(fd.closed_bars([[forming_h, 1]], H, now) == [], "only-forming input becomes empty (nothing invented)")

# Against data/derivs.json when present: last oi_hourly / basis_hourly bar must be closed
path = os.path.join(ROOT, "data", "derivs.json")
if os.path.exists(path):
    now_ms = int(time.time() * 1000)
    cut = (now_ms // H) * H
    R = json.load(open(path))
    for a, A in (R.get("assets") or {}).items():
        for key in ("oi_hourly", "basis_hourly"):
            pts = (A.get(key) or {}).get("points") or []
            if not pts:
                continue
            last = int(pts[-1][0])
            ok(last < cut, f"data/derivs.json {a} {key}: last stored hour has closed (t={last} < cut={cut})",
               f"last={last} age_ms={now_ms - last}")
        pts = (A.get("oi_daily") or {}).get("points") or []
        if pts:
            last = int(pts[-1][0]); cut_d = (now_ms // D) * D
            ok(last < cut_d, f"data/derivs.json {a} oi_daily: last stored day has closed", last)

print("FAILS:", len(F), F); sys.exit(1 if F else 0)
