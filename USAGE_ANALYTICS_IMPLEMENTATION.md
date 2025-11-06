# API 使用分析與監控系統實施報告

**完成時間**: 2025-11-05  
**版本**: v2.8 Analytics Edition  
**狀態**: 🚧 後端完成，前端進行中

---

## 🎯 核心價值重新定位

### **Token Manager 的真正價值**

```
Token Manager ≠ 只是 Token 和路由的 CRUD 系統

Token Manager = API 使用監控和分析平台 + Token 管理
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^
                     這才是核心價值！
```

**為什麼使用統計如此重要？**

1. **可見性**：知道哪些 Token 被頻繁使用，哪些閒置
2. **性能監控**：追蹤 API 響應時間，識別慢查詢
3. **錯誤追蹤**：監控錯誤率，快速發現問題
4. **成本優化**：識別熱點 API，優化資源分配
5. **安全審計**：異常使用檢測，防止濫用

---

## 📊 完整的數據流向

### **數據記錄流程**

```
n8n Workflow
    ↓ HTTP Request (X-API-Key: ntk_xxx)
Cloudflare Worker (api-gateway.cryptoxlab.workers.dev)
    ├─→ 驗證 Token（從 KV 讀取）
    ├─→ 檢查權限（Scopes）
    ├─→ 添加後端認證（從 KV secrets 讀取）
    ├─→ 計時開始
    ├─→ 轉發到後端微服務（OpenAI, AWS, 等）
    ├─→ 計時結束
    ├─→ 返回響應給 n8n
    └─→ ctx.waitUntil(異步記錄) ← 關鍵！
           ↓
        POST https://tapi.blocktempo.ai/api/usage-log
           ↓ (記錄詳細資訊)
        {
          token_hash: "sha256...",
          route: "/api/openai",
          timestamp: 1730800000,
          response_status: 200,
          response_time_ms: 1500,
          ip_address: "1.2.3.4",
          user_agent: "n8n/1.0",
          request_method: "POST",
          error_message: null
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

---

## 🗄️ 數據存儲

### **數據表：token_usage_logs**

```sql
CREATE TABLE token_usage_logs (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL,        -- 哪個 Token
    route_path VARCHAR(255),                 -- 調用哪個路由
    used_at TIMESTAMP NOT NULL,              -- 什麼時候
    response_status INTEGER,                 -- HTTP 狀態碼（200, 400, 500...）
    response_time_ms INTEGER,                -- 響應時間（毫秒）
    ip_address VARCHAR(45),                  -- 來源 IP
    user_agent TEXT,                         -- User Agent
    request_method VARCHAR(10),              -- GET, POST, PUT...
    error_message TEXT                       -- 錯誤訊息（如果有）
);
```

**數據儲存位置**：
- ✅ PostgreSQL（我們的後端數據庫）
- ✅ **不是** Cloudflare KV（避免消耗寫入配額）
- ✅ 易於查詢、分析、匯出

**索引優化**：
```sql
CREATE INDEX idx_usage_token_hash ON token_usage_logs(token_hash);
CREATE INDEX idx_usage_used_at ON token_usage_logs(used_at DESC);
CREATE INDEX idx_usage_route ON token_usage_logs(route_path);
CREATE INDEX idx_usage_composite ON token_usage_logs(token_hash, used_at DESC);
```

---

## 🔧 後端 API（已完成）

### **1. POST /api/usage-log**
**用途**：Worker 發送使用記錄（不需要認證）

**接收資料**：
```json
{
  "token_hash": "abc123...",
  "route": "/api/openai",
  "timestamp": 1730800000000,
  "response_status": 200,
  "response_time_ms": 1500,
  "ip_address": "1.2.3.4",
  "user_agent": "n8n/1.0",
  "request_method": "POST",
  "error_message": null
}
```

**處理邏輯**：
1. 更新 Token 的 `last_used` 時間
2. 插入詳細記錄到 `token_usage_logs` 表
3. 返回 `{"status": "logged"}`
4. 失敗不報錯（避免影響 Worker）

---

### **2. GET /api/usage/stats**
**用途**：獲取整體使用統計（需要認證）

**返回數據**：
```json
{
  "overview": {
    "total_calls": 12345,
    "total_errors": 123,
    "avg_response_time": 850.5,
    "success_rate": 99.0
  },
  "hourly_usage": [
    {"hour": "2025-11-05T10:00:00", "call_count": 45, "avg_response_time": 800}
  ],
  "top_tokens": [
    {"name": "Production Token", "team_id": "backend-team", "usage_count": 5000}
  ],
  "top_routes": [
    {"route_path": "/api/openai", "call_count": 3000, "avg_response_time": 1200, "success_rate": 98.5}
  ]
}
```

---

### **3. GET /api/usage/token/{token_id}**
**用途**：獲取特定 Token 的使用詳情（需要認證 + 權限）

**返回數據**：
```json
{
  "token": {"id": 1, "name": "Test Token", "team_id": "backend-team"},
  "stats": {
    "total_calls": 1000,
    "error_count": 10,
    "avg_response_time": 850,
    "first_used": "2025-11-01T10:00:00",
    "last_used": "2025-11-05T15:30:00"
  },
  "recent_usage": [
    {
      "route_path": "/api/openai",
      "used_at": "2025-11-05T15:30:00",
      "response_status": 200,
      "response_time_ms": 1200
    }
  ]
}
```

---

### **4. GET /api/usage/route?route_path={path}**
**用途**：獲取特定路由的使用統計（需要認證）

---

### **5. GET /api/usage/test-data**
**用途**：查看最近 10 條使用記錄（不需要認證，僅測試用）

---

## 📱 前端頁面

### **1. API 使用分析（`/usage-analytics`）✅**

**核心功能**：
- ✅ 4 個核心指標卡片：
  - 總調用次數
  - 成功率
  - 平均響應時間
  - 錯誤次數

- ✅ 24 小時調用趨勢圖：
  - 雙軸折線圖（調用量 + 響應時間）
  - 小時級別統計

- ✅ Top 10 最活躍 Token：
  - 排名顯示
  - 調用次數
  - 所屬團隊

- ✅ Top 10 最熱門路由：
  - 排名顯示
  - 調用次數
  - 平均響應時間
  - 成功率

- ✅ 路由使用分佈餅圖：
  - Top 5 路由
  - 百分比顯示

### **2. Token 使用詳情（待實施）** ⏳

**功能**：
- Token 基本資訊
- 使用統計（總調用、錯誤率、平均響應時間）
- 使用時間線（最近 100 次調用）
- 路由分佈圖（這個 Token 調用了哪些路由）
- 時段分析（什麼時間最常使用）

### **3. 路由使用詳情（待實施）** ⏳

**功能**：
- 路由基本資訊
- 使用統計（總調用、錯誤率、平均響應時間）
- Token 分佈（哪些 Token 在調用這個路由）
- 性能趨勢（響應時間變化）
- 錯誤分析（錯誤類型分佈）

### **4. Dashboard 整合（待實施）** ⏳

在主 Dashboard 添加使用統計卡片：
- 本週 API 調用總數
- 實時成功率
- 最活躍的 Token（Top 3）
- 最熱門的路由（Top 3）

---

## 🧪 測試方案

### **問題 1：Worker 記錄真的有發送嗎？**

**答案**：目前**沒有成功發送**

**原因**：
```javascript
// Worker 配置為：
TOKEN_MANAGER_BACKEND = "https://tapi.blocktempo.ai"

