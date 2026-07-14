#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE_CONFIG="${1:-$APP_DIR/infra/nginx/yayanews.conf}"
TARGET_CONFIG="${YAYANEWS_NGINX_TARGET:-/etc/nginx/sites-available/yayanews}"
BACKUP_DIR="${YAYANEWS_NGINX_BACKUP_DIR:-/var/backups/yayanews-nginx}"
TIMESTAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
BACKUP_CONFIG="$BACKUP_DIR/yayanews.$TIMESTAMP.conf"
TARGET_EXISTED=0
INSTALLED=0

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run as root: sudo bash infra/scripts/install-yayanews-nginx.sh" >&2
  exit 1
fi

if [ ! -f "$SOURCE_CONFIG" ]; then
  echo "Source Nginx config not found: $SOURCE_CONFIG" >&2
  exit 1
fi

command -v nginx >/dev/null 2>&1 || {
  echo "nginx is not installed or not on PATH." >&2
  exit 1
}
command -v systemctl >/dev/null 2>&1 || {
  echo "systemctl is required to reload Nginx." >&2
  exit 1
}

if [ -f "$TARGET_CONFIG" ] && cmp -s "$SOURCE_CONFIG" "$TARGET_CONFIG"; then
  nginx -t
  echo "Nginx configuration is already current: $TARGET_CONFIG"
  exit 0
fi

mkdir -p "$BACKUP_DIR"
if [ -f "$TARGET_CONFIG" ]; then
  TARGET_EXISTED=1
  cp -a "$TARGET_CONFIG" "$BACKUP_CONFIG"
fi

rollback() {
  local exit_code="$?"
  if [ "$INSTALLED" -eq 1 ]; then
    echo "Nginx install failed; restoring previous configuration." >&2
    if [ "$TARGET_EXISTED" -eq 1 ]; then
      cp -a "$BACKUP_CONFIG" "$TARGET_CONFIG"
    else
      rm -f -- "$TARGET_CONFIG"
    fi
    nginx -t || true
    systemctl reload nginx || true
  fi
  exit "$exit_code"
}
trap rollback ERR

install -m 0644 "$SOURCE_CONFIG" "$TARGET_CONFIG"
INSTALLED=1
nginx -t
systemctl reload nginx

trap - ERR
echo "Installed: $TARGET_CONFIG"
if [ "$TARGET_EXISTED" -eq 1 ]; then
  echo "Backup: $BACKUP_CONFIG"
fi
echo "Access log: /var/log/nginx/yayanews.access.log"
