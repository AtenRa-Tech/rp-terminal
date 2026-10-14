#!/usr/bin/env python3
# Watchdog item 3: fail loudly when the LIVE data/derivs.json is more than 6 h behind the copy on main (this run's commit).
# That gap means data commits are landing but deploys are not (e.g. a gate blocking every data redeploy). Env: SITE_URL, LAG_H (default 6),
# LIVE_JSON (optional local file instead of fetching, for tests).
# 14 Oct: the clock is data/_runs.json last_run (each derivatives run), not derivs.json 'updated'; derivs.json 'updated' is used only while
# _runs.json is missing on either side (first deploy after the change).
import json, os, sys, time, urllib.request, datetime as d
P = lambda u: d.datetime.fromisoformat(u.replace('Z', '+00:00'))
lim = float(os.environ.get('LAG_H', '6')); site = os.environ.get('SITE_URL', 'https://atenra-tech.github.io/rp-terminal/').rstrip('/') + '/'
def runs_or_updated(obj_runs, obj_derivs):
    return (obj_runs or {}).get('last_run') or obj_derivs['updated']
try: main_runs = json.load(open(os.environ.get('MAIN_RUNS', 'data/_runs.json')))
except Exception: main_runs = None
main_d = json.load(open(os.environ.get('MAIN_JSON', 'data/derivs.json')))
try:
    if os.environ.get('LIVE_JSON'): live_d = json.load(open(os.environ['LIVE_JSON']))
    else: live_d = json.load(urllib.request.urlopen(f"{site}data/derivs.json?v={int(time.time())}", timeout=30))
    try: live_runs = json.load(open(os.environ['LIVE_RUNS'])) if os.environ.get('LIVE_RUNS') else json.load(urllib.request.urlopen(f"{site}data/_runs.json?v={int(time.time())}", timeout=30))
    except Exception: live_runs = None
    if main_runs and live_runs: main, live = main_runs['last_run'], live_runs['last_run']
    else: main, live = main_d['updated'], live_d['updated']
except Exception as e:
    live = None; err = str(e)
S = os.environ.get('GITHUB_STEP_SUMMARY'); out = open(S, 'a') if S else sys.stdout
if live is None:
    print(f"::error title=Live data watchdog::could not read live derivs.json ({err})"); out.write(f"## Live data watchdog\nCould not read live derivs.json: {err}\n"); sys.exit(1)
lag = (P(main) - P(live)).total_seconds() / 3600
msg = f"live derivs.json updated {live}, main has {main}: live is {lag:.1f} h behind main (limit {lim:g} h)"
if lag > lim:
    print(f"::error title=Live data frozen::{msg}. Deploys are not landing; open the failed test/smoke job summary for the blocking gate lines.")
    out.write(f"## Live data watchdog: FROZEN\n**{msg}.** Deploys are not landing; see the blocking gate lines in the test or smoke job summary.\n"); sys.exit(1)
print(f"live data watchdog OK: {msg}"); out.write(f"## Live data watchdog: OK\n{msg}\n")
