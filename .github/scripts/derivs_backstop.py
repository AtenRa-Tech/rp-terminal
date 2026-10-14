#!/usr/bin/env python3
"""Backstop for derivs.yml (GitHub has dropped its schedule): decide from LIVE data/_runs.json last_run whether to dispatch it.
Prints one log line and writes dispatch=true|false to $GITHUB_OUTPUT. Env: SITE_URL, MAX_MIN (default 30), RUNS_JSON (local file, tests),
NOW (ISO, tests). Missing file, unreadable file or last_run null all count as overdue (dispatch), never as fresh."""
import datetime as d, json, os, sys, time, urllib.request
site = os.environ.get('SITE_URL', 'https://atenra-tech.github.io/rp-terminal/').rstrip('/') + '/'
lim = float(os.environ.get('MAX_MIN', '30'))
now = d.datetime.fromisoformat(os.environ['NOW'].replace('Z', '+00:00')) if os.environ.get('NOW') else d.datetime.now(d.timezone.utc)
try:
    R = json.load(open(os.environ['RUNS_JSON'])) if os.environ.get('RUNS_JSON') else json.load(urllib.request.urlopen(f"{site}data/_runs.json?v={int(time.time())}", timeout=30))
    lr = R.get('last_run')
except Exception as e:
    R, lr = None, None; why = f"live _runs.json unreadable ({str(e)[:100]})"
if lr:
    age = (now - d.datetime.fromisoformat(lr.replace('Z', '+00:00'))).total_seconds() / 60
    go = age >= lim; why = f"live _runs.json last_run {lr}, {age:.0f} min old (limit {lim:g} min)"
else:
    go = True
    if R is not None: why = "live _runs.json has no last_run"
msg = f"derivs backstop: {why} -> {'DISPATCH Refresh derivatives' if go else 'no dispatch'}"
print(("::warning title=Derivs backstop::" if go else "") + msg)
if os.environ.get('GITHUB_OUTPUT'):
    open(os.environ['GITHUB_OUTPUT'], 'a').write(f"dispatch={'true' if go else 'false'}\n")
if os.environ.get('GITHUB_STEP_SUMMARY'):
    open(os.environ['GITHUB_STEP_SUMMARY'], 'a').write(f"## Derivs backstop\n{msg}\n")