// 但這個域名還未指向你的 Railway 後端
// 所以 Worker 的 fetch 會失敗（連接錯誤）
// 錯誤被 catch，不影響主流程（正確的設計）
```

**證據**：
- ✅ 剛才 OpenAI API 調用成功
- ❌ 但查詢 `token_usage_logs` 只有手動測試數據
- ❌ 沒有真實的 OpenAI 調用記錄

---

### **問題 2：如何測試？**

#### **方案 A：本地完整測試（推薦）** ⭐

```bash
# 1. 啟動本地 Worker
cd worker
npm run dev  # 會使用 [env.dev] 配置：http://localhost:8000

# 2. 獲取真實 token（從資料庫）
psql $DATABASE_URL -c "SELECT token_hash, name FROM tokens LIMIT 1;"

# 3. 在 KV 中確認 Token 存在
curl KV查詢...

# 4. 通過本地 Worker 調用
curl http://localhost:8787/api/openai/chat/completions \
  -H "X-API-Key: ntk_real_token"

# 5. 檢查後端日誌（應該看到 POST /api/usage-log）

# 6. 查詢使用記錄
curl http://localhost:8000/api/usage/test-data

# 7. 前端查看統計
http://localhost:5173/usage-analytics
```

#### **方案 B：生產環境測試（需要域名）**

```
前提條件：
1. 在 Railway 設置自定義域名：tapi.blocktempo.ai
2. 或臨時修改 wrangler.toml 使用 Railway URL
3. 重新部署 Worker

