#!/usr/bin/env bash
# Root deployment entrypoint. Kept as a thin wrapper so existing docs/cron
# entries that reference ./deploy.sh continue to work, but the real logic
# (backup, health check, rollback) lives in infra/deploy/publish-yayanews.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REAL_SCRIPT="$SCRIPT_DIR/infra/deploy/publish-yayanews.sh"

if [[ ! -x "$REAL_SCRIPT" ]]; then
    if [[ -f "$REAL_SCRIPT" ]]; then
        chmod +x "$REAL_SCRIPT"
    else
        echo "FATAL: $REAL_SCRIPT not found." >&2
        exit 1
    fi
fi

echo "=========================================="
echo "  YayaNews Production Deploy (delegating)"
echo "  -> $REAL_SCRIPT"
echo "=========================================="

exec "$REAL_SCRIPT" "$@"
