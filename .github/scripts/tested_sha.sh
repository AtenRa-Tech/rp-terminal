#!/usr/bin/env bash
# The LAST commit whose code passed `test` AND the live smoke: tag refs/tags/pages-tested (moved only by ci.yml smoke on success).
# Durable across dropped/cancelled runs. Bootstrap (no tag yet): newest good deploy from last_good.sh. Prints the sha, empty if none.
set -uo pipefail
s=$(git ls-remote origin refs/tags/pages-tested 2>/dev/null | awk '{print $1}')
if [ -z "$s" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then s=$(bash "$(dirname "$0")/last_good.sh" 2>/dev/null); fi
echo "$s"
