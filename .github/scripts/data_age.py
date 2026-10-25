#!/usr/bin/env python3
"""data_age.py <_runs.json path or URL> [--now ISO]
Fails (exit 1, ::error) when live data is past its OWN limit, recomputed against now (not the age written at run time):
  - each derivatives feed in the newest runs[] entry: now - feeds[f].t > feeds[f].lim_h
  - market: now - market.updated > market.limit_h
  - macro: any series with ok == false (judged by each series' last_date)
  - macro fetch: now - macro_checked.checked_at > macro_checked.limit_h (fetch_macro.py stopped running)
  - last_run older than 90 min (the derivatives refresh itself stopped, e.g. workflows disabled)
Unreadable/seed _runs.json fails too. Used by stale-alarm.yml (dispatched by the Netlify stale alarm) and the live suite."""
import json, sys, urllib.request
from datetime import datetime, timezone
LAST_RUN_MAX_MIN = 90
# first main commit writing macro.json checked_at: 206b8e0 at 2026-10-15T17:57:08Z; missing macro_checked only warns for 24h after it
ROLLOUT_START = '2026-10-15T17:57:08Z'
P = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00'))
from datetime import timedelta
ROLLOUT_END = P(ROLLOUT_START) + timedelta(hours=24)
def load(src):
    if src.startswith('http'):
        with urllib.request.urlopen(src + ('&' if '?' in src else '?') + 'v=%d' % datetime.now().timestamp(), timeout=30) as r: return json.load(r)
    return json.load(open(src))
def check(d, now):
    bad = []
    lr = d.get('last_run')
    if not lr: return ['_runs.json has no last_run (seed or broken)']
    m = (now - P(lr)).total_seconds() / 60
    if m > LAST_RUN_MAX_MIN: bad.append(f'last_run {lr} is {m:.0f} min old (> {LAST_RUN_MAX_MIN} min: derivatives refresh not running)')
    runs = d.get('runs') or []
    feeds = (runs[-1] if runs else {}).get('feeds') or {}
    if not feeds: bad.append('no feeds in newest runs[] entry')
    for f, v in feeds.items():
        if not v.get('t') or v.get('lim_h') is None: bad.append(f'{f}: no t/lim_h'); continue
        h = (now - P(v['t'])).total_seconds() / 3600
        if h > v['lim_h']: bad.append(f'{f}: {h:.1f}h old > limit {v["lim_h"]}h')
    mk = d.get('market') or {}
    if not mk.get('updated') or mk.get('limit_h') is None: bad.append('market: no updated/limit_h')
    else:
        h = (now - P(mk['updated'])).total_seconds() / 3600
        if h > mk['limit_h']: bad.append(f'market: {h:.1f}h old > limit {mk["limit_h"]}h')
    for s, v in (d.get('macro') or {}).items():
        if isinstance(v, dict) and v.get('ok') is False: bad.append(f'macro {s}: past its limit ({v.get("limit")})')
    mc = d.get('macro_checked')
    if mc is None:
        # rollout (16 Oct): macro_checked is new. Missing = warning for 24h after the first main commit that wrote checked_at, then a failure.
        if now < ROLLOUT_END: print(f'::warning title=Live data age::macro_checked missing (rollout window until {ROLLOUT_END:%Y-%m-%dT%H:%MZ})')
        else: bad.append('macro_checked missing (macro fetch time unknown; rollout window ended)')
    elif not mc.get('checked_at') or mc.get('limit_h') is None: bad.append('macro fetch: no checked_at/limit_h')
    else:
        h = (now - P(mc['checked_at'])).total_seconds() / 3600
        if h > mc['limit_h']: bad.append(f'macro fetch: last successful run {h:.1f}h ago > limit {mc["limit_h"]}h')
    return bad
if __name__ == '__main__':
    a = sys.argv[1:]; now = datetime.now(timezone.utc)
    if '--now' in a: i = a.index('--now'); now = P(a[i + 1]); del a[i:i + 2]
    try: d = load(a[0])
    except Exception as e: print(f'::error title=Live data age::could not read {a[0]}: {e}'); sys.exit(1)
    bad = check(d, now)
    if bad: print('::error title=Live data STALE::' + '; '.join(bad)); sys.exit(1)
    print(f'PASS live data within each feed limit (last_run {d["last_run"]})')
