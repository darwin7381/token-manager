# Token 使用追蹤與分析系統完整指南

**版本**: v2.8  
**最後更新**: 2025-11-08  
**狀態**: ✅ 完整實施

---

## 🎯 系統核心價值

Token Manager 不只是 CRUD 系統，更是 **API 使用監控和分析平台**。

使用追蹤的價值：
- 📊 **可見性**：知道哪些 API 被頻繁調用
- ⏱️ **性能監控**：追蹤響應時間，識別慢查詢
- ✅ **可靠性**：監控成功率和錯誤率
- 💰 **成本優化**：識別熱點 API，優化資源
- 🔒 **安全審計**：異常使用檢測，防止濫用

---

## 🏗️ 架構設計

### 數據流向

```
n8n Workflow
    ↓ HTTP Request (X-API-Key: ntk_xxx)
Cloudflare Worker
    ├─→ 1. 驗證 Token（從 KV 讀取）
    ├─→ 2. 檢查 Scopes 權限
    ├─→ 3. 添加後端認證
    ├─→ 4. 計時開始
    ├─→ 5. 轉發到後端微服務
    ├─→ 6. 計時結束
    ├─→ 7. 返回響應給 n8n
    └─→ 8. ctx.waitUntil(異步記錄) ← 不阻塞主請求
           ↓
        POST https://tapi.blocktempo.ai/api/usage-log
           ↓
        {
          token_hash,
          route,
          timestamp,
          response_status,      // HTTP 狀態碼
          response_time_ms,     // 響應時間
          ip_address,
          user_agent,
          request_method,
          error_message
        }
           ↓
        Token Manager Backend
           ↓
        1. UPDATE tokens SET last_used = NOW()
        2. INSERT INTO token_usage_logs (...)
           ↓
        PostgreSQL 數據庫
           ↓
        前端頁面查詢和展示
```

### 為什麼用 ctx.waitUntil()

```javascript
// ✅ 正確：使用 ctx.waitUntil()
const response = await fetch(backendRequest);

ctx.waitUntil(
  logTokenUsage(tokenHash, matchedPath, env)
);

return response;  // 立即返回，不等待記錄完成
```

**優點**：
- ✅ 不阻塞主請求（API 性能不受影響）
- ✅ 確保異步任務完成（Worker 等待執行）
- ✅ 失敗不影響主流程（catch 錯誤）
- ✅ 不消耗 KV 寫入配額（存 PostgreSQL）

---

## 🗄️ 數據存儲

### token_usage_logs 表結構

```sql
CREATE TABLE token_usage_logs (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL,
    route_path VARCHAR(255),
    used_at TIMESTAMP NOT NULL,
    response_status INTEGER,           -- HTTP 狀態碼
    response_time_ms INTEGER,          -- 響應時間（毫秒）
    ip_address VARCHAR(45),            -- 來源 IP
    user_agent TEXT,                   -- User-Agent
    request_method VARCHAR(10),        -- GET/POST/PUT/DELETE
    error_message TEXT                 -- 錯誤訊息
);

-- 索引優化
CREATE INDEX idx_usage_token_hash ON token_usage_logs(token_hash);
CREATE INDEX idx_usage_used_at ON token_usage_logs(used_at DESC);
CREATE INDEX idx_usage_route ON token_usage_logs(route_path);
CREATE INDEX idx_usage_composite ON token_usage_logs(token_hash, used_at DESC);
```

---

## 🔧 技術實施

### 後端 API

#### POST /api/usage-log（Worker 調用）

```python
@app.post("/api/usage-log")
async def log_token_usage(request: Request):
    """
    記錄 Token 使用情況
    不需要認證（內部 API，由 Worker 調用）
    """
    data = await request.json()
    
    async with db.pool.acquire() as conn:
        # 1. 更新 Token 的 last_used 時間
        await conn.execute("""
            UPDATE tokens 
            SET last_used = NOW()
            WHERE token_hash = $1
        """, data.get('token_hash'))
        
        # 2. 插入詳細使用記錄
        await conn.execute("""
            INSERT INTO token_usage_logs (
                token_hash, route_path, used_at,
                response_status, response_time_ms,
                ip_address, user_agent, request_method, error_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """, 
            data.get('token_hash'),
            data.get('route'),
            datetime.fromtimestamp(data.get('timestamp', 0) / 1000),
            data.get('response_status'),
            data.get('response_time_ms'),
            data.get('ip_address'),
            data.get('user_agent'),
            data.get('request_method'),
            data.get('error_message')
        )
    
    return {"status": "logged"}
```

