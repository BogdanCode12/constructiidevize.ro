#!/bin/bash
# Rulat din cron pe cPanel (ex: la fiecare 5 minute).
# Preia ultimul build din ramura `release` (creată de GitHub Actions) și repornește aplicația Node.
#
#   */5 * * * * /bin/bash $HOME/constructiidevize-release/scripts/cpanel-deploy.sh >> $HOME/logs/deploy.log 2>&1
#
# Prima publicare: rulează scriptul o dată de mână, din Terminal.
set -euo pipefail

RELEASE_DIR="${RELEASE_DIR:-$HOME/constructiidevize-release}"   # clona git a ramurii `release`
APP_DIR="${APP_DIR:-$HOME/constructiidevize}"                    # „Application root” din Setup Node.js App
BRANCH="${BRANCH:-release}"

exec 9>"$HOME/.constructiidevize-deploy.lock"
flock -n 9 || exit 0   # o singură rulare odată

cd "$RELEASE_DIR"
git fetch -q origin "$BRANCH"
git reset -q --hard FETCH_HEAD
SHA="$(git rev-parse HEAD)"

# Publicăm doar dacă build-ul diferă de cel instalat deja în aplicație.
if [ -f "$APP_DIR/.deployed" ] && [ "$(cat "$APP_DIR/.deployed")" = "$SHA" ]; then
  exit 0
fi

mkdir -p "$APP_DIR"
rsync -a --delete \
  --exclude ".git" --exclude ".env" --exclude ".htaccess" --exclude "tmp/" --exclude "stderr.log" --exclude ".deployed" \
  "$RELEASE_DIR"/ "$APP_DIR"/

# Node-ul din „Setup Node.js App” nu e în PATH-ul cron-ului: îl căutăm.
NODE_BIN="${NODE_BIN:-}"
if [ -z "$NODE_BIN" ]; then
  for c in "$HOME"/nodevenv/*/22/bin/node /opt/alt/alt-nodejs22/root/usr/bin/node "$HOME"/nodevenv/*/20/bin/node /opt/alt/alt-nodejs20/root/usr/bin/node "$(command -v node || true)"; do
    if [ -n "$c" ] && [ -x "$c" ]; then NODE_BIN="$c"; break; fi
  done
fi

# Migrările noi de bază de date (citesc variabilele din .env-ul aplicației)
if [ -f "$APP_DIR/.env" ] && [ -n "$NODE_BIN" ]; then
  (cd "$APP_DIR" && "$NODE_BIN" scripts/migrate.mjs) || echo "ATENȚIE: migrarea a eșuat"
else
  echo "ATENȚIE: migrările nu au rulat (lipsește $APP_DIR/.env sau node)"
fi

# Repornire Passenger (aplicațiile din „Setup Node.js App”)
mkdir -p "$APP_DIR/tmp" && touch "$APP_DIR/tmp/restart.txt"
echo "$SHA" > "$APP_DIR/.deployed"
echo "$(date '+%F %T') publicat ${SHA:0:7}"
