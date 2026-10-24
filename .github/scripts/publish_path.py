#!/usr/bin/env python3
"""Path selection for a data push. Always FAST since 16 Oct: a data push deploys tested code + newest data (snapshot.sh); code=true when HEAD code differs from the tested commit. Usage:
  publish_path.py <good_sha> <head_sha>   -> prints fast|full and writes path=... to $GITHUB_OUTPUT"""
import os, subprocess, sys
FAST_FILES = {"data/derivs.json", "data/_runs.json", "data/market.json", "data/macro.json"}
MARKET_FILES = {"data/market.json", "data/macro.json"}
def select(changed):
    """P1 (16 Oct, deploy starvation): every data push deploys a SNAPSHOT (code of refs/tags/pages-tested + newest data/ on main), so the data
    path is always FAST and never waits for full CI. `changed` = paths differing between the TESTED code commit and HEAD; a code difference only
    sets code=true, which asks for a full CI run of the new code (handover) while this run still publishes the data with the tested code."""
    ch = [f for f in changed if f]
    code = sorted(f for f in ch if not f.startswith("data/"))
    if code: return "fast", "data published with the tested code; untested code differs (" + ", ".join(code[:6]) + (" …" if len(code) > 6 else "") + "): full CI requested for it"
    return "fast", ("data change: " + ", ".join(sorted(ch))) if ch else "no file differs from the tested code commit (re-publish newest data)"
def code_changed(changed):
    """True when anything outside data/ differs: the handover to "CI and deploy" must then run the full node suites (data_redeploy=false)."""
    return any(f and not f.startswith("data/") for f in changed)
def market_changed(changed):
    return bool(set(f for f in changed if f) & MARKET_FILES)
def pick_good(lines):
    """lines: '<updatedAt> <headSha>' from gh run list (one per workflow). Ignores empty/null entries (a workflow with no successful
    run yet prints 'null null'); returns the headSha of the newest, or '' when none."""
    ok = []
    for ln in lines:
        p = ln.split()
        if len(p) == 2 and p[0] != "null" and len(p[1]) == 40 and all(c in "0123456789abcdef" for c in p[1]): ok.append(p)
    return max(ok)[1] if ok else ""
if __name__ == "__main__":
    if sys.argv[1] == "--pick":
        print(pick_good(sys.stdin.read().splitlines())); sys.exit(0)
    good, head = sys.argv[1], sys.argv[2]
    try: changed = subprocess.check_output(["git", "diff", "--no-renames", "--name-only", good, head], text=True).splitlines()
    except Exception as e: changed = ["<diff failed: %s>" % e]
    path, why = select(changed)
    print(f"publish path: {path.upper()} ({why}); last good deploy {good[:7]}, head {head[:7]}")
    if os.environ.get("GITHUB_OUTPUT"): open(os.environ["GITHUB_OUTPUT"], "a").write(f"path={path}\nmarket={'true' if market_changed(changed) else 'false'}\ncode={'true' if code_changed(changed) else 'false'}\n")
