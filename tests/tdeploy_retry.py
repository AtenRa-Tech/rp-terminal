#!/usr/bin/env python3
"""24 Nov (supervisor blocker): every GitHub Pages deploy retries EXACTLY ONCE, and only on the artifact-lookup failure.
Cause (data.yml runs 42542550436 44666052932 44880238672 45052955023 45261080418 45371562199): deploy-pages lists the run's artifacts once, ~0.5s after
upload-pages-artifact finalised, and the listing had not caught up -> 'No artifacts named "github-pages"'. Static: the step shape in every deploy job of
ci.yml and data.yml. Behavioural: the real step `if:` expressions evaluated for success / lookup failure + retry ok / two failures / other failure, the
real retry-gate script run with a stub sleep (60s once). actionlint must be clean when the binary is available (ACTIONLINT, PATH, /workspace/tools)."""
import os, re, shutil, subprocess, sys, tempfile, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
def ok(c, n, x=''):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {str(x)[:400]}"))
    if not c: F.append(n)
W = lambda f: yaml.safe_load(open(os.path.join(ROOT, ".github/workflows", f)))
DEP = lambda s: "actions/deploy-pages@" in str(s.get("uses", ""))
jobs = [(f, j, v) for f in ("ci.yml", "data.yml") for j, v in W(f)["jobs"].items() if any(DEP(s) for s in v.get("steps", []))]
ok(sorted((f, j) for f, j, _ in jobs) == [("ci.yml", "deploy"), ("ci.yml", "rollback"), ("data.yml", "deploy"), ("data.yml", "rollback")], "deploy-pages jobs: ci.yml + data.yml deploy and rollback", [(f, j) for f, j, _ in jobs])

def ev(expr, st):
    """evaluate a GitHub `if:` over step results st = {id: {'outcome':..., 'page_url':...}} (subset used here)"""
    e = str(expr).strip()
    if e.startswith("${{"): e = e[3:-2]
    rest = re.sub(r"steps\.\w+\.(outcome|outputs\.page_url)|!cancelled\(\)|'[a-z]*'|==|!=|&&|\|\||[\s()]", "", e)
    if rest: ok(False, "if-expression uses only steps outcomes / page_url / cancelled()", expr)
    e = re.sub(r"steps\.(\w+)\.outcome", lambda m: repr(st.get(m.group(1), {}).get("outcome", "")), e)
    e = re.sub(r"steps\.(\w+)\.outputs\.page_url", lambda m: repr(st.get(m.group(1), {}).get("page_url", "")), e)
    e = e.replace("!cancelled()", "True").replace("&&", " and ").replace("||", " or ")
    return eval(e, {"__builtins__": {}}, {})

