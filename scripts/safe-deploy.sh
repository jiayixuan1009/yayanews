#!/usr/bin/env bash
# Compatibility wrapper for older runbooks.
# The production deploy logic lives in infra/deploy/publish-yayanews.sh.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REAL_SCRIPT="$APP_DIR/infra/deploy/publish-yayanews.sh"

if [ ! -x "$REAL_SCRIPT" ]; then
    chmod +x "$REAL_SCRIPT"
fi

exec "$REAL_SCRIPT" "$@"
