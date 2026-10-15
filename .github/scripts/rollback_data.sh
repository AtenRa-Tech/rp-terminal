#!/usr/bin/env bash
# Rollback restores CODE only. Data: every data/ file from main HEAD (at rollback time), then any tracked file where LIVE is newer is taken from live;
# then the never-backwards check. Usage: rollback_data.sh <site_dir>   (site_dir already holds the last good commit's code)
set -euo pipefail
dir=$1
git fetch -q origin main
for f in $(git ls-tree -r --name-only FETCH_HEAD data/); do
  git show "FETCH_HEAD:$f" > "$dir/$f.new" && { case "$f" in *.json) python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$dir/$f.new";; esac; } && mv "$dir/$f.new" "$dir/$f" || rm -f "$dir/$f.new"
done
echo "rollback data from main HEAD $(git rev-parse --short FETCH_HEAD)"
python3 "$(dirname "$0")/no_regress.py" newest "$dir"
python3 "$(dirname "$0")/no_regress.py" check "$dir"
git show FETCH_HEAD:data/derivs.json > "$dir/.main-derivs.json"; python3 "$(dirname "$0")/publish_guard.py" "$dir/data/derivs.json" "$dir/.main-derivs.json"; rm -f "$dir/.main-derivs.json"
