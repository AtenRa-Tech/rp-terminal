#!/usr/bin/env python3
"""Refresh data slot gate (9 Nov ruling). data.yml is scheduled at :17 and :47 so GitHub, which drops most scheduled runs,
gets two chances an hour to start one; this gate keeps it to at most one real refresh an hour.

  refresh_slot.py <event> <schedule> <runs.json|->   prints go=true|false (and why) to stdout and $GITHUB_OUTPUT

go=false only for the two hourly schedules when main's data/_runs.json last_run (the last derivatives fetch) is under
SKIP_MIN minutes old. Dispatches, the daily 00:20 UTC batch and the weekly Thursday run always go. An unreadable or
missing runs log goes (fail open: a skipped fetch is worse than an extra one).
"""
import datetime as dt, json, os, sys
SKIP_MIN = 45
HOURLY = ("17 * * * *", "47 * * * *")


def decide(event, schedule, runs, now):
    if event != "schedule" or schedule not in HOURLY:
        return True, f"{event} '{schedule}': always runs"
    try:
        last = dt.datetime.fromisoformat(str(runs["last_run"]).replace("Z", "+00:00"))
    except Exception:
        return True, "last derivatives fetch unknown (runs log unreadable): runs"
    age = (now - last).total_seconds() / 60
    if age < SKIP_MIN:
        return False, f"derivatives fetched {age:.0f} min ago (< {SKIP_MIN}): skipping this slot, no fetch, no deploy"
    return True, f"derivatives fetched {age:.0f} min ago (>= {SKIP_MIN}): runs"


if __name__ == "__main__":
    ev, sch, src = sys.argv[1], sys.argv[2], sys.argv[3]
    try:
        runs = json.load(sys.stdin if src == "-" else open(src))
    except Exception:
        runs = {}
    go, why = decide(ev, sch, runs, dt.datetime.now(dt.timezone.utc))
    print(f"go={str(go).lower()}: {why}")
    o = os.environ.get("GITHUB_OUTPUT")
    if o:
        with open(o, "a") as f: f.write(f"go={str(go).lower()}\n")
