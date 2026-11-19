#!/usr/bin/env python3
"""data_age.py <_runs.json path or URL> [--now ISO]
Fails (exit 1, ::error) when live data is past its OWN limit, recomputed against now (not the age written at run time):
  - each derivatives feed in the newest runs[] entry: now - feeds[f].t > feeds[f].lim_h
  - market: now - market.updated > market.limit_h
  - macro: any series with ok == false (judged by each series' last_date)
  - macro fetch: now - macro_checked.checked_at > MACRO_FETCH_LIMIT_H (26h: daily batch at 00:20 UTC, caught up by the first hourly run after a dropped slot (refresh_slot.py --batch-due); fetch_macro.py stopped running)
  - etf: each fund (BTC, ETH) judged on its own last complete day; a held-back pending newest row is named, never counted. Fails if EITHER fund's NYSE trading days after that date through today (UTC) > limit_days (2), counted with scripts/nyse.py (NYSE holidays only, twin of shared/nyse.js). The message names which fund(s) are stale.
  - last_run older than 90 min (the derivatives refresh itself stopped, e.g. workflows disabled)
Unreadable/seed _runs.json fails too. Used by stale-alarm.yml (dispatched by the Netlify stale alarm) and the live suite."""
import json, sys, urllib.request
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'scripts'))
import nyse  # ONE NYSE trading-day calendar shared with the page and the smoke (shared/nyse.js)
from datetime import datetime, timezone
import math
def fmt_age_h(h, lim):
    """C4: 1-decimal hours, but a past-limit age is never rounded down to look inside the limit (3.01h stays 3.01, not 3.0)."""
    s = f"{h:.1f}"
    if h > lim and float(s) <= lim:
        s2 = f"{h:.2f}"
        if float(s2) <= lim:
            m = math.ceil(h * 60 - 1e-12)
            if m <= lim * 60: m = int(lim * 60) + 1
            hh, mm = divmod(int(m), 60)
            return f"{hh}h{mm}m"
        return f"{s2}h"
    return f"{s}h"
LAST_RUN_MAX_MIN = 90
# Daily batch at 00:20 UTC, or a catch-up once the last successful fetch is 26h old (data.yml).
# A tighter limit_h written into older _runs.json (7, from a retired 6h cadence) is ignored:
# hourly Refresh would otherwise go red while live series are still within their own freshness limits.
MACRO_FETCH_LIMIT_H = 26
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
        if h > v['lim_h']: bad.append(f'{f}: {fmt_age_h(h, v["lim_h"])} old > limit {v["lim_h"]}h')
    mk = d.get('market') or {}
    if not mk.get('updated') or mk.get('limit_h') is None: bad.append('market: no updated/limit_h')
    else:
        h = (now - P(mk['updated'])).total_seconds() / 3600
        if h > mk['limit_h']: bad.append(f'market: {fmt_age_h(h, mk["limit_h"])} old > limit {mk["limit_h"]}h')
    for s, v in (d.get('macro') or {}).items():
        if isinstance(v, dict) and v.get('ok') is False: bad.append(f'macro {s}: past its limit ({v.get("limit")})')
    mc = d.get('macro_checked')
    if mc is None:
        # rollout (16 Oct): macro_checked is new. Missing = warning for 24h after the first main commit that wrote checked_at, then a failure.
        if now < ROLLOUT_END: print(f'::warning title=Live data age::macro_checked missing (rollout window until {ROLLOUT_END:%Y-%m-%dT%H:%MZ})')
        else: bad.append('macro_checked missing (macro fetch time unknown; rollout window ended)')
    elif not mc.get('checked_at'): bad.append('macro fetch: no checked_at')
    else:
        h = (now - P(mc['checked_at'])).total_seconds() / 3600
        if h > MACRO_FETCH_LIMIT_H: bad.append(f'macro fetch: last successful run {fmt_age_h(h, MACRO_FETCH_LIMIT_H).rstrip("h")}h ago > limit {MACRO_FETCH_LIMIT_H}h')
    et = d.get('etf')
    if et is None: print('::warning title=Live data age::etf missing from _runs.json (written by runs_log.py since the NYSE calendar change)')
    else:
        funds = et.get('funds')
        if funds:
            for a in nyse.FUNDS:
                f = funds.get(a) or {}
                hb = f.get('held_back'); tail = f'newest row {hb} held back (pending)' if hb else 'no row held back'
                name = a.upper()
                if not f.get('last_date'): bad.append(f'etf {name}: no complete day ({f.get("why", "etf.json missing")}); {tail}')
                else:
                    lim = f.get('limit_days', et.get('limit_days', 2)); bd = nyse.biz_days(f['last_date'], now.timestamp() * 1000)
                    if bd > lim: bad.append(f'etf {name}: last complete day {f["last_date"]} is {bd} NYSE trading days old > limit {lim}; {tail}')
        else:
            # older _runs.json shape (single last_date, before per-fund judgement)
            hb = et.get('held_back'); tail = f'newest row {hb} held back (pending)' if hb else 'no row held back'
            if not et.get('last_date'): bad.append(f'etf: no complete day ({et.get("why", "etf.json missing")}); {tail}')
            else:
                lim = et.get('limit_days', 2); bd = nyse.biz_days(et['last_date'], now.timestamp() * 1000)
                if bd > lim: bad.append(f'etf: last complete day {et["last_date"]} is {bd} NYSE trading days old > limit {lim}; {tail}')
    return bad
if __name__ == '__main__':
    a = sys.argv[1:]; now = datetime.now(timezone.utc)
    if '--now' in a: i = a.index('--now'); now = P(a[i + 1]); del a[i:i + 2]
    try: d = load(a[0])
    except Exception as e: print(f'::error title=Live data age::could not read {a[0]}: {e}'); sys.exit(1)
    bad = check(d, now)
    if bad: print('::error title=Live data STALE::' + '; '.join(bad)); sys.exit(1)
    print(f'PASS live data within each feed limit (last_run {d["last_run"]})')
