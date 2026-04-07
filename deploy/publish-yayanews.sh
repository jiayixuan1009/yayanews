#!/usr/bin/env bash
# publish-yayanews.sh — Server-side deployment script
# Called by GitHub Actions deploy.yml after git checkout on the VPS.
# Also used for manual updates: cd /var/www/yayanews && bash deploy/publish-yayanews.sh

set -euo pipefail

echo "📦 Installing Node.js dependencies..."
npm ci

echo "🐍 Installing Python dependencies..."
pip install -r apps/pipeline/requirements.txt

echo "🗄️ Updating Database Schema..."
npm run db:init || echo "⚠️ Database init skipped or failed."

echo "🔨 Building all workspaces..."
npm run build

echo "🔄 Reloading PM2 services..."
pm2 reload yayanews yaya-admin || true
pm2 restart yaya-pipeline-daemon yaya-worker-flash yaya-worker-articles yaya-finnhub-ws yaya-ws-gateway || true
pm2 save

echo "✅ Deployment complete."