然後：
1. 通過 https://api-gateway.cryptoxlab.workers.dev 調用
2. Worker 會發送記錄到正確的後端 URL
3. 數據會成功寫入 token_usage_logs
```

#### **方案 C：模擬數據測試前端（當前可用）** ⭐

```bash
# 1. 獲取真實 token_hash
psql $DATABASE_URL -c "SELECT token_hash, name FROM tokens LIMIT 3;"

# 2. 更新測試腳本中的 TOKENS 陣列

# 3. 執行腳本生成 100 條測試數據
./scripts/generate_test_usage_data.sh

# 4. 訪問前端查看效果
http://localhost:5173/usage-analytics
```

---

## 🎯 回答你的問題

### **Q1: Worker 傳回來的記錄會存在哪裡？怎麼記錄？**

**A1**: 

**存儲位置**：
```
PostgreSQL 數據庫
└── token_usage_logs 表
    ├── token_hash（哪個 Token）
    ├── route_path（調用哪個路由）
    ├── used_at（什麼時候）
    ├── response_status（狀態碼）
    ├── response_time_ms（響應時間）
    ├── ip_address（來源 IP）
    ├── user_agent（User Agent）
    ├── request_method（HTTP 方法）
    └── error_message（錯誤訊息）
```

**記錄方式**：
```
Worker → POST /api/usage-log → Backend API → INSERT INTO token_usage_logs
```

**查詢方式**：
```sql
-- 查看最近 10 條
SELECT * FROM token_usage_logs ORDER BY used_at DESC LIMIT 10;

-- 查看特定 Token 的使用
SELECT * FROM token_usage_logs WHERE token_hash = 'xxx';

-- 查看特定路由的統計
SELECT route_path, COUNT(*) FROM token_usage_logs GROUP BY route_path;
```

---

### **Q2: 現在測試是真的有收到記錄嗎？**

**A2**：**部分有，部分沒有**

**有收到的**：
- ✅ 手動測試數據（curl 直接調用 `/api/usage-log`）
- ✅ 測試腳本生成的模擬數據

**沒收到的**：
- ❌ Cloudflare Worker 的真實調用記錄
- **原因**：Worker 配置的 URL 是 `https://tapi.blocktempo.ai`（尚未設置）

---

### **Q3: 本地 Worker vs 遠端 Worker 的差異？**

**A3**：

| 項目 | 本地 Worker (wrangler dev) | 遠端 Worker (Cloudflare) |
|------|---------------------------|-------------------------|
| **KV 數據** | 本地 KV（可能不同步） | 生產 KV（實時數據） |
| **環境變數** | 使用 [env.dev] | 使用 [vars] |
| **後端 URL** | http://localhost:8000 | https://tapi.blocktempo.ai |
| **Token 驗證** | 需要 Token 在本地 KV | 需要 Token 在生產 KV |
| **適用場景** | 開發調試 | 真實使用 |

**結論**：
- 本地 Worker 適合測試**邏輯**是否正確
- 遠端 Worker 才能測試**完整流程**
- 兩者的代碼是**完全相同的**（正規無差異）

---

### **Q4: 現在的測試用的是哪個 Worker？**

**A4**：**遠端 Worker**

```bash
# 剛才的測試
curl https://api-gateway.cryptoxlab.workers.dev/api/openai/...
       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
       這是 Cloudflare 遠端 Worker！

# 測試結果：
✅ OpenAI API 調用成功（返回「使用追蹤測試成功。」）
❌ 但使用記錄沒有發送到後端（因為 tapi.blocktempo.ai 未設置）
```

---

## 🚀 完整測試計劃

### **階段 1：本地環境完整測試（當前可執行）** ⭐

```bash
# Terminal 1: 後端
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2: 前端
cd frontend  
npm run dev

# Terminal 3: 本地 Worker
cd worker
npm run dev  # 使用 [env.dev] 配置，後端為 localhost:8000

# Terminal 4: 執行測試
# 4.1 獲取真實 token_hash
psql $DATABASE_URL -c "SELECT token_hash, name, scopes FROM tokens LIMIT 1;"

# 4.2 確認 Token 在 KV 中
# （需要手動同步，因為本地 KV 可能不同步）

# 4.3 調用本地 Worker
curl http://localhost:8787/api/test \
  -H "X-API-Key: ntk_your_token"

# 4.4 檢查後端日誌
# 應該看到：POST /api/usage-log {"status":"logged"}

# 4.5 查詢使用記錄
curl http://localhost:8000/api/usage/test-data | python3 -m json.tool

# 4.6 前端查看
http://localhost:5173/usage-analytics
```

---

