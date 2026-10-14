#!/usr/bin/env python3
"""Never publish older derivatives than live. Compares <site_dir>/data/derivs.json 'updated' and data/_runs.json 'last_run' with LIVE.
  no_regress.py check <site_dir>            exit 1 if either is older than live (refuse to publish)
  no_regress.py snapshot <out.json>         save live updated/last_run (before a deploy)
  no_regress.py after <snapshot.json>       exit 1 if live now is older than the snapshot (live went backwards)
Env: SITE_URL; LIVE_DERIVS / LIVE_RUNS (local files, tests). A missing value on one side is reported, never treated as newer."""
import datetime as d, json, os, sys, time, urllib.request
site = os.environ.get("SITE_URL", "https://atenra-tech.github.io/rp-terminal/").rstrip("/") + "/"
def P(s):
    try: return d.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception: return None
def ld(path=None, url=None):
    try:
        return json.load(open(path)) if path else json.load(urllib.request.urlopen(f"{url}?v={int(time.time())}", timeout=30))
    except Exception: return None
def live():
    dv = ld(os.environ.get("LIVE_DERIVS"), None if os.environ.get("LIVE_DERIVS") else site + "data/derivs.json")
    rn = ld(os.environ.get("LIVE_RUNS"), None if os.environ.get("LIVE_RUNS") else site + "data/_runs.json")
    return {"updated": (dv or {}).get("updated"), "last_run": (rn or {}).get("last_run")}
def compare(new, old, what):
    bad = []
    for k in ("updated", "last_run"):
        a, b = P(new.get(k)), P(old.get(k))
        if a and b and a < b: bad.append(f"{k} {new.get(k)} is older than {what} {old.get(k)}")
        elif not a and b: print(f"::warning::{k}: no value on the new side while {what} has {old.get(k)}")
    return bad
if __name__ == "__main__":
    mode, arg = sys.argv[1], sys.argv[2]
    if mode == "check":
        new = {"updated": (ld(os.path.join(arg, "data/derivs.json")) or {}).get("updated"), "last_run": (ld(os.path.join(arg, "data/_runs.json")) or {}).get("last_run")}
        L = live(); bad = compare(new, L, "live")
        print(f"no-regress: publishing updated={new['updated']} last_run={new['last_run']}; live updated={L['updated']} last_run={L['last_run']}")
        if bad: print("::error title=Refusing to publish older derivatives::" + "; ".join(bad)); sys.exit(1)
        print("no-regress OK")
    elif mode == "snapshot":
        L = live(); json.dump(L, open(arg, "w")); print("live before deploy:", L)
    elif mode == "after":
        S = json.load(open(arg)); L = live(); bad = compare(L, S, "live before this deploy")
        print(f"live now updated={L['updated']} last_run={L['last_run']}; before deploy {S}")
        if bad: print("::error title=Live derivatives went backwards::" + "; ".join(bad)); sys.exit(1)
        print("live did not go backwards")