#### GET /api/usage/stats（統計 API）

```python
@app.get("/api/usage/stats")
async def get_usage_stats(request: Request):
    """整體使用統計"""
    user = await verify_clerk_token(request)
    
    # 返回：
    # - 總調用次數、錯誤次數、成功率
    # - 24 小時調用趨勢
    # - Top 10 Token/路由
```

#### GET /api/usage/token/{id}（Token 詳情）

```python
@app.get("/api/usage/token/{token_id}")
async def get_token_usage(token_id: int, request: Request):
    """特定 Token 的使用詳情（需要團隊權限）"""
```

---

### Cloudflare Worker 實施

```javascript
// worker/src/worker.js

async function logTokenUsage(tokenHash, routePath, responseStatus, responseTime, request, env) {
  try {
    const backendUrl = env.TOKEN_MANAGER_BACKEND || 'https://tapi.blocktempo.ai';
    
    await fetch(`${backendUrl}/api/usage-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_hash: tokenHash,
        route: routePath,
        timestamp: Date.now(),
        response_status: responseStatus,
        response_time_ms: responseTime,
        ip_address: request.headers.get('CF-Connecting-IP'),
        user_agent: request.headers.get('User-Agent'),
        request_method: request.method,
        error_message: responseStatus >= 400 ? 'Error occurred' : null
      }),
      signal: AbortSignal.timeout(5000)  // 5秒超時
    });
  } catch (error) {
    console.error('Failed to log usage:', error);
    // 不拋出錯誤，避免影響主流程
  }
}

// 主流程中
export default {
  async fetch(request, env, ctx) {
    // ... 驗證和轉發邏輯 ...
    
    const startTime = Date.now();
    const response = await fetch(backendRequest);
    const responseTime = Date.now() - startTime;
    
    // 異步記錄（不阻塞）
    ctx.waitUntil(
      logTokenUsage(
        tokenHash,
        matchedPath,
        response.status,
        responseTime,
        request,
        env
      )
    );
    
    return response;
  }
}
```

---

## 🌐 環境配置

### wrangler.toml 配置

```toml
# 生產環境
[vars]
TOKEN_MANAGER_BACKEND = "https://tapi.blocktempo.ai"

# 本地開發環境
[env.dev]
vars = { TOKEN_MANAGER_BACKEND = "http://localhost:8000" }
```

### 環境切換

```bash
# 本地開發（自動使用 localhost:8000）
cd worker
wrangler dev

# 生產部署（使用 tapi.blocktempo.ai）
wrangler deploy
```

---

## 🧪 測試指南

### 方案 1：模擬數據測試（推薦）

```bash
# 1. 獲取真實 token_hash
psql $DATABASE_URL -c "SELECT token_hash, name FROM tokens LIMIT 3;"

# 2. 生成測試數據
./scripts/generate_test_usage_data.sh

# 3. 訪問前端查看
http://localhost:5173/usage-analytics
http://localhost:5173/dashboard
```

### 方案 2：本地 Worker 完整測試

```bash
# Terminal 1: 後端
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2: 前端
cd frontend
npm run dev

# Terminal 3: 本地 Worker
cd worker
npm run dev

# Terminal 4: 測試調用
curl http://localhost:8787/api/test \
  -H "X-API-Key: ntk_your_test_token"

# 檢查後端日誌（應該看到 POST /api/usage-log）
# 查詢記錄
curl http://localhost:8000/api/usage/test-data
```

### 方案 3：生產環境測試

```bash
# 前提：tapi.blocktempo.ai 已配置

# 1. 確認域名
curl https://tapi.blocktempo.ai/health

# 2. 通過 Worker 調用
curl -X POST https://api-gateway.cryptoxlab.workers.dev/api/openai/chat/completions \
  -H "X-API-Key: ntk_your_token" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}]}'

# 3. 等待 5-10 秒

