#!/usr/bin/env bash
# Pulls the latest master and rebuilds what changed. Run at boot (veritrace-update.service)
# and by the GitHub deploy workflow (.github/workflows/deploy.yml). If the pull or the
# build fails, the containers already running keep serving the previous version.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

# The boot update and a deploy from GitHub can overlap; the second one waits.
exec 9>"/tmp/veritrace-update.lock"
flock 9

cd "$ROOT"
before="$(git rev-parse HEAD)"
git fetch --quiet origin master
git merge --ff-only --quiet origin/master
after="$(git rev-parse HEAD)"

if [[ "$before" == "$after" ]] && [[ "${1:-}" != "--force" ]]; then
  echo "Already at $(git log -1 --format='%h %s'); nothing to rebuild."
  exit 0
fi
echo "Updating to $(git log -1 --format='%h %s')"
# The site address stays as setup.sh first wrote it.
site="$(sed -n 's/^SITE_ADDRESS=//p' "$HERE/.env" 2>/dev/null)"
exec "$HERE/setup.sh" ${site:+"$site"}
