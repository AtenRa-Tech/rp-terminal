#!/usr/bin/env bash
# Before ANY deploy: copy the newest derivs.json/_runs.json from main HEAD (at deploy time) into the site folder, then refuse if older than live.
# Usage: newest_data.sh <site_dir>
set -euo pipefail
dir=$1
git fetch -q origin main
for f in data/derivs.json data/_runs.json; do
  if git cat-file -e "FETCH_HEAD:$f" 2>/dev/null; then git show "FETCH_HEAD:$f" > "$dir/$f.new"; python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$dir/$f.new" && mv "$dir/$f.new" "$dir/$f" || rm -f "$dir/$f.new"; fi
done
echo "data from main HEAD $(git rev-parse --short FETCH_HEAD) at $(date -u +%FT%TZ)"
python3 "$(dirname "$0")/no_regress.py" check "$dir"