### **階段 2：模擬數據測試前端（當前可執行）** ⭐

```bash
# 1. 獲取真實 token_hash（3 個）
psql $DATABASE_URL -c "SELECT token_hash, name FROM tokens LIMIT 3;"

# 2. 更新腳本
# 編輯 scripts/generate_test_usage_data.sh
# 替換 TOKENS 陣列為真實的 hash

# 3. 執行腳本
./scripts/generate_test_usage_data.sh

# 4. 訪問前端查看效果
http://localhost:5173/usage-analytics
```

---

### **階段 3：生產環境完整測試（需要域名）**

**前提條件**：
```
1. 在 Railway 設置自定義域名：tapi.blocktempo.ai
2. DNS 配置生效
3. SSL 證書配置
```

**測試步驟**：
```bash
# 1. 確認域名可訪問
curl https://tapi.blocktempo.ai/health

# 2. Worker 已部署（已完成）
# Worker URL: https://api-gateway.cryptoxlab.workers.dev
# Worker 配置：TOKEN_MANAGER_BACKEND = "https://tapi.blocktempo.ai"

# 3. 使用真實 Token 調用
curl -X POST https://api-gateway.cryptoxlab.workers.dev/api/openai/chat/completions \
  -H "X-API-Key: ntk_Q9AFxV1p2gbE1WyCZntA0cVG_FUTQ52Rdh36KmbQ2LA" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"測試"}]}'

# 4. 等待 5-10 秒（異步處理）

# 5. 查詢使用記錄
curl https://tapi.blocktempo.ai/api/usage/test-data

# 6. 前端查看
https://your-frontend-url/usage-analytics
```

---

## 📊 前端頁面規劃

### **核心頁面（必須）**

1. **API 使用分析**（`/usage-analytics`）✅
   - 整體統計
   - 趨勢圖表
   - Top Token/路由

2. **Token 使用詳情**（待實施）⏳
   - 點擊 Token 列表中的「使用記錄」按鈕
   - 顯示該 Token 的詳細使用情況

3. **路由使用詳情**（待實施）⏳
   - 點擊路由列表中的「調用統計」按鈕
   - 顯示該路由的詳細調用情況

### **整合到現有頁面**

1. **Dashboard 總覽**（待整合）⏳
   - 添加「本週 API 調用」卡片
   - 添加「Top 3 Token」列表
   - 添加「Top 3 路由」列表

2. **Token 列表**（待增強）⏳
   - 顯示調用次數badge
   - 添加「查看使用記錄」按鈕

3. **路由列表**（待增強）⏳
   - 顯示調用次數badge
   - 添加「查看調用統計」按鈕

---

## 📝 當前進度

### **已完成**
- ✅ 後端數據表
- ✅ 後端 API（5 個）
- ✅ Worker 異步記錄邏輯
- ✅ Worker 已部署到 Cloudflare
- ✅ 前端：API 使用分析頁面
- ✅ 測試腳本：生成模擬數據

### **進行中**
- 🚧 前端：Token 使用詳情頁面
- 🚧 前端：路由使用詳情頁面
- 🚧 前端：Dashboard 整合

### **待測試**
- ⏳ 本地 Worker 完整測試
- ⏳ 模擬數據前端展示測試
- ⏳ 生產環境端到端測試（等域名）

---

## 🎯 建議執行順序

### **現在立即可做**

1. **測試模擬數據**：
   ```bash
   # 生成測試數據
   ./scripts/generate_test_usage_data.sh
   
   # 訪問前端查看
   http://localhost:5173/usage-analytics
   ```

2. **完成剩餘前端頁面**（我繼續實施）

3. **本地 Worker 測試**（確認邏輯正確）

### **域名設置後**

1. 配置 Railway 自定義域名：`tapi.blocktempo.ai`
2. Worker 自動生效（已部署，環境變數已設置）
3. 真實調用會自動記錄
4. 前端立即可見數據

---

## 🔍 當前測試狀態總結

| 測試項目 | 狀態 | 說明 |
|---------|------|------|
| 後端 API 接收記錄 | ✅ 成功 | 手動測試通過 |
| 數據寫入數據庫 | ✅ 成功 | token_usage_logs 表有數據 |
| OpenAI API 調用 | ✅ 成功 | 遠端 Worker 調用成功 |
| Worker 異步發送記錄 | ❌ 失敗 | 域名未設置 |
| 前端頁面展示 | ⏳ 進行中 | API 分析頁面已創建 |

---

**文件版本**: 3.0  
**最後更新**: 2025-11-05  
**狀態**: 後端完成，前端進行中，等待域名配置

