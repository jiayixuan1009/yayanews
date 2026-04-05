#!/bin/bash
# scripts/safe-deploy.sh
# ---------------------------------------------------------
# A memory-safe deployment script for low-tier instances.
# Prevents NodeJS build-time OOM by stopping the PM2 process
# before kicking off the intensive NextJS webpack compilation.
# ---------------------------------------------------------

set -e

# Change to the application root directory
cd /var/www/yayanews || { echo "Directory /var/www/yayanews does not exist. Aborting."; exit 1; }

echo "[1/5] Fetching latest changes..."
git fetch
git reset --hard origin/main

echo "[2/5] Stopping PM2 container 'yayanews' to free RAM..."
pm2 stop yayanews || echo "Warning: Could not stop yayanews (maybe it's already stopped)"

echo "[3/5] Cleaning out old build artifacts..."
rm -rf apps/web/.next

echo "[4/5] Installing dependencies and executing safe build..."
npm install --include=dev
npm run build -w @yayanews/web

echo "[5/5] Build SUCCESS. Restarting production server..."
pm2 restart yayanews

echo "Done! The production server is back online."
