#!/usr/bin/env python3
"""Path selection for a data push. FAST = only data/derivs.json, _runs.json, market.json and/or macro.json changed since the last good deploy AND no code
(non-data) file differs from that deploy. Anything else = FULL ("CI and deploy"). Usage:
  publish_path.py <good_sha> <head_sha>   -> prints fast|full and writes path=... to $GITHUB_OUTPUT"""
import os, subprocess, sys
FAST_FILES = {"data/derivs.json", "data/_runs.json", "data/market.json", "data/macro.json"}
MARKET_FILES = {"data/market.json", "data/macro.json"}
def select(changed):
    """changed: list of paths that differ between the last good deploy and HEAD."""
    ch = [f for f in changed if f]
    if not ch: return "fast", "no file differs from the last good deploy (re-publish the same data)"
    other = sorted(set(ch) - FAST_FILES)
    if other: return "full", "non-derivs files changed: " + ", ".join(other[:8]) + (" …" if len(other) > 8 else "")
    kind = "market/macro" if set(ch) & MARKET_FILES else "derivs-only"
    return "fast", f"{kind} change: " + ", ".join(sorted(ch))
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
    if os.environ.get("GITHUB_OUTPUT"): open(os.environ["GITHUB_OUTPUT"], "a").write(f"path={path}\nmarket={'true' if market_changed(changed) else 'false'}\n")
