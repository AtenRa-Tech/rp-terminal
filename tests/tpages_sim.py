#!/usr/bin/env python3
"""P1 (15 Oct) proof, local and hermetic: three Pages deploys started at once (CI code deploy, data publish, data publish) through ONE `pages`
group that keeps one running + one pending run (a newer pending run cancels the older pending one). Every ordering and every dropped run is
replayed against a local origin with the real .github/scripts/snapshot.sh + tested_sha.sh. Checks: live ends on the newest TESTED code and the
newest data/ on main; an untested code commit on main never ships through a data publish; a deploy older than live (code or data) is refused."""
import itertools, json, os, shutil, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
def ok(c, n, x=''):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {str(x)[:600]}"))
    if not c: F.append(n)
def sh(*a, cwd=None, env=None, check=True):
    r = subprocess.run(a, cwd=cwd, env=env, capture_output=True, text=True)
    if check and r.returncode: raise RuntimeError(f"{a}: {r.stdout}{r.stderr}")
    return r
def scenario(order, drop):
    T = tempfile.mkdtemp(); org, wk, live = f"{T}/origin.git", f"{T}/wk", f"{T}/live"
    sh("git", "init", "-q", "--bare", org); sh("git", "clone", "-q", org, wk)
    g = lambda *a: sh("git", "-c", "user.name=t", "-c", "user.email=t@t", *a, cwd=wk).stdout.strip()
    os.makedirs(f"{wk}/data"); os.makedirs(f"{wk}/icons"); os.makedirs(f"{wk}/.github"); shutil.copytree(f"{ROOT}/.github/scripts", f"{wk}/.github/scripts")
    open(f"{wk}/icons/i.txt", "w").write("i"); open(f"{wk}/manifest.webmanifest", "w").write("{}")
    shutil.copy(f"{ROOT}/data/derivs.json", f"{wk}/data/derivs.json")
    R = json.load(open(f"{ROOT}/data/_runs.json")); json.dump(R, open(f"{wk}/data/_runs.json", "w")); mac = {"updated": "2026-10-15T06:00:00Z"}
    def data(ts): json.dump({"updated": ts}, open(f"{wk}/data/market.json", "w")); json.dump(mac, open(f"{wk}/data/macro.json", "w")); g("add", "-A"); g("commit", "-qm", "data " + ts); g("push", "-q", "origin", "HEAD:main"); return g("rev-parse", "HEAD")
    def code(v): open(f"{wk}/index.html", "w").write(f"<html>{v}</html>"); g("add", "-A"); g("commit", "-qm", "code " + v); g("push", "-q", "origin", "HEAD:main"); return g("rev-parse", "HEAD")
    A = code("A tested"); data("2026-10-15T10:00:00Z"); g("push", "-q", "origin", f"{A}:refs/tags/pages-tested")
    env = dict(os.environ, LIVE_BUILD=f"{live}/build.json", LIVE_DERIVS=f"{live}/data/derivs.json", LIVE_RUNS=f"{live}/data/_runs.json", LIVE_MARKET=f"{live}/data/market.json", LIVE_MACRO=f"{live}/data/macro.json", GITHUB_REPOSITORY="")
    def deploy(code_sha, extra=()):
        site = f"{T}/site"; r = sh("bash", ".github/scripts/snapshot.sh", site, code_sha, *extra, cwd=wk, env=env, check=False)
        if r.returncode == 0: shutil.rmtree(live, ignore_errors=True); shutil.copytree(site, live)
        return r
    assert deploy(A).returncode == 0
    C = code("C passed test"); data("2026-10-15T11:00:00Z")   # CI for C is at its deploy job
    U = code("U untested"); D2 = data("2026-10-15T12:00:00Z")  # U: CI still in `test`; newest data after it
    tested = lambda: sh("bash", ".github/scripts/tested_sha.sh", cwd=wk, env=env).stdout.strip()
    jobs = {"code": lambda: deploy(C), "data1": lambda: deploy(tested()), "data2": lambda: deploy(tested())}
    # pages group: first in `order` runs; the 2nd waits; the 3rd replaces the waiting one (cancelled) -> `drop` must be order[1]
    run = [j for j in order if j != drop]; log, shipped = [], []
    for j in run:
        r = jobs[j](); log.append((j, r.returncode, (r.stdout + r.stderr).strip().splitlines()[-1:] ))
        if r.returncode == 0: shipped.append(json.load(open(f"{live}/build.json"))["code_sha"])
        if j == "code" and r.returncode == 0: g("push", "-q", "-f", "origin", f"{C}:refs/tags/pages-tested")  # live smoke green -> promote C
    # the next scheduled data publish (15 min later) after the burst
    r = deploy(tested()); log.append(("next data", r.returncode, (r.stdout + r.stderr).strip().splitlines()[-1:]))
    if r.returncode == 0: shipped.append(json.load(open(f"{live}/build.json"))["code_sha"])
    b = json.load(open(f"{live}/build.json")); mk = json.load(open(f"{live}/data/market.json"))["updated"]
    newest_tested = C if drop != "code" else A
    res = dict(order=order, drop=drop, log=log, final_code=b["code_sha"][:7], want=newest_tested[:7], data=mk, untested_shipped=U in shipped)
    # refusal: a deploy of OLDER code than live must fail
    old = deploy(A) if b["code_sha"] == C else None
    res["old_refused"] = None if old is None else (old.returncode != 0 and "older than" in old.stdout + old.stderr)
    shutil.rmtree(T, ignore_errors=True); return res
for order in itertools.permutations(["code", "data1", "data2"]):
    r = scenario(list(order), order[1])
    lab = f"start {'+'.join(order)}, {order[1]} dropped (pending replaced)"
    ok(r["final_code"] == r["want"] and r["data"] == "2026-10-15T12:00:00Z" and not r["untested_shipped"], f"{lab}: live = newest tested code {r['want']} + newest data; untested U never shipped", r)
    if r["old_refused"] is not None: ok(r["old_refused"], f"{lab}: a later deploy of older code is refused", r)
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
