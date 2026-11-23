#!/bin/bash
# Rulat din cron pe cPanel (ex: la fiecare 5 minute).
# Preia ultimul build din ramura `release` (creată de GitHub Actions) și repornește aplicația Node.
#
#   */5 * * * * /bin/bash $HOME/constructiidevize-release/scripts/cpanel-deploy.sh >> $HOME/logs/deploy.log 2>&1
set -euo pipefail

RELEASE_DIR="${RELEASE_DIR:-$HOME/constructiidevize-release}"   # clona git a ramurii `release`
APP_DIR="${APP_DIR:-$HOME/constructiidevize}"                    # „Application root” din Setup Node.js App
BRANCH="${BRANCH:-release}"

exec 9>"$HOME/.constructiidevize-deploy.lock"
flock -n 9 || exit 0   # o singură rulare odată

cd "$RELEASE_DIR"
git fetch -q origin "$BRANCH"
if [ "$(git rev-parse HEAD)" = "$(git rev-parse FETCH_HEAD)" ]; then
  exit 0   # nimic nou
fi
git reset -q --hard FETCH_HEAD

mkdir -p "$APP_DIR"
rsync -a --delete \
  --exclude ".git" --exclude ".env" --exclude ".htaccess" --exclude "tmp/" --exclude "stderr.log" \
  "$RELEASE_DIR"/ "$APP_DIR"/

# Migrările noi de bază de date (citesc variabilele din .env-ul aplicației, dacă există)
if [ -f "$APP_DIR/.env" ]; then
  (cd "$APP_DIR" && node scripts/migrate.mjs) || echo "ATENȚIE: migrarea a eșuat"
fi

# Repornire Passenger (aplicațiile din „Setup Node.js App”)
mkdir -p "$APP_DIR/tmp" && touch "$APP_DIR/tmp/restart.txt"
echo "$(date '+%F %T') publicat $(git rev-parse --short HEAD)"
