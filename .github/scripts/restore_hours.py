#!/usr/bin/env python3
"""One-off restore of published closed hours (31 Oct supervisor ruling): copy the WHOLE point from what LIVE serves into
data/derivs.json, so the vs-live publish guard (oi_usd exact) passes again. HARD ALLOWLIST: asset BTC, series oi_hourly,
timestamps 1791118800000 and 1791475200000 only; any other input refuses (exit 1). Empty input = no-op (exit 0, file untouched).
Each hour must exist in BOTH live and the current file and be a closed hour. Nothing else is touched (other assets, series,
points, daily bars, every other key); any field >1% off live refuses (safety stop): the script proves it by diffing before/after and refusing if anything else changed.
Usage: restore_hours.py "<ts,ts>" [derivs.json]   Env: LIVE_DERIVS (local live copy, tests), SITE_URL, NOW_MS (tests)."""
import json, os, sys, time, urllib.request
H = 3600000
ALLOW = {("BTC", "oi_hourly", 1791118800000), ("BTC", "oi_hourly", 1791475200000)}
ASSET, SERIES = "BTC", "oi_hourly"
MAXREL = 0.01
def die(m): print(f"::error title=restore_hours::{m}"); sys.exit(1)
def parse(raw):
    raw = (raw or "").strip()
    if not raw: return []
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) > 5: die(f"{len(parts)} timestamps given, at most 5 allowed")
    ts = []
    for p in parts:
        if not p.isdigit(): die(f"not an integer ms timestamp: {p!r}")
        t = int(p)
        if t % H: die(f"{t} is not aligned to an hour start")
        if (ASSET, SERIES, t) not in ALLOW: die(f"{t} is not on the allowlist (BTC oi_hourly 1791118800000, 1791475200000 only)")
        ts.append(t)
    if len(set(ts)) != len(ts): die("duplicate timestamps")
    return ts
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
    die("live derivs.json unreadable after 3 attempts; nothing restored")
def main():
    ts = parse(sys.argv[1] if len(sys.argv) > 1 else "")
    path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "derivs.json")
    if not ts: print("restore_hours: empty input, nothing to do"); return 0
    raw = open(path, encoding="utf-8").read(); cur = json.loads(raw); L = live()
    if os.environ.get("LIVE_OUT"):  # the exact live snapshot used, for the vs-live publish guard step before commit
        json.dump(L, open(os.environ["LIVE_OUT"], "w", encoding="utf-8"), separators=(",", ":"))
    now = int(os.environ["NOW_MS"]) if os.environ.get("NOW_MS") else int(time.time() * 1000); last_closed = (now // H) * H - H
    cp = (cur.get("assets", {}).get(ASSET, {}).get(SERIES) or {}).get("points") or []
    lp = {p[0]: p for p in (L.get("assets", {}).get(ASSET, {}).get(SERIES) or {}).get("points") or [] if isinstance(p, list) and p}
    idx = {p[0]: i for i, p in enumerate(cp) if isinstance(p, list) and p}
    for t in ts:
        if t not in idx or t not in lp: die(f"{ASSET} {SERIES} {t} not present in both live and the current file (current {t in idx}, live {t in lp})")
        if t > last_closed: die(f"{t} is not a closed hour")
        # safety stop: a restore is a small correction (OKX restatement), never a different value; >1% on any field refuses
        for i, (b, a) in enumerate(zip(cp[idx[t]][1:], lp[t][1:]), 1):
            if isinstance(a, (int, float)) and isinstance(b, (int, float)) and b and abs(a - b) / abs(b) > MAXREL:
                die(f"{t} field {i}: live {a} vs file {b} differs by {abs(a - b) / abs(b):.2%} (> {MAXREL:.0%} safety stop); nothing restored")
        if len(cp[idx[t]]) != len(lp[t]): die(f"{t}: live point shape {len(lp[t])} != file {len(cp[idx[t]])}")
    new = json.loads(raw); np_ = new["assets"][ASSET][SERIES]["points"]; changed = []
    for t in ts:
        before = np_[idx[t]]; after = list(lp[t])
        print(f"{ASSET} {SERIES} {t}: before {before} -> after (live) {after}{'  (already equal)' if before == after else ''}")
        if before != after: np_[idx[t]] = after; changed.append(t)
    # proof: every difference between before and after is one of the restored points
    diffs = []
    for a in set(cur["assets"]) | set(new["assets"]):
        A, B = cur["assets"].get(a, {}), new["assets"].get(a, {})
        for k in set(A) | set(B):
            if k == SERIES and a == ASSET:
                x, y = dict(A[k]), dict(B[k]); px, py = x.pop("points"), y.pop("points")
                if x != y or len(px) != len(py): diffs.append(f"{a}.{k} meta/length")
                diffs += [f"{a}.{k}[{p[0]}]" for p, q in zip(px, py) if p != q and p[0] not in changed]
            elif A.get(k) != B.get(k): diffs.append(f"{a}.{k}")
    if {k: v for k, v in cur.items() if k != "assets"} != {k: v for k, v in new.items() if k != "assets"}: diffs.append("top-level keys")
    if diffs: die(f"unexpected changes, nothing written: {diffs}")
    if not changed: print("restore_hours: all requested hours already equal live; file untouched"); return 0
    s = json.dumps(new, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    open(path + ".tmp", "w", encoding="utf-8").write(s); os.replace(path + ".tmp", path)
    print(f"restore_hours: diff summary: {len(changed)} point(s) changed, all in {ASSET} {SERIES}: {changed}; every other asset/series/point/key identical")
    return 0
if __name__ == "__main__":
    sys.exit(main())
