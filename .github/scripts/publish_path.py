#!/usr/bin/env python3
"""Path selection for a data push. FAST = only data/derivs.json and/or data/_runs.json changed since the last good deploy AND no code
(non-data) file differs from that deploy. Anything else = FULL ("CI and deploy"). Usage:
  publish_path.py <good_sha> <head_sha>   -> prints fast|full and writes path=... to $GITHUB_OUTPUT"""
import os, subprocess, sys
FAST_FILES = {"data/derivs.json", "data/_runs.json"}
def select(changed):
    """changed: list of paths that differ between the last good deploy and HEAD."""
    ch = [f for f in changed if f]
    if not ch: return "fast", "no file differs from the last good deploy (re-publish the same data)"
    other = sorted(set(ch) - FAST_FILES)
    if other: return "full", "non-derivs files changed: " + ", ".join(other[:8]) + (" …" if len(other) > 8 else "")
    return "fast", "derivs-only change: " + ", ".join(sorted(ch))
if __name__ == "__main__":
    good, head = sys.argv[1], sys.argv[2]
    try: changed = subprocess.check_output(["git", "diff", "--no-renames", "--name-only", good, head], text=True).splitlines()
    except Exception as e: changed = ["<diff failed: %s>" % e]
    path, why = select(changed)
    print(f"publish path: {path.upper()} ({why}); last good deploy {good[:7]}, head {head[:7]}")
    if os.environ.get("GITHUB_OUTPUT"): open(os.environ["GITHUB_OUTPUT"], "a").write(f"path={path}\n")
