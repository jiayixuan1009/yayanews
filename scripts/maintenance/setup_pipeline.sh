#!/bin/bash
set -e

echo "=== Phase 4: Setting up Python Pipeline ==="

# 1. Create Python venv
echo "[1/5] Creating Python virtual environment..."
cd /var/www/yayanews/apps/pipeline
python3 -m venv .venv
echo "  venv created at $(pwd)/.venv"

# 2. Install requirements
echo "[2/5] Installing Python dependencies..."
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r requirements.txt -q
echo "  Dependencies installed"

# 3. Add ENABLE_PYTHON_WORKERS and PYTHON_BIN to .env
echo "[3/5] Configuring .env..."
cd /var/www/yayanews

# Check if already set
if grep -q "ENABLE_PYTHON_WORKERS" .env; then
    echo "  ENABLE_PYTHON_WORKERS already in .env, updating..."
    sed -i 's/ENABLE_PYTHON_WORKERS=.*/ENABLE_PYTHON_WORKERS=true/' .env
else
    echo "ENABLE_PYTHON_WORKERS=true" >> .env
fi

if grep -q "PYTHON_BIN" .env; then
    echo "  PYTHON_BIN already in .env, updating..."
    sed -i "s|PYTHON_BIN=.*|PYTHON_BIN=/var/www/yayanews/apps/pipeline/.venv/bin/python|" .env
else
    echo "PYTHON_BIN=/var/www/yayanews/apps/pipeline/.venv/bin/python" >> .env
fi

echo "  .env configured"

# 4. Verify Redis
echo "[4/5] Verifying Redis..."
redis-cli -a <REDACTED> ping 2>/dev/null || echo "Redis PING failed!"

# 5. Restart PM2
echo "[5/5] Restarting PM2 with all processes..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "=== PM2 Status ==="
pm2 list

echo ""
echo "=== Pipeline setup complete ==="
