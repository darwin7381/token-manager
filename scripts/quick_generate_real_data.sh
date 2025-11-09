#!/bin/bash

# 快速生成真實使用數據
# 通過 API 獲取真實 Token 和路由，然後生成使用記錄

echo "🎬 生成真實使用數據"
echo "=" * 50
echo ""

BACKEND_URL="http://localhost:8000"

# 獲取 Clerk token（從環境變數或提示輸入）
if [ -z "$CLERK_TOKEN" ]; then
    echo "⚠️  需要 Clerk Token 來獲取 Token 和路由列表"
    echo ""
    echo "獲取方式："
    echo "1. 在瀏覽器訪問 http://localhost:5173"
    echo "2. 打開 DevTools → Network tab"
    echo "3. 刷新頁面，找到任意 API 請求"
    echo "4. 複製 Authorization header 中的 Bearer token"
    echo ""
    read -p "請輸入 Clerk Token（或按 Enter 使用簡化方案）: " CLERK_TOKEN
fi

if [ -z "$CLERK_TOKEN" ]; then
    echo ""
    echo "📝 使用簡化方案：手動指定 Token hash 和路由"
    echo ""
    echo "請執行以下命令獲取真實數據："
    echo ""
    echo "# 獲取 Token hash"
    echo 'curl -s http://localhost:8000/api/tokens -H "Authorization: Bearer YOUR_TOKEN" | uv run python -m json.tool | grep token_hash'
    echo ""
    echo "# 獲取路由"
    echo 'curl -s http://localhost:8000/api/routes -H "Authorization: Bearer YOUR_TOKEN" | uv run python -m json.tool | grep path'
    echo ""
    exit 1
fi

echo ""
echo "📊 獲取真實 Token 列表..."
TOKENS_JSON=$(curl -s "$BACKEND_URL/api/tokens" -H "Authorization: Bearer $CLERK_TOKEN")

# 提取 token_hash（需要從 tokens 表直接獲取，因為 API 不返回 hash）
echo "⚠️  Token API 不返回 hash（安全考慮）"
echo "請提供真實的 token_hash（用逗號分隔）："
echo ""
echo "獲取方式："
echo "從前端 Token 列表中，找到 Token ID，然後："
echo '  - Token ID 1 的 hash 需要查資料庫'
echo '  - 或使用測試 Token'
echo ""

read -p "Token hashes（逗號分隔）: " TOKEN_HASHES_INPUT
IFS=',' read -ra TOKEN_HASHES <<< "$TOKEN_HASHES_INPUT"

echo ""
echo "🛣️  獲取真實路由列表..."
ROUTES_JSON=$(curl -s "$BACKEND_URL/api/routes" -H "Authorization: Bearer $CLERK_TOKEN")
ROUTE_PATHS=($(echo "$ROUTES_JSON" | uv run python -c "import sys, json; [print(r['path']) for r in json.load(sys.stdin)]" 2>/dev/null))

if [ ${#ROUTE_PATHS[@]} -eq 0 ]; then
    echo "❌ 沒有找到路由"
    exit 1
fi

echo "✅ 找到 ${#ROUTE_PATHS[@]} 個路由:"
for r in "${ROUTE_PATHS[@]}"; do
    echo "   - $r"
done
echo ""

# 生成數據
echo "🚀 生成 200 條使用記錄..."
echo ""

METHODS=("GET" "POST" "PUT" "DELETE")

for i in {1..200}; do
    # 隨機選擇
    TOKEN_HASH=${TOKEN_HASHES[$((RANDOM % ${#TOKEN_HASHES[@]}))]}
    ROUTE_PATH=${ROUTE_PATHS[$((RANDOM % ${#ROUTE_PATHS[@]}))]}
    METHOD=${METHODS[$((RANDOM % 4))]}
    
    # 95% 成功率
    if [ $((RANDOM % 100)) -lt 95 ]; then
        STATUS=200
        ERROR_MSG="null"
    else
        STATUS=$((RANDOM % 2 == 0 ? 404 : 500))
        ERROR_MSG='"API Error"'
    fi
    
    # 響應時間
    RESPONSE_TIME=$((50 + RANDOM % 2000))
    
    # 時間戳（最近 7 天）
    HOURS_AGO=$((RANDOM % 168))
    TIMESTAMP=$(($(date +%s) * 1000 - HOURS_AGO * 3600000))
    
    # IP
    IP="192.168.1.$((RANDOM % 254 + 1))"
    
    # 發送
    curl -s -X POST "$BACKEND_URL/api/usage-log" \
        -H "Content-Type: application/json" \
        -d "{
            \"token_hash\": \"$TOKEN_HASH\",
            \"route\": \"$ROUTE_PATH\",
            \"timestamp\": $TIMESTAMP,
            \"response_status\": $STATUS,
            \"response_time_ms\": $RESPONSE_TIME,
            \"ip_address\": \"$IP\",
            \"user_agent\": \"n8n-workflow/1.0\",
            \"request_method\": \"$METHOD\",
            \"error_message\": $ERROR_MSG
        }" > /dev/null
    
    echo -n "."
    
    # 每 20 條暫停
    if [ $((i % 20)) -eq 0 ]; then
        sleep 0.05
    fi
done

echo ""
echo ""
echo "✅ 完成！"
echo ""

# 驗證
RESPONSE=$(curl -s "$BACKEND_URL/api/usage/test-data")
COUNT=$(echo "$RESPONSE" | uv run python -c "import sys, json; print(json.load(sys.stdin)['count'])" 2>/dev/null)

echo "📊 資料庫中共有 $COUNT 條使用記錄"
echo ""
echo "🎉 真實數據生成完成！"
echo ""
echo "現在訪問前端查看效果！"

