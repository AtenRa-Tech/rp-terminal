#!/usr/bin/env python3
"""Narrow no-rollback ruling (supervisor, 12 Nov). After a FAILED live smoke (tests/tsmoke.js run with SMOKE_OUT=<smoke_dir>):
  stale_only.py <smoke_dir> <before_dir>
exit 0 = skip the rollback: the smoke run completed, EVERY failing check is a data-age (freshness) check, and EACH stale data file is byte-identical
         to what live served before this deploy (<before_dir>, saved by `no_regress.py files`): the deploy did not make anything worse, the data just
         has not been refreshed yet.
exit 1 = roll back: any other failure, no/partial smoke summary (crash), a stale file with no pre-deploy copy, or a stale file whose bytes changed
         (for example data that went backwards). Fails closed on anything unreadable."""
import json, os, sys

def decide(smoke_dir, before_dir):
    try:
        S = json.load(open(os.path.join(smoke_dir, "summary.json")))
    except Exception as e:
        return False, [f"no smoke summary ({e}): smoke did not complete"]
    fails = S.get("fails")
    if S.get("complete") is not True or not isinstance(fails, list):
        return False, ["smoke summary is incomplete"]
    if not fails:
        return False, ["smoke failed with no failing check recorded (crash or exit error)"]
    why, files = [], []
    for f in fails:
        if not (isinstance(f, dict) and f.get("fresh") is True and f.get("file")):
            why.append(f"not a freshness check: {f.get('name') if isinstance(f, dict) else f}")
        elif f["file"] not in files:
            files.append(f["file"])
    for name in files:
        if os.path.basename(name) != name:
            why.append(f"bad file name {name}"); continue
        try:
            a = open(os.path.join(smoke_dir, "data", name), "rb").read()
        except Exception:
            why.append(f"{name}: smoke kept no copy of the stale file"); continue
        try:
            b = open(os.path.join(before_dir, name), "rb").read()
        except Exception:
            why.append(f"{name}: no copy of what live served before this deploy"); continue
        if a != b:
            why.append(f"{name}: stale AND changed by this deploy (not byte-identical to pre-deploy live)")
    if why:
        return False, why
    return True, [f"stale but unchanged since before this deploy: {', '.join(files)} ({len(fails)} freshness check(s))"]

if __name__ == "__main__":
    ok, why = decide(sys.argv[1], sys.argv[2])
    for w in why:
        print(("NO ROLLBACK: " if ok else "ROLLBACK: ") + w)
    if ok:
        print("::warning title=Live smoke: stale data only, no rollback::" + "; ".join(why) + ". The deploy did not change the stale file(s); the data refresh is late.")
    sys.exit(0 if ok else 1)
