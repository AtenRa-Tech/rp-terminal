#!/usr/bin/env python3
"""One-off repair (1 Nov supervisor ruling) of the 31 Oct 21:50Z Binance points in data/derivs.json.
HARD ALLOWLIST (shared with publish_guard.ALLOW_DIFF): BTC/ETH oi_hourly 1793473200000 (19:00Z), BTC/ETH basis_hourly 1793476800000 (20:00Z).
Input "ASSET:series:t,..." (any pair off the allowlist, malformed, duplicate or >4 refuses, exit 1). Empty = no-op (exit 0, file untouched).
Repair mode (runs BEFORE fetch_derivs): each listed point is REMOVED (no typed values: the OKX-first fetch in the same run re-adds the hour
from OKX, since it is inside the 30-day window and no longer stored). Safety stops, any one refuses with nothing written:
  - the point must be in the file AND identical to what LIVE serves there, and live's series source must be Binance (it is the Binance point);
  - oi_hourly: the point must break continuity (>25% USD or coin vs the previous stored hour), i.e. it really is the 2.9x step.
Proof: before/after diff; the only difference allowed is the removal of exactly the listed points (every other asset/series/point/key identical).
--verify mode (after the fetch, before the commit): every listed hour must be back, from an OKX series, different from live's Binance point,
and oi_hourly within 25% of both neighbours. Env: LIVE_DERIVS (local live copy), LIVE_OUT (save the live snapshot used), SITE_URL."""
import json, os, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from publish_guard import ALLOW_DIFF, same
MAXJ = 0.25
def die(m): print(f"::error title=repair_derivs::{m}"); sys.exit(1)
def parse(raw):
    parts = [p.strip() for p in (raw or "").split(",") if p.strip()]
    if len(parts) > len(ALLOW_DIFF): die(f"{len(parts)} items given, at most {len(ALLOW_DIFF)}")
    out = []
    for p in parts:
        x = p.split(":")
        if len(x) != 3 or not x[2].isdigit() or (x[0], x[1], int(x[2])) not in ALLOW_DIFF: die(f"{p!r} is not on the allowlist {sorted(ALLOW_DIFF)}")
        out.append((x[0], x[1], int(x[2])))
    if len(set(out)) != len(out): die("duplicate items")
    return out
def live():
    if os.environ.get("LIVE_DERIVS"): return json.load(open(os.environ["LIVE_DERIVS"], encoding="utf-8"))
    url = os.environ.get("SITE_URL", "https://atenra-tech.github.io/rp-terminal/") + f"data/derivs.json?v={int(time.time())}"
    for i in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r: j = json.loads(r.read())
            j["assets"]; return j
        except Exception as e:
            print(f"live derivs.json unreadable (attempt {i + 1}/3): {e}")
            if i < 2: time.sleep(10 * (i + 1))
    die("live derivs.json unreadable after 3 attempts; nothing repaired")
def ser(d, a, k): return ((d.get("assets") or {}).get(a) or {}).get(k) or {}
def venue(s): return str(s or "").strip().lower().split(" ")[0]
def jump(p, q): return max(abs(p[c] - q[c]) / abs(q[c]) for c in (1, 2) if isinstance(p[c], (int, float)) and isinstance(q[c], (int, float)) and q[c])
def main():
    av = sys.argv[1:]; verify = "--verify" in av; av = [x for x in av if x != "--verify"]
    items = parse(av[0] if av else "")
    path = av[1] if len(av) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "derivs.json")
    if not items: print("repair_derivs: empty input, nothing to do"); return 0
    raw = open(path, encoding="utf-8").read(); cur = json.loads(raw)
    if verify:
        L = json.load(open(os.environ["LIVE_DERIVS"])) if os.environ.get("LIVE_DERIVS") else live()
        for a, k, t in items:
            S = ser(cur, a, k); P = S.get("points") or []; i = next((j for j, p in enumerate(P) if p[0] == t), None)
            if i is None: die(f"verify: {a} {k} {t} was not re-added by the fetch")
            if venue(S.get("source")) != "okx": die(f"verify: {a} {k} source is {S.get('source')!r}, not OKX")
            lp = {p[0]: p for p in ser(L, a, k).get("points") or []}
            if t in lp and same(k, P[i], lp[t]): die(f"verify: {a} {k} {t} still equals live's Binance point {lp[t]}")
            if k == "oi_hourly":
                for q in [P[j] for j in (i - 1, i + 1) if 0 <= j < len(P)]:
                    if jump(P[i], q) > MAXJ: die(f"verify: {a} {k} {t} {P[i]} jumps {jump(P[i], q):.0%} vs {q}")
            print(f"verify: {a} {k} {t} re-added from {S.get('source')}: {P[i]}")
        print("repair_derivs --verify: all repaired hours are back from OKX and continuous"); return 0
    L = live()
    if os.environ.get("LIVE_OUT"): json.dump(L, open(os.environ["LIVE_OUT"], "w", encoding="utf-8"), separators=(",", ":"))
    drop = set()
    for a, k, t in items:
        P = ser(cur, a, k).get("points") or []; idx = {p[0]: j for j, p in enumerate(P)}
        LS = ser(L, a, k); lp = {p[0]: p for p in LS.get("points") or []}
        if t not in idx: print(f"{a} {k} {t}: not in the file (already removed), nothing to do"); continue
        if t not in lp or not same(k, P[idx[t]], lp[t]): die(f"{a} {k} {t}: file point {P[idx[t]]} is not the point live serves ({lp.get(t)}); safety stop, nothing written")
        if venue(LS.get("source")) != "binance": die(f"{a} {k}: live source {LS.get('source')!r} is not Binance; safety stop, nothing written")
        if k == "oi_hourly":
            j = idx[t]
            if j == 0 or jump(P[j], P[j - 1]) <= MAXJ: die(f"{a} {k} {t}: no >25% step vs the previous hour; safety stop, nothing written")
        drop.add((a, k, t))
    new = json.loads(raw)
    for a, k, t in sorted(drop):
        P = new["assets"][a][k]["points"]; p = next(q for q in P if q[0] == t); P.remove(p)
        print(f"{a} {k} {t}: before {p} -> after (removed; the OKX fetch re-adds this hour)")
    # proof: new == cur minus exactly the dropped points
    exp = json.loads(raw)
    for a, k, t in drop: exp["assets"][a][k]["points"] = [q for q in exp["assets"][a][k]["points"] if q[0] != t]
    if new != exp: die("unexpected changes, nothing written")
    diffs = [f"{a}.{k}" for a in cur["assets"] for k in set(cur["assets"][a]) | set(new["assets"][a]) if cur["assets"][a].get(k) != new["assets"][a].get(k)]
    if not set(diffs) <= {f"{a}.{k}" for a, k, _ in drop} or {x: y for x, y in cur.items() if x != "assets"} != {x: y for x, y in new.items() if x != "assets"}: die(f"unexpected changes: {diffs}")
    if not drop: print("repair_derivs: nothing to remove; file untouched"); return 0
    s = json.dumps(new, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    open(path + ".tmp", "w", encoding="utf-8").write(s); os.replace(path + ".tmp", path)
    print(f"repair_derivs: diff summary: {len(drop)} point(s) removed {sorted(drop)}; series lengths -1 each; every other asset/series/point/key identical")
    return 0
if __name__ == "__main__":
    sys.exit(main())
