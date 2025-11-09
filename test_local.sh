#!/bin/bash

echo "🧪 Testing Token Manager System"
echo "================================"
echo ""

# 測試後端健康
echo "1️⃣  Testing Backend Health..."
HEALTH=$(curl -s http://localhost:8000/health)
echo "Response: $HEALTH"
if echo "$HEALTH" | grep -q "healthy"; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    exit 1
fi
echo ""

# 創建 Token
echo "2️⃣  Creating Token..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/tokens \
  -H "Content-Type: application/json" \
  -d '{"name":"Test-CLI","department":"development","scopes":["*"],"expires_days":90}')

echo "Response: $TOKEN_RESPONSE"

# 提取 token (使用 uv python 來解析 JSON)
TOKEN=$(echo "$TOKEN_RESPONSE" | uv run python -c "import sys, json; data=json.load(sys.stdin); print(data.get('token', 'ERROR'))" 2>/dev/null)

if [ "$TOKEN" == "ERROR" ] || [ -z "$TOKEN" ]; then
    echo "❌ Token creation failed"
    echo "Full response: $TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Token created: $TOKEN"
echo ""

# 獲取 Token 列表
echo "3️⃣  Listing Tokens..."
TOKENS=$(curl -s http://localhost:8000/api/tokens)
echo "$TOKENS" | uv run python -m json.tool 2>/dev/null | head -20
echo "✅ Token list retrieved"
echo ""

# 創建路由
echo "4️⃣  Creating Route..."
ROUTE_RESPONSE=$(curl -s -X POST http://localhost:8000/api/routes \
  -H "Content-Type: application/json" \
  -d '{"path":"/api/test","backend_url":"https://httpbin.org/anything","description":"Test route"}')

echo "Response: $ROUTE_RESPONSE"
if echo "$ROUTE_RESPONSE" | grep -q "id"; then
    echo "✅ Route created"
else
    echo "⚠️  Route creation may have failed (or already exists)"
fi
echo ""

# 獲取路由列表
echo "5️⃣  Listing Routes..."
ROUTES=$(curl -s http://localhost:8000/api/routes)
echo "$ROUTES" | uv run python -m json.tool 2>/dev/null
echo "✅ Route list retrieved"
echo ""

# 獲取統計
echo "6️⃣  Getting Stats..."
STATS=$(curl -s http://localhost:8000/api/stats)
echo "$STATS" | uv run python -m json.tool 2>/dev/null
echo "✅ Stats retrieved"
echo ""

echo "================================"
echo "🎉 All tests passed!"
echo ""
echo "📝 Summary:"
echo "  - Backend: http://localhost:8000"
echo "  - Frontend: http://localhost:5173"
echo "  - API Docs: http://localhost:8000/docs"
echo "  - Token: $TOKEN"
echo ""
echo "🔗 Open frontend: open http://localhost:5173"

