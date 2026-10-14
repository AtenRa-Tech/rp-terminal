#!/usr/bin/env python3
"""Runs .github/scripts/derivs_backstop.py: dispatch when live _runs.json last_run >= 30 min old, null or missing; not when fresh."""
import json, os, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []; T = tempfile.mkdtemp()
def ok(c, n, x=''):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)
def run(obj, now='2026-10-14T18:00:00Z'):
    p = os.path.join(T, 'r.json'); o = os.path.join(T, 'out')
    if obj is None: p = os.path.join(T, 'missing.json')
    else: json.dump(obj, open(p, 'w'))
    open(o, 'w').close()
    env = {k: v for k, v in os.environ.items() if k != 'GITHUB_STEP_SUMMARY'}; env.update(RUNS_JSON=p, NOW=now, GITHUB_OUTPUT=o)
    r = subprocess.run([sys.executable, os.path.join(ROOT, '.github/scripts/derivs_backstop.py')], env=env, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr, open(o).read().strip()
for lab, obj, want in (('29 min old', {'last_run': '2026-10-14T17:31:00Z'}, 'false'), ('exactly 30 min old', {'last_run': '2026-10-14T17:30:00Z'}, 'true'),
                       ('3h old', {'last_run': '2026-10-14T15:00:00Z'}, 'true'), ('seed (last_run null)', {'last_run': None}, 'true'), ('missing file', None, 'true')):
    rc, out, o = run(obj)
    ok(rc == 0 and o == f'dispatch={want}', f"{lab}: dispatch={want}", (rc, out, o))
    ok('derivs backstop:' in out and ('DISPATCH' in out) == (want == 'true'), f"{lab}: decision logged", out)
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
