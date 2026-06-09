#!/usr/bin/env bash
set -euo pipefail

DEFAULT_APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
SNAPSHOT_ROOT="${SNAPSHOT_ROOT:-$APP_DIR/infra/backups/worktree}"
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"

if ! git -C "$APP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf 'FATAL: %s is not a git worktree\n' "$APP_DIR" >&2
    exit 1
fi

COMMIT="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
BRANCH="$(git -C "$APP_DIR" branch --show-current 2>/dev/null || echo detached)"
SAFE_BRANCH="$(printf '%s' "$BRANCH" | tr -c 'A-Za-z0-9._-' '_')"
SNAPSHOT_DIR="$SNAPSHOT_ROOT/${TIMESTAMP}_${SAFE_BRANCH}_${COMMIT}"

mkdir -p "$SNAPSHOT_DIR"

git -C "$APP_DIR" status --short > "$SNAPSHOT_DIR/status.short.txt"
git -C "$APP_DIR" status --branch --short > "$SNAPSHOT_DIR/status.branch.txt"
git -C "$APP_DIR" diff --binary > "$SNAPSHOT_DIR/tracked.diff"
git -C "$APP_DIR" diff --stat > "$SNAPSHOT_DIR/tracked.stat.txt"
git -C "$APP_DIR" ls-files --others --exclude-standard > "$SNAPSHOT_DIR/untracked-files.txt"
git -C "$APP_DIR" rev-parse HEAD > "$SNAPSHOT_DIR/head.txt"

cat > "$SNAPSHOT_DIR/README.txt" <<EOF
YayaNews production worktree snapshot

Created: $TIMESTAMP
Branch: $BRANCH
Commit: $COMMIT

Files:
- status.short.txt: concise dirty worktree status
- status.branch.txt: branch-aware status
- tracked.diff: binary-safe patch for tracked files only
- tracked.stat.txt: tracked diff summary
- untracked-files.txt: untracked file list only; file contents are not copied
- head.txt: full HEAD SHA

Ignored files such as .env, credentials, logs, backups, node_modules, and build
artifacts are intentionally not captured.
EOF

printf '%s\n' "$SNAPSHOT_DIR"
