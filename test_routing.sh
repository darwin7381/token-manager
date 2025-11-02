#!/bin/bash

# 路由重構測試腳本
# 測試所有路由是否正常響應

echo "🧪 開始測試路由重構..."
echo "================================"
echo ""

BASE_URL="http://localhost:5173"

# 測試函數
test_route() {
    local path=$1
    local name=$2
    
    echo -n "測試 $name ($path)... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path")
    
    if [ "$response" = "200" ]; then
        echo "✅ 通過 (HTTP $response)"
        return 0
    else
        echo "❌ 失敗 (HTTP $response)"
        return 1
    fi
}

# 測試計數器
total=0
passed=0

# 測試各個路由
echo "📍 測試主要路由:"
echo "--------------------------------"

routes=(
    "/|首頁"
    "/stats|統計分析"
    "/tokens|Token 管理"
    "/routes|路由管理"
    "/users|用戶管理"
    "/sign-in|登入頁面"
    "/sign-up|註冊頁面"
)

for route_info in "${routes[@]}"; do
    IFS='|' read -r path name <<< "$route_info"
    test_route "$path" "$name"
    total=$((total + 1))
    if [ $? -eq 0 ]; then
        passed=$((passed + 1))
    fi
done

echo ""
echo "📍 測試 404 處理:"
echo "--------------------------------"
test_route "/this-does-not-exist" "不存在的路徑"
total=$((total + 1))
if [ $? -eq 0 ]; then
    passed=$((passed + 1))
fi

echo ""
echo "================================"
echo "📊 測試結果總結:"
echo "--------------------------------"
echo "總測試數: $total"
echo "通過: $passed"
echo "失敗: $((total - passed))"
echo ""

if [ $passed -eq $total ]; then
    echo "🎉 所有路由測試通過！"
    exit 0
else
    echo "⚠️  部分測試失敗，請檢查上方輸出"
    exit 1
fi

