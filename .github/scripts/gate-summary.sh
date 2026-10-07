#!/usr/bin/env bash
# Watchdog item 1. Usage: gate-summary.sh "<job label>"  (run with if: failure()).
# Reads every gate log in $RUNNER_TEMP/gates/*.log, emits one ::error annotation per failing line and writes them to the job summary,
# so a blocked deploy (above all a data redeploy that leaves live data frozen) says exactly which gate and which line stopped it.
d="${RUNNER_TEMP:-/tmp}/gates"; lbl="${1:-CI}"; S="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
{ echo "## $lbl: blocked"; if [ "${DATA_REDEPLOY:-false}" = "true" ]; then echo "**Data redeploy: the live site keeps its old data until this gate passes.**"; fi; } >> "$S"
shopt -s nullglob; logs=("$d"/*.log); found=0
for f in "${logs[@]}"; do g=$(basename "$f" .log)
  lines=$(grep -E '^ ?FAIL |FAILS: [1-9]|[1-9][0-9]* blocking failures|[0-9]+ images, [1-9][0-9]* fail|^Error|Process completed with exit code [1-9]' "$f" | head -40)
  [ -z "$lines" ] && continue; found=1
  { echo "### $g"; echo '```'; echo "$lines"; echo '```'; } >> "$S"
  while IFS= read -r l; do e=${l//'%'/'%25'}; e=${e//$'\r'/}; echo "::error title=$lbl gate: $g::$e"; done <<< "$lines"
done
if [ $found = 0 ]; then echo "::error title=$lbl::failed outside the logged gates (see the step log)"; echo "No gate log had a FAIL line; the failure is in another step." >> "$S"; fi
exit 0
