#!/usr/bin/env bash
# merge-window.sh — phased merge window for AtenRa-Tech/rp-terminal (post to the room between phases).
#   merge-window.sh pause <pr> [--dry-run]  disable data.yml, arm detached 30-min auto-resume timer, wait in-flight runs, print PAUSED line, exit
#   merge-window.sh merge <pr>              update PR branch with main, full CI (waits only until the 30-min pause deadline; else resumes and defers), squash-merge, delete remote branch (needs an open window)
#   merge-window.sh resume [--dry-run]      re-enable both, dispatch both once, kill timer, print RESUMED line, close window
# --dry-run prints every gh write instead of running it (no merge, nothing disabled). One window at a time (state file + flock).
# Netlify timer and the 90-min alarm stay ON; their dispatches fail harmlessly while paused. Lines also go to /workspace/rpt/room-posts.txt.
set -uo pipefail
R=AtenRa-Tech/rp-terminal; ST=/workspace/rpt/.merge-window.state; LOG=/workspace/rpt/merge-window.log; POSTS=/workspace/rpt/room-posts.txt
CMD=${1:-}; shift || true; PR=""; DRY=0; for a in "$@"; do [ "$a" = --dry-run ] && DRY=1 || PR=$a; done
ts(){ date -u +%FT%H:%MZ; }; log(){ echo "$(ts) $*" | tee -a "$LOG"; }
w(){ if [ $DRY = 1 ]; then echo "DRY: $*"; else "$@"; fi; }
exec 9>/tmp/rpt-merge-window.lock; flock -n 9 || { log "LOCKED: another merge-window command is running"; exit 3; }
case "$CMD" in
pause)
  [ -n "$PR" ] || { echo "usage: $0 pause <pr> [--dry-run]"; exit 2; }
  [ -f "$ST" ] && { log "REFUSED: window already open ($(cat $ST))"; exit 3; }
  for x in data.yml; do w gh workflow disable $x -R $R || exit 1; done
  if [ $DRY = 0 ]; then
    DL=$(( $(date +%s) + ${MW_TIMER_SECS:-1800} ))
    nohup setsid -f /workspace/rpt/resume-timer.sh $DL "$ST" $PR >/dev/null 2>&1 </dev/null 9>&-
    sleep 1; TP=$(pgrep -nf "resume-timer.sh $DL") || { log "FAIL: auto-resume timer did not start; re-enabling"; for x in data.yml; do gh workflow enable $x -R $R; done; exit 1; }
    echo "pr=$PR timer=$TP at=$(ts) dl=$DL" > "$ST"
    for x in data.yml; do until [ "$(gh run list -R $R -w $x --json status -q '[.[]|select(.status!="completed")]|length')" = 0 ]; do sleep 20; done; done
  else echo "DRY: arm 30-min auto-resume timer; wait for in-flight data/derivs runs"; fi
  L="PAUSED $(ts): data.yml disabled for PR #$PR, in-flight runs done, auto-resume by $(date -u -d '+30 min' +%H:%MZ)"
  log "$L"; [ $DRY = 0 ] && echo "Merge window #$PR: $L" >> "$POSTS"; echo "$L";;
merge)
  [ -n "$PR" ] || { echo "usage: $0 merge <pr>"; exit 2; }; grep -q "pr=$PR " "$ST" 2>/dev/null || { log "REFUSED: no open window for #$PR (run pause first)"; exit 3; }
  BR=$(gh pr view $PR -R $R --json headRefName -q .headRefName); WT=/workspace/mw-$PR; rm -rf $WT
  git -C /workspace/gh/rp-terminal fetch -q origin && git -C /workspace/gh/rp-terminal worktree add -q -f $WT origin/$BR || exit 1
  cd $WT && git switch -q -C mw-$PR && git merge -q --no-edit origin/main && git push -q origin HEAD:$BR || { log "FAIL: update branch"; exit 1; }
  SHA=$(git rev-parse HEAD); log "branch $BR at ${SHA:0:7} (main $(git rev-parse --short origin/main))"
  RID=""; for i in $(seq 40); do sleep 10; RID=$(gh run list -R $R -w ci.yml --branch $BR --json databaseId,headSha -q "[.[]|select(.headSha==\"$SHA\")][0].databaseId"); [ -n "$RID" ] && break; done
  [ -n "$RID" ] || { log "FAIL: no CI run for ${SHA:0:7}"; exit 1; }
  # HARD 30-min pause cap (supervisor 15 Oct): CI may only be waited for until the pause deadline; then resume and defer the merge.
  END=$(sed -n 's/.* dl=\([0-9]*\).*/\1/p' "$ST"); [ -n "$END" ] || END=$(( $(date +%s) + 60 )); C=""; while [ $(date +%s) -lt $END ]; do C=$(gh run view $RID -R $R --json status,conclusion -q 'if .status=="completed" then .conclusion else "" end' 2>/dev/null); [ -n "$C" ] && break; sleep 30; done
  if [ -z "$C" ]; then log "DEFERRED #$PR: CI $RID not done at the 30-min pause cap; resuming now, merge in the next window"
    cd /; git -C /workspace/gh/rp-terminal worktree remove -f $WT; exec "$0" resume; fi
  log "CI $RID: $C"; [ "$C" = success ] || { log "CI failed: resuming"; exec "$0" resume; }
  gh pr merge $PR -R $R --squash --match-head-commit $SHA || { log "FAIL: merge"; exit 1; }
  M=$(gh pr view $PR -R $R --json mergeCommit -q .mergeCommit.oid); log "MERGED #$PR as ${M:0:7}"
  gh api -X DELETE repos/$R/git/refs/heads/$BR >/dev/null 2>&1 && log "deleted $BR"; cd /; git -C /workspace/gh/rp-terminal worktree remove -f $WT;;
resume)
  P=$(sed -n 's/^pr=\([^ ]*\).*/\1/p' "$ST" 2>/dev/null); T=$(sed -n 's/.*timer=\([0-9]*\).*/\1/p' "$ST" 2>/dev/null)
  for x in data.yml; do w gh workflow enable $x -R $R; w gh workflow run $x -R $R; done
  [ -n "$T" ] && w kill "$T" 2>/dev/null; [ $DRY = 0 ] && rm -f "$ST"
  L="RESUMED $(ts): data.yml enabled and dispatched once${P:+ (window for #$P closed)}"
  log "$L"; [ $DRY = 0 ] && echo "Merge window #${P:-?}: $L" >> "$POSTS"; echo "$L";;
timer-test)  # arms a detached 1-min timer that only writes a TIMER-TEST log line
  DL=$(( $(date +%s) + 60 )); nohup setsid -f /workspace/rpt/resume-timer.sh $DL /nonexistent 0 --test >/dev/null 2>&1 </dev/null 9>&-
  sleep 1; echo "timer-test armed pid $(pgrep -nf "resume-timer.sh $DL") fires $(date -u -d @$DL +%H:%M:%SZ)";;
*) echo "usage: $0 pause <pr> [--dry-run] | merge <pr> | resume [--dry-run]"; exit 2;;
esac
