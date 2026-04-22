#!/bin/bash
DB="postgresql://yayanews_super:<REDACTED>@<REDACTED-IP>:5432/yayanews"

echo "=== Articles by lang+status ==="
psql "$DB" -t -c "SELECT lang, status, COUNT(*) FROM articles GROUP BY lang, status ORDER BY lang, status;"

echo "=== Flash News by lang ==="
psql "$DB" -t -c "SELECT lang, COUNT(*) FROM flash_news GROUP BY lang ORDER BY lang;"

echo "=== Latest EN article ==="
psql "$DB" -t -c "SELECT MAX(created_at) FROM articles WHERE lang='en' AND status='published';"

echo "=== Latest EN flash ==="
psql "$DB" -t -c "SELECT MAX(created_at) FROM flash_news WHERE lang='en';"
