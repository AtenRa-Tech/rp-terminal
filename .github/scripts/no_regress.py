#!/usr/bin/env python3
"""Never publish older derivatives than live. Compares derivs.json 'updated', _runs.json 'last_run', market.json and macro.json 'updated' in <site_dir>/data with LIVE.
  no_regress.py check <site_dir>            exit 1 if either is older than live (refuse to publish)
  no_regress.py snapshot <out.json>         save live updated/last_run (before a deploy)
  no_regress.py newest <site_dir>           replace each tracked data file in <site_dir> with LIVE's copy when live is newer (rollback keeps newest data)
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
# key -> (file, field, env override for tests)
KEYS = {"updated": ("derivs.json", "updated", "LIVE_DERIVS"), "last_run": ("_runs.json", "last_run", "LIVE_RUNS"),
        "market_updated": ("market.json", "updated", "LIVE_MARKET"), "macro_updated": ("macro.json", "updated", "LIVE_MACRO")}
def live():
    o = {}
    for k, (f, fld, ev) in KEYS.items():
        j = ld(os.environ.get(ev), None if os.environ.get(ev) else site + "data/" + f)
        o[k] = (j or {}).get(fld)
    return o
def local(d):
    return {k: (ld(os.path.join(d, "data", f)) or {}).get(fld) for k, (f, fld, _) in KEYS.items()}
def compare(new, old, what):
    bad = []
    for k in KEYS:
        a, b = P(new.get(k)), P(old.get(k))
        if a and b and a < b: bad.append(f"{k} {new.get(k)} is older than {what} {old.get(k)}")
        elif not a and b: print(f"::warning::{k}: no value on the new side while {what} has {old.get(k)}")
    return bad
if __name__ == "__main__":
    mode, arg = sys.argv[1], sys.argv[2]
    if mode == "newest":
        for k, (f, fld, ev) in KEYS.items():
            dst = os.path.join(arg, "data", f); mine = (ld(dst) or {}).get(fld)
            j = ld(os.environ.get(ev), None if os.environ.get(ev) else site + "data/" + f); theirs = (j or {}).get(fld)
            a, b = P(mine), P(theirs)
            if b and (not a or b > a): json.dump(j, open(dst, "w"), separators=(",", ":")); print(f"newest: {f} from live ({theirs} > {mine})")
            else: print(f"newest: {f} kept ({mine}; live {theirs})")
        sys.exit(0)
    if mode == "check":
        new = local(arg); L = live(); bad = compare(new, L, "live")
        print(f"no-regress: publishing {new}; live {L}")
        if bad: print("::error title=Refusing to publish older derivatives::" + "; ".join(bad)); sys.exit(1)
        print("no-regress OK")
    elif mode == "snapshot":
        L = live(); json.dump(L, open(arg, "w")); print("live before deploy:", L)
    elif mode == "after":
        S = json.load(open(arg)); L = live(); bad = compare(L, S, "live before this deploy")
        print(f"live now {L}; before deploy {S}")
        if bad: print("::error title=Live derivatives went backwards::" + "; ".join(bad)); sys.exit(1)
        print("live did not go backwards")
