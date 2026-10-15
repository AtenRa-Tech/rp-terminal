#!/usr/bin/env python3
"""Guard on the EXACT derivs.json about to be published (full deploy, fast publish, both rollbacks). Refuse (exit 1) if:
  - the file is test data: top-level "_test_only", or any point/object carrying a carried-forward mark ("cf")
  - any oi_hourly / basis_hourly point is for an hour not yet closed (t > start of the current UTC hour - 1h)
  - for hours main already has, a published oi_hourly / basis_hourly point differs from main's exactly
Usage: publish_guard.py <derivs.json> [main_derivs.json]   (main copy: git show FETCH_HEAD:data/derivs.json). Env NOW_MS (tests)."""
import json, os, sys, time
H = 3600000
def cf_marks(x, path="$"):
    out = []
    if isinstance(x, dict):
        if x.get("cf") is True or x.get("_test_only") is True: out.append(path)
        for k, v in x.items(): out += cf_marks(v, f"{path}.{k}")
    elif isinstance(x, list):
        if any(e == "cf" for e in x): out.append(path)
        for i, v in enumerate(x): out += cf_marks(v, f"{path}[{i}]")
    return out
def check(pub, main=None, now=None):
    now = now if now is not None else int(time.time() * 1000); last_closed = (now // H) * H - H; bad = []
    if pub.get("_test_only"): bad.append("file is stamped _test_only")
    m = cf_marks(pub)
    if m: bad.append(f"carried-forward / test marks at {len(m)} place(s), e.g. {m[0]}")
    for a, A in (pub.get("assets") or {}).items():
        for k in ("oi_hourly", "basis_hourly"):
            P = ((A or {}).get(k) or {}).get("points") or []
            op = [p for p in P if isinstance(p, list) and p and isinstance(p[0], (int, float)) and p[0] > last_closed]
            if op: bad.append(f"{a} {k}: {len(op)} point(s) for an hour not yet closed (first {op[0][0]}, last closed hour starts {last_closed})")
            if main is not None:
                M = {p[0]: p for p in ((((main.get("assets") or {}).get(a) or {}).get(k) or {}).get("points") or []) if isinstance(p, list) and p}
                diff = [p[0] for p in P if isinstance(p, list) and p and p[0] in M and p != M[p[0]]]
                if diff: bad.append(f"{a} {k}: {len(diff)} hour(s) differ from main (first {diff[0]})")
    return bad
if __name__ == "__main__":
    pub = json.load(open(sys.argv[1])); main = json.load(open(sys.argv[2])) if len(sys.argv) > 2 and os.path.exists(sys.argv[2]) else None
    if len(sys.argv) > 2 and main is None: print("::error title=Publish guard::main derivs.json missing"); sys.exit(1)
    bad = check(pub, main, int(os.environ["NOW_MS"]) if os.environ.get("NOW_MS") else None)
    if bad: print("::error title=Publish guard refused derivs.json::" + "; ".join(bad)); sys.exit(1)
    print("publish guard OK: no test marks, only closed hours, overlapping hours identical to main")
