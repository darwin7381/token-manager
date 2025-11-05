#!/bin/bash

# Token 使用追蹤本地測試腳本
# 用於模擬 Worker 發送使用記錄到後端

echo "🧪 Token 使用追蹤測試"
echo "===================="
echo ""

# 配置
BACKEND_URL="http://localhost:8000"
API_ENDPOINT="$BACKEND_URL/api/usage-log"

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📍 測試目標:${NC} $API_ENDPOINT"
echo ""

# 測試 1: 獲取一個實際的 Token hash
echo -e "${BLUE}步驟 1:${NC} 獲取現有 Token 列表..."
echo ""

# 這裡需要 Clerk token，所以我們先手動創建測試數據
# 或者使用已知的 token_hash

# 測試用的 token_hash（你需要替換為實際的）
# 可以從資料庫查詢：SELECT token_hash, name FROM tokens LIMIT 1;

echo -e "${YELLOW}⚠️  請先手動獲取一個實際的 token_hash${NC}"
echo "方法 1: 查詢資料庫"
echo '  psql $DATABASE_URL -c "SELECT token_hash, name FROM tokens LIMIT 1;"'
echo ""
echo "方法 2: 創建一個測試 Token，從前端複製"
echo ""

# 模擬測試數據
TEST_HASH="test_hash_for_demo"
TEST_ROUTE="/api/perplexity"

echo -e "${BLUE}步驟 2:${NC} 發送使用記錄..."
echo ""

# 發送使用記錄
RESPONSE=$(curl -s -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"token_hash\": \"$TEST_HASH\",
    \"route\": \"$TEST_ROUTE\",
    \"timestamp\": $(date +%s)000
  }")

echo -e "${GREEN}✅ 後端響應:${NC} $RESPONSE"
echo ""

# 測試 2: 使用真實的 token_hash（如果提供）
if [ ! -z "$1" ]; then
    REAL_HASH="$1"
    echo -e "${BLUE}步驟 3:${NC} 使用真實 token_hash 測試..."
    echo "Token Hash: $REAL_HASH"
    echo ""
    
    RESPONSE2=$(curl -s -X POST "$API_ENDPOINT" \
      -H "Content-Type: application/json" \
      -d "{
        \"token_hash\": \"$REAL_HASH\",
        \"route\": \"/api/test\",
        \"timestamp\": $(date +%s)000
      }")
    
    echo -e "${GREEN}✅ 後端響應:${NC} $RESPONSE2"
    echo ""
    
    echo -e "${BLUE}步驟 4:${NC} 查詢該 Token 的 last_used 時間..."
    echo ""
    echo "請在前端 Token 列表中查看該 Token 的「最後使用」時間是否更新"
else
    echo -e "${YELLOW}💡 提示:${NC} 執行時可以提供 token_hash 作為參數："
    echo "  ./test_usage_tracking.sh <token_hash>"
fi

echo ""
echo "===================="
echo "✅ 測試完成"
echo ""
echo -e "${BLUE}下一步:${NC}"
echo "1. 在前端創建一個測試 Token"
echo "2. 複製該 Token 的 hash（或從資料庫查詢）"
echo "3. 執行: ./test_usage_tracking.sh <token_hash>"
echo "4. 刷新前端 Token 列表，查看 last_used 時間"

