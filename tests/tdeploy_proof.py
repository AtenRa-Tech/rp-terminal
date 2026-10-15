#!/usr/bin/env python3
"""Proof (16 Oct) from the workflow code itself, static + behavioural; fails if either property breaks.
(a) every data-only deploy (ci.yml data redeploy, fast publish) builds through snapshot.sh, which runs the publish guard on the exact derivs.json
    (closed hours only, no test marks, overlapping hours identical to main AND to live) and no_regress (nothing older than live); no later step
    rewrites the published derivs.json.
(b) a fast data push ships code only from refs/tags/pages-tested (last_good.sh fallback when the tag is missing), never main's untested code."""
import json, os, re, shutil, subprocess, sys, tempfile, time, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
def ok(c, n, x=''):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {str(x)[:500]}"))
    if not c: F.append(n)
W = lambda f: yaml.safe_load(open(os.path.join(ROOT, ".github/workflows", f)))
SNAP = open(os.path.join(ROOT, ".github/scripts/snapshot.sh")).read(); TS = open(os.path.join(ROOT, ".github/scripts/tested_sha.sh")).read()
# ---- static (a)
ok("set -euo pipefail" in SNAP, "snapshot.sh stops on the first failing check (set -e)")
ok('no_regress.py" check "$dir"' in SNAP, "snapshot.sh: no_regress check (nothing older than live)")
ok(re.search(r'publish_guard\.py" "\$dir/data/derivs\.json" "\$dir/\.main-derivs\.json"', SNAP) and re.search(r'publish_guard\.py" "\$dir/data/derivs\.json" "\$dir/\.live-derivs\.json"', SNAP), "snapshot.sh: publish guard vs main AND vs live")
for wf, job in (("ci.yml", "deploy"), ("publish-derivs.yml", "deploy")):
    st = W(wf)["jobs"][job]["steps"]; iS = [i for i, s in enumerate(st) if "snapshot.sh" in s.get("run", "")]; iD = [i for i, s in enumerate(st) if "deploy-pages" in str(s.get("uses", ""))]
    ok(iS and iD and iS[0] < iD[0], f"{wf} {job}: snapshot.sh runs before deploy-pages", (iS, iD))
    after = "\n".join(s.get("run", "") for s in st[iS[0]:iD[0]] if s.get("run")).split("snapshot.sh", 1)[-1] if iS else ""
    ok(not re.search(r"(>\s*|(cp|mv)\s+\S+\s+)_site/data/derivs\.json", after), f"{wf} {job}: nothing rewrites _site/data/derivs.json after the guard", after[:300])
    ok(not re.search(r"cp [^\n]*(index\.html|sw\.js|icons|manifest)[^\n]*_site", after), f"{wf} {job}: no code file copied into _site after snapshot (code = git archive of the tested sha only)")
pd = "\n".join(s.get("run", "") for s in W("publish-derivs.yml")["jobs"]["deploy"]["steps"])
ok("no_regress.py check _site" in pd.split("snapshot.sh", 1)[-1], "publish-derivs deploy: no_regress re-checked after the gated market/macro copies")
# ---- static (b)
ok(re.search(r'code=\$\(bash \.github/scripts/tested_sha\.sh\).*\n.*snapshot\.sh _site "\$code"', pd), "fast publish: snapshot code = tested_sha.sh, nothing else", pd[:400])
cd = "\n".join(s.get("run", "") for s in W("ci.yml")["jobs"]["deploy"]["steps"])
ok('if [ "$DATA_REDEPLOY" = true ]; then code=$(bash .github/scripts/tested_sha.sh)' in cd, "ci.yml data-only redeploy: code = tested_sha.sh (suites skipped -> never github.sha)")
ok("refs/tags/pages-tested" in TS and "last_good.sh" in TS and TS.index("refs/tags/pages-tested") < TS.index("last_good.sh"), "tested_sha.sh: pages-tested tag first, last_good.sh only when the tag is missing")
ok(re.search(r'git archive "\$code" -- index\.html', SNAP) and re.search(r'git archive "\$data" -- data \|', SNAP) and "cp -r index.html" not in SNAP, "snapshot.sh: code files only from git archive of <code_sha>, data/ only from main")
# ---- behavioural, against a local origin with the real scripts
T = tempfile.mkdtemp(); org, wk, live = f"{T}/o.git", f"{T}/wk", f"{T}/live"
sh = lambda *a, **k: subprocess.run(a, capture_output=True, text=True, **k)
sh("git", "init", "-q", "--bare", org); sh("git", "clone", "-q", org, wk)
g = lambda *a: sh("git", "-c", "user.name=t", "-c", "user.email=t@t", *a, cwd=wk).stdout.strip()
os.makedirs(f"{wk}/data"); os.makedirs(f"{wk}/icons"); os.makedirs(f"{wk}/.github"); shutil.copytree(f"{ROOT}/.github/scripts", f"{wk}/.github/scripts")
open(f"{wk}/icons/i", "w").write("i"); open(f"{wk}/manifest.webmanifest", "w").write("{}")
DV = json.load(open(f"{ROOT}/data/derivs.json")); json.dump(DV, open(f"{wk}/data/derivs.json", "w")); shutil.copy(f"{ROOT}/data/_runs.json", f"{wk}/data/_runs.json")
json.dump({"updated": "2026-10-15T10:00:00Z"}, open(f"{wk}/data/market.json", "w")); json.dump({"updated": "2026-10-15T06:00:00Z"}, open(f"{wk}/data/macro.json", "w"))
def commit(m): g("add", "-A"); g("commit", "-qm", m); g("push", "-q", "origin", "HEAD:main"); return g("rev-parse", "HEAD")
open(f"{wk}/index.html", "w").write("TESTED"); A = commit("tested code"); g("push", "-q", "origin", f"{A}:refs/tags/pages-tested")
env = dict(os.environ, LIVE_BUILD=f"{live}/build.json", LIVE_DERIVS=f"{live}/data/derivs.json", LIVE_RUNS=f"{live}/data/_runs.json", LIVE_MARKET=f"{live}/data/market.json", LIVE_MACRO=f"{live}/data/macro.json", GITHUB_REPOSITORY="")
def deploy(code, e=env):
    r = sh("bash", ".github/scripts/snapshot.sh", f"{T}/site", code, cwd=wk, env=e)
    if r.returncode == 0: shutil.rmtree(live, ignore_errors=True); shutil.copytree(f"{T}/site", live)
    return r.returncode, r.stdout + r.stderr
