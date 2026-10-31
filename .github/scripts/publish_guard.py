#!/usr/bin/env python3
"""Guard on the EXACT derivs.json about to be published (full deploy, fast publish, both rollbacks). Refuse (exit 1) if:
  - the file is test data: top-level "_test_only", or any point/object carrying a carried-forward mark ("cf")
  - any oi_hourly / basis_hourly point is for an hour not yet closed (t > start of the current UTC hour - 1h)
  - for hours the reference copy (main, or what LIVE serves) already has, a published point differs from it:
      basis_hourly: every field exactly; oi_hourly: t and oi_usd (index 1) exactly, oi_coin (index 2) within COIN_RTOL relative
      (31 Oct: OKX restates the coin figure in the 4th-5th significant digit with identical USD; that is not a history rewrite)
Usage: publish_guard.py <derivs.json> [ref_derivs.json] [--ref main|live]   (default ref name "main"; main copy: git show
FETCH_HEAD:data/derivs.json). The ref name is only used in messages. Env NOW_MS (tests)."""
import json, os, sys, time
H = 3600000
COIN_RTOL = 1e-4
def cf_marks(x, path="$"):
    out = []
    if isinstance(x, dict):
        if x.get("cf") is True or x.get("_test_only") is True: out.append(path)
        for k, v in x.items(): out += cf_marks(v, f"{path}.{k}")
    elif isinstance(x, list):
        if any(e == "cf" for e in x): out.append(path)
        for i, v in enumerate(x): out += cf_marks(v, f"{path}[{i}]")
    return out
def same(k, p, q):
    if k != "oi_hourly" or len(p) != len(q) or len(p) < 3:
        return p == q
    if p[:2] != q[:2] or p[3:] != q[3:]:
        return False
    a, b = p[2], q[2]
    if a == b:
        return True
    if not all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in (a, b)):
        return False
    return abs(a - b) <= COIN_RTOL * max(abs(a), abs(b))
def check(pub, main=None, now=None, ref="main"):
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
                diff = [p[0] for p in P if isinstance(p, list) and p and p[0] in M and not same(k, p, M[p[0]])]
                if diff: bad.append(f"{a} {k}: {len(diff)} hour(s) differ from {ref} (first {diff[0]}: {ref} {M[diff[0]]} vs published {[p for p in P if isinstance(p, list) and p and p[0] == diff[0]][0]})")
    return bad
if __name__ == "__main__":
    av = sys.argv[1:]; ref = "main"
    if "--ref" in av:
        i = av.index("--ref"); ref = av[i + 1] if i + 1 < len(av) else ""; del av[i:i + 2]
        if ref not in ("main", "live"): print("::error title=Publish guard::--ref must be main or live"); sys.exit(2)
    pub = json.load(open(av[0])); main = json.load(open(av[1])) if len(av) > 1 and os.path.exists(av[1]) else None
    if len(av) > 1 and main is None: print(f"::error title=Publish guard::{ref} derivs.json missing"); sys.exit(1)
    bad = check(pub, main, int(os.environ["NOW_MS"]) if os.environ.get("NOW_MS") else None, ref)
    if bad: print(f"::error title=Publish guard refused derivs.json (vs {ref})::" + "; ".join(bad)); sys.exit(1)
    print(f"publish guard OK (vs {ref}): no test marks, only closed hours" + (f", overlapping hours match {ref} (oi_usd + basis exact, oi_coin within {COIN_RTOL:g} rel)" if main is not None else ""))
