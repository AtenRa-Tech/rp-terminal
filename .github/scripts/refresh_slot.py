#!/usr/bin/env python3
"""Refresh data slot gate (9 Nov ruling). data.yml is scheduled at :17 and :47 so GitHub, which drops most scheduled runs,
gets two chances an hour to start one; this gate keeps it to at most one real refresh an hour.

  refresh_slot.py <event> <schedule> <runs.json|->   prints go=true|false (and why) to stdout and $GITHUB_OUTPUT

go=false only for the two hourly schedules when main's data/_runs.json last_run (the last derivatives fetch) is under
SKIP_MIN minutes old. Dispatches, the daily 00:20 UTC batch and the weekly Thursday run always go. An unreadable or
missing runs log goes (fail open: a skipped fetch is worse than an extra one). 11 Nov: a slot also goes when the daily batch has
not run since the latest 00:20 UTC slot (GitHub dropped it), and data.yml's plan then runs the batch (--batch-due).
"""
import datetime as dt, json, os, sys
SKIP_MIN = 45
BATCH_UTC = (0, 20)  # the daily batch slot (data.yml '20 0 * * *')
HOURLY = ("17 * * * *", "47 * * * *")


def _t(x):
    return dt.datetime.fromisoformat(str(x).replace("Z", "+00:00"))


def batch_due(checked, now):
    """11 Nov: the daily batch is due when the oldest of macro/etf checked_at is before the latest 00:20 UTC slot, so the first hourly
    run (:17 or :47) after a dropped 00:20 run does it, instead of waiting for the 26h catch-up. Unknown -> due."""
    slot = now.replace(hour=BATCH_UTC[0], minute=BATCH_UTC[1], second=0, microsecond=0)
    if now < slot:
        slot -= dt.timedelta(days=1)
    try:
        return min(_t(c) for c in checked) < slot
    except Exception:
        return True


def decide(event, schedule, runs, now, checked=None):
    if event != "schedule" or schedule not in HOURLY:
        return True, f"{event} '{schedule}': always runs"
    if checked is not None and batch_due(checked, now):
        return True, "daily batch not done since the last 00:20 UTC slot: runs (catch-up)"
    try:
        last = dt.datetime.fromisoformat(str(runs["last_run"]).replace("Z", "+00:00"))
    except Exception:
        return True, "last derivatives fetch unknown (runs log unreadable): runs"
    age = (now - last).total_seconds() / 60
    if age < SKIP_MIN:
        return False, f"derivatives fetched {age:.0f} min ago (< {SKIP_MIN}): skipping this slot, no fetch, no deploy"
    return True, f"derivatives fetched {age:.0f} min ago (>= {SKIP_MIN}): runs"


def checked_at(paths):
    out = []
    for p in paths:
        j = json.load(open(p))
        out.append(j.get("checked_at") or j["updated"])
    return out


if __name__ == "__main__":
    if sys.argv[1] == "--batch-due":  # refresh_slot.py --batch-due data/macro.json data/etf.json -> true|false
        try:
            c = checked_at(sys.argv[2:])
        except Exception:
            c = []
        print(str(batch_due(c, dt.datetime.now(dt.timezone.utc))).lower()); sys.exit(0)
    ev, sch, src = sys.argv[1], sys.argv[2], sys.argv[3]
    try:
        runs = json.load(sys.stdin if src == "-" else open(src))
    except Exception:
        runs = {}
    chk = None
    if len(sys.argv) > 4:  # macro.json / etf.json from main, already fetched by the slot job
        try:
            chk = checked_at(sys.argv[4:])
        except Exception:
            chk = []
    go, why = decide(ev, sch, runs, dt.datetime.now(dt.timezone.utc), chk)
    print(f"go={str(go).lower()}: {why}")
    o = os.environ.get("GITHUB_OUTPUT")
    if o:
        with open(o, "a") as f: f.write(f"go={str(go).lower()}\n")
