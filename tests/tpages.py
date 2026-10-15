#!/usr/bin/env python3
"""P1 (15 Oct, CI 38768537987): every job that deploys GitHub Pages shares ONE concurrency group 'pages' (cancel-in-progress false),
so a second deploy waits for the first. No workflow-level group is named 'pages' (no self-wait), and no deploy job waits on a job of another workflow."""
import glob, os, sys, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
def ok(c, n, x=''):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)
dep, wfg = [], {}
for p in sorted(glob.glob(os.path.join(ROOT, '.github/workflows/*.yml'))):
    w = yaml.safe_load(open(p)); f = os.path.basename(p); c = w.get('concurrency'); wfg[f] = c.get('group') if isinstance(c, dict) else c
    for j, v in (w.get('jobs') or {}).items():
        if any('deploy-pages' in str(s.get('uses', '')) or 'upload-pages-artifact' in str(s.get('uses', '')) and False for s in v.get('steps', [])): dep.append((f, j, v.get('concurrency'), v.get('needs')))
ok(len(dep) >= 4 and {d[0] for d in dep} >= {'ci.yml', 'publish-derivs.yml'}, 'deploy jobs found in ci.yml and publish-derivs.yml', dep)
for f, j, c, _ in dep: ok(isinstance(c, dict) and c.get('group') == 'pages' and c.get('cancel-in-progress') is False, f'{f} {j}: concurrency group pages, cancel-in-progress false', c)
ok(all(g != 'pages' for g in wfg.values()), "no workflow-level group is 'pages' (a job cannot wait on its own workflow)", wfg)
# no deadlock: a job holding 'pages' only runs deploy steps; nothing inside a pages job waits for another workflow
for f, j, c, _ in dep:
    w = yaml.safe_load(open(os.path.join(ROOT, '.github/workflows', f))); rs = '\n'.join(s.get('run', '') for s in w['jobs'][j].get('steps', []))
    ok('gh run watch' not in rs and 'gh workflow run' not in rs, f'{f} {j}: holds pages without waiting on / dispatching another workflow', rs[-200:])
# in each workflow, rollback needs a job downstream of deploy, so deploy has released 'pages' before rollback asks for it
for f in ('ci.yml', 'publish-derivs.yml'):
    J = yaml.safe_load(open(os.path.join(ROOT, '.github/workflows', f)))['jobs']
    def anc(j, seen=None):
        seen = seen or set(); n = J[j].get('needs') or []; n = [n] if isinstance(n, str) else n
        for x in n:
            if x not in seen: seen.add(x); anc(x, seen)
        return seen
    if 'rollback' in J: ok('deploy' in anc('rollback'), f'{f}: rollback runs after deploy (same-workflow jobs never contend for pages at once)', anc('rollback'))
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