# 4. 查詢記錄
curl https://tapi.blocktempo.ai/api/usage/test-data
```

---

## 📱 前端頁面

### 1. API 使用分析（/usage-analytics）

**功能**：
- 4 個核心指標卡片（總調用、成功率、響應時間、錯誤數）
- 24 小時調用趨勢圖（雙軸折線圖）
- Top 10 最活躍 Token
- Top 10 最熱門路由
- 路由使用分佈餅圖

### 2. Token 使用詳情（/token-usage/:id）

**功能**：
- Token 基本資訊
- 使用統計卡片
- 使用時間線圖表
- 調用的路由分佈
- 詳細使用記錄表格

### 3. 路由使用統計（/route-usage?path=xxx）

**功能**：
- 路由基本資訊
- 使用統計卡片
- 響應時間趨勢圖
- 調用此路由的 Token 分佈
- 詳細調用記錄表格

### 4. Dashboard 總覽（已整合）

- API 調用統計卡片
- Top 3 Token/路由
- 連結到詳細分析頁面

---

## 🔧 故障排查

### 問題：Worker 記錄沒有發送

**檢查**：
1. Worker 環境變數是否設置：`TOKEN_MANAGER_BACKEND`
2. 後端 URL 是否可訪問
3. 查看 Worker 日誌：`wrangler tail`

**解決**：
```bash
# 確認後端可訪問
curl -X POST https://tapi.blocktempo.ai/api/usage-log \
  -H "Content-Type: application/json" \
  -d '{"token_hash":"test","route":"/test","timestamp":123}'

# 或使用本地環境測試
wrangler dev  # 使用 localhost:8000
```

### 問題：前端圖表不顯示

**檢查**：
1. recharts 是否安裝：`npm list recharts`
2. API 是否返回數據
3. 瀏覽器 Console 是否有錯誤

---

## 📊 測試工具

### generate_test_usage_data.sh

生成模擬使用數據（100 條記錄）：

```bash
#!/bin/bash

# 設定真實的 token_hash
TOKENS=(
  "your_real_token_hash_1"
  "your_real_token_hash_2"
  "your_real_token_hash_3"
)

ROUTES=("/api/openai" "/api/perplexity" "/api/cloudconvert")
STATUSES=(200 200 200 200 400 500)

# 生成 100 條記錄
for i in {1..100}; do
  TOKEN=${TOKENS[$RANDOM % ${#TOKENS[@]}]}
  ROUTE=${ROUTES[$RANDOM % ${#ROUTES[@]}]}
  STATUS=${STATUSES[$RANDOM % ${#STATUSES[@]}]}
  
  curl -X POST http://localhost:8000/api/usage-log \
    -H "Content-Type: application/json" \
    -d "{
      \"token_hash\": \"$TOKEN\",
      \"route\": \"$ROUTE\",
      \"timestamp\": $(($(date +%s) - $i * 3600)),
      \"response_status\": $STATUS,
      \"response_time_ms\": $((RANDOM % 2000 + 500))
    }"
done
```

---

## 📈 前端依賴

```json
{
  "recharts": "^2.x",        // 圖表庫
  "date-fns": "^3.x"         // 日期處理
}
```

安裝：
```bash
cd frontend
npm install recharts date-fns
```

---

## ✅ 完成狀態

### 後端
- ✅ token_usage_logs 表（10 個欄位 + 4 個索引）
- ✅ POST /api/usage-log
- ✅ GET /api/usage/stats
- ✅ GET /api/usage/token/{id}
- ✅ GET /api/usage/route

### Worker
- ✅ 異步記錄邏輯
- ✅ 詳細資訊收集
- ✅ 環境變數配置
- ✅ 5 秒超時保護
- ✅ 已部署到 Cloudflare

### 前端
- ✅ API 使用分析頁面
- ✅ Token 使用詳情頁面
- ✅ 路由使用統計頁面
- ✅ Dashboard 整合
- ✅ 所有圖表組件

---

**文件版本**: 2.0（合併版）  
**合併來源**: COMPLETE_USAGE_ANALYTICS_GUIDE.md, USAGE_ANALYTICS_IMPLEMENTATION.md, TOKEN_USAGE_TRACKING.md
