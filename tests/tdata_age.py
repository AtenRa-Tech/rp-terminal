#!/usr/bin/env python3
"""data_age.py: fresh passes; stale derivs / stale market / macro not ok / old last_run / seed each fail."""
import copy, json, os, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); F = []; T = tempfile.mkdtemp()
def ok(c, n, x=''):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f" :: {x}"))
    if not c: F.append(n)
NOW = '2026-10-15T07:30:00Z'
FRESH = {'last_run': '2026-10-15T07:22:50Z', 'runs': [{'feeds': {
    'BTC oi': {'t': '2026-10-15T06:00:00Z', 'lim_h': 3.0}, 'BTC funding': {'t': '2026-10-15T00:00:00Z', 'lim_h': 12.0}}}],
    'market': {'updated': '2026-10-15T06:52:32Z', 'limit_h': 2}, 'macro': {'M2SL': {'ok': True, 'limit': '100 days (monthly)'}}}
def run(d, now=NOW):
    p = os.path.join(T, 'r.json'); json.dump(d, open(p, 'w'))
    r = subprocess.run([sys.executable, os.path.join(ROOT, '.github/scripts/data_age.py'), p, '--now', now], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr
rc, o = run(FRESH); ok(rc == 0 and 'PASS' in o, 'fresh live data passes', o)
# the 15 Oct pause: everything frozen at 14 Oct 23:22Z, checked at 06:00Z
P = copy.deepcopy(FRESH); P['last_run'] = '2026-10-14T23:22:00Z'; P['runs'][0]['feeds']['BTC oi']['t'] = '2026-10-14T23:00:00Z'; P['market']['updated'] = '2026-10-14T23:22:00Z'
rc, o = run(P, '2026-10-15T06:00:00Z'); ok(rc == 1 and '::error' in o and 'last_run' in o and 'BTC oi' in o and 'market' in o, 'pause-frozen data fails, naming last_run, feed and market', o)
S = copy.deepcopy(FRESH); S['runs'][0]['feeds']['BTC oi']['t'] = '2026-10-15T04:00:00Z'
rc, o = run(S); ok(rc == 1 and 'BTC oi' in o and 'funding' not in o, 'oi past its own 3h limit fails; funding at 7.5h (12h limit) does not', o)
M = copy.deepcopy(FRESH); M['market']['updated'] = '2026-10-15T05:00:00Z'
rc, o = run(M); ok(rc == 1 and 'market' in o, 'market past its 2h limit fails', o)
X = copy.deepcopy(FRESH); X['macro']['M2SL']['ok'] = False
rc, o = run(X); ok(rc == 1 and 'M2SL' in o, 'macro series not ok fails', o)
L = copy.deepcopy(FRESH); L['last_run'] = '2026-10-15T05:50:00Z'
rc, o = run(L); ok(rc == 1 and 'last_run' in o, 'last_run 100 min old fails (refresh stopped)', o)
rc, o = run({'last_run': None, 'runs': []}); ok(rc == 1 and 'Traceback' not in o, 'seed _runs.json fails cleanly', o)
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
