#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$APP_DIR/infra/deploy/publish-yayanews.sh"
