#!/usr/bin/env bash
# Newest commit that actually reached live green: the newest successful "CI and deploy" on main, or the newest "Refresh data" (data.yml) run
# whose smoke job succeeded (21 Oct: publishing is folded into data.yml). A data run's headSha is the commit the schedule started from, so the
# deployed data commit is read from the smoke job's "data-sha <sha>" step name. A run that pushed nothing has no smoke job and does not count.
# Prints the sha (empty when none). Needs GH_TOKEN and GITHUB_REPOSITORY.
set -uo pipefail
R="$GITHUB_REPOSITORY"
{
  gh run list --repo "$R" --workflow ci.yml --branch main --status success -L 1 --json headSha,updatedAt -q '.[]|"\(.updatedAt) \(.headSha)"'
  for id in $(gh run list --repo "$R" --workflow data.yml --status success -L 10 --json databaseId -q '.[].databaseId'); do
    j=$(gh run view "$id" --repo "$R" --json jobs,updatedAt) || continue
    if [ "$(printf '%s' "$j" | python3 -c "import json,sys;print(next((x['conclusion'] for x in json.load(sys.stdin)['jobs'] if x['name']=='smoke'),''))")" = success ]; then
      printf '%s' "$j" | python3 -c "import json,sys;J=json.load(sys.stdin);s=next((st['name'].split()[1] for x in J['jobs'] if x['name']=='smoke' for st in x.get('steps',[]) if st['name'].startswith('data-sha ')),'');print(J['updatedAt'],s) if s else None"; break
    fi
  done
} | python3 "$(dirname "$0")/publish_path.py" --pick