for f, j, v in jobs:
    st = v["steps"]; ix = [i for i, s in enumerate(st) if DEP(s)]; tag = f"{f} {j}"
    ok(len(ix) == 2, f"{tag}: exactly two deploy-pages steps (first try + ONE retry)", ix)
    if len(ix) != 2: continue
    d1, d2 = st[ix[0]], st[ix[1]]
    ok(d1.get("id") == "dep" and d1.get("continue-on-error") is True, f"{tag}: first deploy id dep, continue-on-error (the retry decides)", d1)
    ok(d2.get("id") == "dep2" and not d2.get("continue-on-error"), f"{tag}: retry id dep2 and NOT continue-on-error (a second failure fails the job)", d2)
    ok((d1.get("with") or {}).get("artifact_name") == (d2.get("with") or {}).get("artifact_name"), f"{tag}: retry deploys the same artifact", (d1.get("with"), d2.get("with")))
    between = st[ix[0] + 1:ix[1]]
    ok(len(between) == 1 and between[0].get("id") == "depwait", f"{tag}: one wait step between the two deploys", between)
    w = between[0] if between else {}
    ok("steps.dep.outcome == 'failure'" in str(w.get("if")) and "steps.dep.outputs.page_url == ''" in str(w.get("if")), f"{tag}: retry only when the first deploy failed before a Pages deployment existed (page_url empty)", w.get("if"))
    ok(re.findall(r"\bsleep (\d+)", w.get("run", "")) == ["60"], f"{tag}: waits 60s exactly once", w.get("run"))
    ok(str(d2.get("if")).strip() == "steps.depwait.outcome == 'success'", f"{tag}: retry runs only after the wait step", d2.get("if"))
    rest = st[ix[1] + 1:]
    ok(len(rest) == 1 and "exit 1" in rest[0].get("run", ""), f"{tag}: last step fails the job unless a deploy succeeded", rest)
    res = rest[0] if rest else {}
    pre = st[ix[0] - 1]
    ok("artifacts?name=$ART" in pre.get("run", "") and "seq 1 10" in pre.get("run", "") and "exit 1" not in pre.get("run", "") and pre.get("env", {}).get("ART") == ((d1.get("with") or {}).get("artifact_name") or "github-pages"), f"{tag}: listing wait (10 x 3s, never fails) for the same artifact right before the deploy", pre)
    ok("actions: read" in yaml.safe_dump(v.get("permissions")).replace("'", ""), f"{tag}: actions: read for the artifact listing", v.get("permissions"))
    env = v.get("environment") or {}
    if isinstance(env, dict) and env.get("url"): ok("steps.dep.outputs.page_url || steps.dep2.outputs.page_url" in env["url"], f"{tag}: environment url from whichever deploy succeeded", env)
    ok(not any("actions/deploy-pages" in s.get("run", "") or "gh run rerun" in s.get("run", "") or "gh workflow run" in s.get("run", "") for s in st), f"{tag}: no other re-run / re-dispatch path (Actions usage: one retry only)")
    # behavioural: walk the real step conditions
    def walk(o1, url1, o2):
        S, deploys, failed = {}, 0, False
        S["dep"] = {"outcome": o1, "page_url": url1}; deploys += 1
        if ev(w["if"], S):
            # run the real wait script with a stub sleep that records its argument
            T = tempfile.mkdtemp(); log = os.path.join(T, "sleep.log")
            open(os.path.join(T, "sleep"), "w").write(f'#!/bin/sh\necho "$@" >> {log}\n'); os.chmod(os.path.join(T, "sleep"), 0o755)
            r = subprocess.run(["bash", "-e", "-c", w["run"]], capture_output=True, text=True, env=dict(os.environ, PATH=T + ":" + os.environ["PATH"]))
            slept = open(log).read().split() if os.path.exists(log) else []
            shutil.rmtree(T); S["depwait"] = {"outcome": "success" if r.returncode == 0 else "failure"}
        else: slept = None; S["depwait"] = {"outcome": "skipped"}
        if ev(d2["if"], S):
            deploys += 1; S["dep2"] = {"outcome": o2}
            if o2 == "failure": failed = True   # not continue-on-error -> job fails here; later default-if steps skip, the result step still evaluates
        else: S["dep2"] = {"outcome": "skipped"}
        if ev(res["if"], S): failed = True
        return deploys, failed, slept
    ok(walk("success", "https://x/", None) == (1, False, None), f"{tag}: first deploy ok -> no wait, no retry, job green", walk("success", "https://x/", None))
    ok(walk("failure", "", "success") == (2, False, ["60"]), f"{tag}: artifact lookup failed -> 60s wait, ONE retry, green", walk("failure", "", "success"))
    ok(walk("failure", "", "failure") == (2, True, ["60"]), f"{tag}: lookup failed twice -> job red after exactly 2 deploys", walk("failure", "", "failure"))
    ok(walk("failure", "https://x/", None) == (1, True, None), f"{tag}: failure after a Pages deployment was created -> no retry, job red", walk("failure", "https://x/", None))

# actionlint (24 Nov): the workflows must stay clean
al = os.environ.get("ACTIONLINT") or shutil.which("actionlint") or ("/workspace/tools/actionlint" if os.path.exists("/workspace/tools/actionlint") else None)
if al:
    r = subprocess.run([al] + sorted(os.path.join(ROOT, ".github/workflows", x) for x in os.listdir(os.path.join(ROOT, ".github/workflows")) if x.endswith(".yml")), capture_output=True, text=True)
    ok(r.returncode == 0, "actionlint clean on every workflow", r.stdout + r.stderr)
else: print("SKIP actionlint: binary not found (set ACTIONLINT=/path/to/actionlint)")
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
