#!/bin/bash
# Rulat din cron pe cPanel, la fiecare minut:
#   * * * * * /bin/bash $HOME/constructiidevize/.deploy/unpack.sh >> $HOME/constructiidevize-deploy.log 2>&1
#
# GitHub Actions urcă prin FTP arhiva build-ului în .deploy/deploy.zip (și acest script în .deploy/unpack.sh).
# Scriptul o despachetează peste aplicație, păstrând .env, tmp/ și .deploy/, apoi repornește aplicația.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/constructiidevize}"
D="$APP_DIR/.deploy"
[ -f "$D/deploy.zip" ] || exit 0

exec 9>"$D/.lock"
flock -n 9 || exit 0   # o singură rulare odată

mv -f "$D/deploy.zip" "$D/work.zip"
rm -rf "$D/new"
mkdir -p "$D/new"
if command -v unzip >/dev/null 2>&1; then
  unzip -q -o "$D/work.zip" -d "$D/new"
else
  python3 -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$D/work.zip" "$D/new"
fi
[ -f "$D/new/server.js" ] || { echo "$(date '+%F %T') EROARE: arhivă incompletă, nu am publicat"; rm -rf "$D/new" "$D/work.zip"; exit 1; }

KEEP=(.env .deploy tmp stderr.log .htaccess)
if command -v rsync >/dev/null 2>&1; then
  EXC=(); for k in "${KEEP[@]}"; do EXC+=(--exclude "/$k"); done
  rsync -a --delete "${EXC[@]}" "$D/new"/ "$APP_DIR"/
else
  shopt -s dotglob nullglob
  for f in "$APP_DIR"/*; do
    b="$(basename "$f")"; skip=0
    for k in "${KEEP[@]}"; do [ "$b" = "$k" ] && skip=1; done
    [ $skip = 1 ] || rm -rf "$f"
  done
  cp -a "$D/new"/. "$APP_DIR"/
fi

mkdir -p "$APP_DIR/tmp" && touch "$APP_DIR/tmp/restart.txt"   # repornire Passenger
rm -rf "$D/new" "$D/work.zip"
echo "$(date '+%F %T') publicat $(cat "$APP_DIR/BUILD_SHA" 2>/dev/null | cut -c1-7)"
