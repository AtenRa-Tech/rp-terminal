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
    'market': {'updated': '2026-10-15T06:52:32Z', 'limit_h': 2}, 'macro': {'M2SL': {'ok': True, 'limit': '100 days (monthly)'}},
    'macro_checked': {'checked_at': '2026-10-15T06:31:00Z', 'limit_h': 7}}
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
C = copy.deepcopy(FRESH); C['macro_checked']['checked_at'] = '2026-10-14T23:00:00Z'
rc, o = run(C); ok(rc == 1 and 'macro fetch' in o, 'macro fetch not run for 8.5h (checked_at) fails the alarm', o)
C = copy.deepcopy(FRESH); del C['macro_checked']
rc, o = run(C); ok(rc == 1 and 'macro_checked' in o, 'missing macro_checked fails (not silently passed)', o)
# fresh checked_at does NOT hide an old series: last_date decides
C = copy.deepcopy(FRESH); C['macro_checked']['checked_at'] = '2026-10-15T07:29:00Z'; C['macro']['M2SL']['ok'] = False
rc, o = run(C); ok(rc == 1 and 'M2SL' in o and 'macro fetch' not in o, 'fresh checked_at + series past its last_date limit still fails (stale)', o)
# runs_log + fetch_macro: checked_at refreshes each successful run; last_date stays the data time
sys.path.insert(0, os.path.join(ROOT, 'scripts')); import importlib
rl = importlib.import_module('runs_log'); from datetime import datetime as _D
t = _D.fromisoformat('2026-10-15T07:30:00+00:00').timestamp() * 1000
M = {'updated': '2026-10-15T07:29:00Z', 'checked_at': '2026-10-15T07:29:00Z', 'series': {'DGS10': {'freq': 'Daily', 'last_date': '2026-10-01', 'points': [['2026-10-01', 4.1]]}, 'M2SL': {'freq': 'Monthly', 'last_date': '2026-03-01', 'points': [['2026-03-01', 1]]}}}
mf = rl.macro_fresh(M, t); mc = rl.macro_checked(M, t)
ok(mc['ok'] and mf['DGS10']['ok'] is False and mf['M2SL']['ok'] is False, 'runs_log: fresh checked_at, old last_date -> series stale; fetch check ok', (mf, mc))
ok(rl.macro_checked({'updated': '2026-10-15T07:29:00Z'}, t)['ok'] is False, "runs_log: 'updated' never stands in for checked_at")
fm = open(os.path.join(ROOT, 'scripts/fetch_macro.py')).read(); ns = {}
exec(compile('import json\n' + fm[fm.index('def finalize'):fm.index('def main')], 'fm', 'exec'), ns)
prev = {'updated': '2026-10-15T06:31:00Z', 'checked_at': '2026-10-15T06:31:00Z', 'series': {'A': {'last_date': '2026-10-14'}}}
out = {'updated': '2026-10-15T12:05:00Z', 'checked_at': '2026-10-15T12:05:00Z', 'series': {'A': {'last_date': '2026-10-14'}}}
o2, ch = ns['finalize'](prev, out)
ok(not ch and o2['checked_at'] == '2026-10-15T12:05:00Z' and o2['updated'] == '2026-10-15T06:31:00Z' and o2['series']['A']['last_date'] == '2026-10-14', 'fetch_macro: no value change still writes checked_at; updated and last_date untouched', o2)
o3, ch = ns['finalize'](prev, dict(out, series={'A': {'last_date': '2026-10-15'}})); ok(ch and o3['updated'] == '2026-10-15T12:05:00Z', 'fetch_macro: changed values update updated + checked_at')
src = open(os.path.join(ROOT, 'scripts/fetch_macro.py')).read()
ok(src.index('out, changed = finalize') < src.index('write_json(OUT, out)') and 'return\n    write_json' not in src, 'fetch_macro writes macro.json on every successful run (no early return before write)')
dy = open(os.path.join(ROOT, '.github/workflows/data.yml')).read(); ok("get('checked_at')" in dy, 'data.yml 6h fallback uses checked_at (a fetch that ran is not re-forced every 15 min)')
print("FAILS:", len(F), F); sys.exit(1 if F else 0)