tested = lambda e=env: sh("bash", ".github/scripts/tested_sha.sh", cwd=wk, env=e).stdout.strip()
rc, o = deploy(tested()); ok(rc == 0, "baseline snapshot deploy", o)
open(f"{wk}/index.html", "w").write("UNTESTED"); U = commit("untested code")
json.dump({"updated": "2026-10-15T11:00:00Z"}, open(f"{wk}/data/market.json", "w")); commit("data")
rc, o = deploy(tested()); ok(rc == 0 and open(f"{live}/index.html").read() == "TESTED" and json.load(open(f"{live}/data/market.json"))["updated"] == "2026-10-15T11:00:00Z" and json.load(open(f"{live}/build.json"))["code_sha"] == A,
   "(b) fast data push with untested code on main HEAD: live gets the TESTED index.html + the newest data", o)
# tag missing -> last_good.sh fallback (gh stubbed to report A as the last good deploy)
g("push", "-q", "origin", ":refs/tags/pages-tested"); bin_ = f"{T}/bin"; os.makedirs(bin_)
open(f"{bin_}/gh", "w").write(f"#!/bin/sh\ncase \"$*\" in *'run list'*ci.yml*) echo '2026-10-15T10:00:00Z {A}';; *) echo '';; esac\n"); os.chmod(f"{bin_}/gh", 0o755)
e2 = dict(env, PATH=bin_ + os.pathsep + env["PATH"], GITHUB_REPOSITORY="o/r"); t2 = tested(e2)
ok(t2 == A and t2 != U, "(b) pages-tested tag missing: tested_sha.sh falls back to last_good.sh (never main HEAD)", (t2, A, U))
g("push", "-q", "origin", f"{A}:refs/tags/pages-tested")
# (a) guard refusals on the exact file about to be published
H = 3600000; now = int(time.time() * 1000); top = now // H * H
def with_main(mut, msg):
    d = json.loads(json.dumps(DV)); mut(d); json.dump(d, open(f"{wk}/data/derivs.json", "w")); commit(msg); return deploy(tested())
def restore(): json.dump(DV, open(f"{wk}/data/derivs.json", "w")); commit("restore")
rc, o = with_main(lambda d: d["assets"]["BTC"]["oi_hourly"]["points"].append([top, 1.0, 2.0]), "open hour"); ok(rc != 0 and "not yet closed" in o, "(a) refused: a point for an hour not yet closed", o[-300:]); restore()
rc, o = with_main(lambda d: d.__setitem__("_test_only", True), "test mark"); ok(rc != 0 and "_test_only" in o, "(a) refused: test-marked file", o[-300:]); restore()
rc, o = deploy(tested()); ok(rc == 0, "clean data deploys again", o[-300:])
lv = json.load(open(f"{live}/data/derivs.json")); p0 = lv["assets"]["ETH"]["basis_hourly"]["points"][-3]; p0[-1] = p0[-1] + 0.001; json.dump(lv, open(f"{live}/data/derivs.json", "w"))
rc, o = deploy(tested()); ok(rc != 0 and "differ from main" in o, "(a) refused: an overlapping hour differs from what LIVE serves", o[-300:])
json.dump(DV, open(f"{live}/data/derivs.json", "w")); lr = json.load(open(f"{live}/data/_runs.json")); lr["last_run"] = "2099-01-01T00:00:00Z"; json.dump(lr, open(f"{live}/data/_runs.json", "w"))
rc, o = deploy(tested()); ok(rc != 0 and "older than" in o, "(a) refused: data older than live (no_regress)", o[-300:])
shutil.rmtree(T, ignore_errors=True)
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
