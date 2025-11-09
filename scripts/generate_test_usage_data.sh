#!/bin/bash

# 生成測試使用數據腳本
# 用於在本地環境模擬 Worker 的使用記錄

echo "🧪 生成測試使用數據"
echo "===================="
echo ""

BACKEND_URL="http://localhost:8000"
API_ENDPOINT="$BACKEND_URL/api/usage-log"

# 顏色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 模擬的 token_hash（需要替換為真實的）
# 從資料庫獲取：psql $DATABASE_URL -c "SELECT token_hash, name FROM tokens LIMIT 3;"
TOKENS=(
  "hash1_replace_with_real"
  "hash2_replace_with_real" 
  "hash3_replace_with_real"
)

# 路由列表
ROUTES=(
  "/api/openai"
  "/api/perplexity"
  "/api/cloudconvert"
)

# HTTP 方法
METHODS=("GET" "POST" "PUT")

# 生成隨機數據
generate_random_usage() {
  local token_hash="${TOKENS[$((RANDOM % ${#TOKENS[@]}))]}"
  local route="${ROUTES[$((RANDOM % ${#ROUTES[@]}))]}"
  local method="${METHODS[$((RANDOM % ${#METHODS[@]}))]}"
  local status=$((RANDOM % 100 < 95 ? 200 : 500))  # 95% 成功率
  local response_time=$((50 + RANDOM % 1000))  # 50-1050ms
  local timestamp=$(($(date +%s) * 1000 - RANDOM % 86400000))  # 最近 24 小時內
  
  curl -s -X POST "$API_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "{
      \"token_hash\": \"$token_hash\",
      \"route\": \"$route\",
      \"timestamp\": $timestamp,
      \"response_status\": $status,
      \"response_time_ms\": $response_time,
      \"ip_address\": \"192.168.1.$((RANDOM % 255))\",
      \"user_agent\": \"n8n-workflow/1.0\",
      \"request_method\": \"$method\",
      \"error_message\": $([ $status -ge 400 ] && echo '\"API Error\"' || echo 'null')
    }" > /dev/null
  
  echo -ne "."
}

echo -e "${YELLOW}⚠️  請先更新腳本中的 TOKENS 陣列為真實的 token_hash${NC}"
echo ""
echo "獲取方式："
echo '  psql $DATABASE_URL -c "SELECT token_hash, name FROM tokens LIMIT 3;"'
echo ""
read -p "按 Enter 繼續（或 Ctrl+C 取消）... "
echo ""

echo -e "${BLUE}步驟 1:${NC} 生成 100 條測試數據..."
echo ""

for i in {1..100}; do
  generate_random_usage
done

echo ""
echo ""
echo -e "${GREEN}✅ 完成！已生成 100 條測試使用記錄${NC}"
echo ""

echo -e "${BLUE}步驟 2:${NC} 驗證數據..."
sleep 1

RESPONSE=$(curl -s "$BACKEND_URL/api/usage/test-data")
COUNT=$(echo "$RESPONSE" | uv run python -c "import sys, json; print(json.load(sys.stdin)['count'])" 2>/dev/null || echo "0")

echo -e "${GREEN}✅ 資料庫中共有 $COUNT 條使用記錄${NC}"
echo ""

echo "===================="
echo -e "${BLUE}下一步:${NC}"
echo "1. 訪問前端頁面: http://localhost:5173/usage-analytics"
echo "2. 查看 API 使用分析圖表"
echo "3. 檢查 Top Token 和 Top 路由列表"
echo ""
echo "✅ 測試完成"

