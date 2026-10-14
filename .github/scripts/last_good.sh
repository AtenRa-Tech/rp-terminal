#!/usr/bin/env bash
# Newest commit that actually reached live green: the newest successful "CI and deploy" on main, or the newest "Fast publish" run whose
# smoke job succeeded (a fast run that handed over to the full CI is "success" but deployed nothing, so it does not count).
# Prints the sha (empty when none). Needs GH_TOKEN and GITHUB_REPOSITORY.
set -uo pipefail
R="$GITHUB_REPOSITORY"
{
  gh run list --repo "$R" --workflow ci.yml --branch main --status success -L 1 --json headSha,updatedAt -q '.[]|"\(.updatedAt) \(.headSha)"'
  for id in $(gh run list --repo "$R" --workflow publish-derivs.yml --status success -L 10 --json databaseId -q '.[].databaseId'); do
    if [ "$(gh run view "$id" --repo "$R" --json jobs -q '.jobs[]|select(.name=="smoke")|.conclusion')" = success ]; then
      gh run view "$id" --repo "$R" --json headSha,updatedAt -q '"\(.updatedAt) \(.headSha)"'; break
    fi
  done
} | python3 "$(dirname "$0")/publish_path.py" --pick
