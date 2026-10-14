#!/usr/bin/env python3
"""Runs .github/scripts/live-lag.py on: seed _runs.json (last_run null), missing _runs.json, real _runs.json, unreadable live derivs."""
import json, os, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []
def ok(c, n, x=''):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)
T = tempfile.mkdtemp(); w = lambda n, o: (json.dump(o, open(os.path.join(T, n), 'w')), os.path.join(T, n))[1]
D = w('d.json', {'updated': '2026-10-14T16:00:00Z'}); DOLD = w('dold.json', {'updated': '2026-10-14T06:00:00Z'})
SEED = w('seed.json', {'last_run': None, 'runs': [], 'hourly': []})
R1 = w('r1.json', {'last_run': '2026-10-14T16:05:00Z'}); MISSING = os.path.join(T, 'nope.json')
def run(main_runs, live_runs, live_json=D):
    env = dict(os.environ, MAIN_JSON=D, MAIN_RUNS=main_runs, LIVE_JSON=live_json, LIVE_RUNS=live_runs, GITHUB_STEP_SUMMARY='')
    env.pop('GITHUB_STEP_SUMMARY')
    p = subprocess.run([sys.executable, os.path.join(ROOT, '.github/scripts/live-lag.py')], env=env, capture_output=True, text=True, cwd=ROOT)
    return p.returncode, p.stdout + p.stderr
for lab, mr, lr in (('seed on both sides', SEED, SEED), ('seed on live only', R1, SEED), ('missing on both sides', MISSING, MISSING), ('missing on live only', R1, MISSING)):
    rc, o = run(mr, lr)
    ok(rc == 0 and 'Traceback' not in o and 'NameError' not in o, f"{lab}: no crash, exit 0", o)
    ok('::warning' in o and "derivs.json 'updated'" in o, f"{lab}: prints a warning that it fell back to derivs 'updated'", o)
rc, o = run(SEED, SEED, DOLD); ok(rc == 1 and 'Live data frozen' in o, "seed + live derivs 10h behind: still fails (fallback is a real check)", o)
rc, o = run(R1, R1); ok(rc == 0 and '::warning' not in o, "real last_run on both sides: uses _runs.json, no warning", o)
rc, o = run(SEED, SEED, MISSING); ok(rc == 1 and 'NameError' not in o and 'could not read live derivs.json' in o, "unreadable live derivs.json: clean ::error, no NameError", o)
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
