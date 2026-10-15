#!/usr/bin/env bash
# resume-timer.sh <deadline_epoch> <statefile> <pr> [--test]  — detached auto-resume for merge-window.sh.
# Runs in its own session (setsid -f), stdin/out closed, polls a wall-clock deadline (survives sleep drift), gh auth from ~/.config/gh/hosts.yml.
DL=$1; ST=$2; PR=$3; T=${4:-}; R=AtenRa-Tech/rp-terminal; LOG=/workspace/rpt/merge-window.log; POSTS=/workspace/rpt/room-posts.txt
export HOME=${HOME:-/home/box} PATH=/usr/local/bin:/usr/bin:/bin:$PATH
trap '' HUP
while [ "$(date +%s)" -lt "$DL" ]; do sleep 15; done
if [ "$T" = --test ]; then echo "$(date -u +%FT%H:%M:%SZ) TIMER-TEST fired (pid $$, no gh calls)" >> $LOG; exit 0; fi
[ -f "$ST" ] || exit 0
ok=1; for x in data.yml derivs.yml; do for i in 1 2 3; do gh workflow enable $x -R $R && break; sleep 20; done || ok=0; gh workflow run $x -R $R || ok=0; done
[ $ok = 1 ] && rm -f "$ST"
L="$(date -u +%FT%H:%MZ) RESUMED by 30-min timer: data.yml + derivs.yml enabled and dispatched (ok=$ok)"; echo "$L" >> $LOG; echo "Merge window #$PR: $L" >> $POSTS
