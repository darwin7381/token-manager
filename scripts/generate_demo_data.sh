#!/bin/bash

# 生成演示數據 - 簡化版
# 直接使用固定的測試 hash 快速生成數據

echo "🎬 生成演示使用數據"
echo "===================="
echo ""

BACKEND_URL="http://localhost:8000"
API_ENDPOINT="$BACKEND_URL/api/usage-log"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 使用固定的測試 hash（會自動創建對應的 Token 記錄）
TOKENS=(
  "demo_token_hash_001"
  "demo_token_hash_002" 
  "demo_token_hash_003"
)

ROUTES=(
  "/api/openai"
  "/api/perplexity"
  "/api/cloudconvert"
  "/api/aws"
  "/api/internal"
)

METHODS=("GET" "POST" "PUT" "DELETE")

echo -e "${BLUE}步驟 1:${NC} 生成 200 條演示數據..."
echo -e "${YELLOW}提示:${NC} 這些數據使用固定的 demo hash，僅用於展示"
echo ""

# 生成函數
generate_usage() {
  local token_hash="${TOKENS[$((RANDOM % ${#TOKENS[@]}))]}"
  local route="${ROUTES[$((RANDOM % ${#ROUTES[@]}))]}"
  local method="${METHODS[$((RANDOM % ${#METHODS[@]}))]}"
  local status=$((RANDOM % 100 < 95 ? 200 : $((RANDOM % 100 < 50 ? 404 : 500))))
  local response_time=$((50 + RANDOM % 2000))
  
  # 隨機時間：最近 7 天內
  local hours_ago=$((RANDOM % 168))
  local timestamp=$(($(date +%s) * 1000 - hours_ago * 3600000))
  
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

# 生成 200 條數據
for i in {1..200}; do
  generate_usage
  # 每 20 條暫停一下，避免過載
  if [ $((i % 20)) -eq 0 ]; then
    sleep 0.1
  fi
done

echo ""
echo ""
echo -e "${GREEN}✅ 完成！已生成 200 條演示數據${NC}"
echo ""

echo -e "${BLUE}步驟 2:${NC} 驗證數據..."
sleep 1

RESPONSE=$(curl -s "$BACKEND_URL/api/usage/test-data")
COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])" 2>/dev/null || echo "?")

echo -e "${GREEN}✅ 資料庫中共有 $COUNT 條使用記錄${NC}"
echo ""

echo "===================="
echo -e "${GREEN}🎉 演示數據生成完成！${NC}"
echo ""
echo -e "${BLUE}下一步 - 訪問以下頁面查看效果:${NC}"
echo ""
echo "  1. API 使用分析（主頁面）:"
echo "     ${GREEN}http://localhost:5173/usage-analytics${NC}"
echo ""
echo "  2. Dashboard 總覽（已整合使用數據）:"
echo "     ${GREEN}http://localhost:5173/dashboard${NC}"
echo ""
echo "  3. Token 使用詳情（任選一個 Token ID）:"
echo "     ${GREEN}http://localhost:5173/token-usage/1${NC}"
echo ""
echo "  4. 路由使用統計:"
echo "     ${GREEN}http://localhost:5173/route-usage?path=/api/openai${NC}"
echo ""
echo "===================="
echo "✅ 所有頁面就緒，開始體驗吧！"
echo ""

