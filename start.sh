#!/bin/bash
set -e

echo "🚀 Starting Token Manager Backend..."
echo "📝 Environment Check:"

# 檢查必要的環境變數
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set"
    exit 1
fi

echo "✅ DATABASE_URL is set"

# 可選的環境變數警告
if [ -z "$CLERK_SECRET_KEY" ]; then
    echo "⚠️  WARNING: CLERK_SECRET_KEY is not set"
fi

if [ -z "$TOKEN_ENCRYPTION_KEY" ]; then
    echo "⚠️  WARNING: TOKEN_ENCRYPTION_KEY is not set"
fi

if [ -z "$CF_ACCOUNT_ID" ]; then
    echo "⚠️  WARNING: CF_ACCOUNT_ID is not set"
fi

# 使用 PORT 環境變數，如果沒有則默認 8000
PORT=${PORT:-8000}
echo "🌐 Server will run on port: $PORT"

# 啟動 uvicorn
echo "🎬 Starting uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port "$PORT"

