# Token 使用追蹤功能文檔

**實施日期**: 2025-11-05  
**版本**: v2.7  
**狀態**: ✅ 已實施

---

## 📊 功能概述

實現了 Token 實際使用追蹤功能，讓系統能夠記錄每個 Token 的使用情況。

### **為什麼需要這個功能？**

之前的系統只記錄**管理操作**（創建/編輯/刪除 Token），但**不記錄 Token 的實際使用**。

原因是：
```
n8n Workflow
    ↓ (使用 Token)
Cloudflare Worker  ← 驗證和轉發在這裡發生
    ↓
後端微服務
```

**Worker 的請求不經過我們的 Token Manager 後端**，所以之前無法追蹤使用情況。

---

## 🏗️ 架構設計

### **方案選擇：方案 B - Worker 回報使用記錄**

我們選擇了方案 B：Worker 異步發送使用記錄到後端。

**優點**：
- ✅ 不消耗 Cloudflare KV 寫入配額
- ✅ 數據存儲在我們的 PostgreSQL，易於查詢
- ✅ 不影響主請求性能（異步執行）
- ✅ 可以記錄詳細資訊

**架構圖**：
```
n8n → Worker (驗證 Token)
         ↓ (轉發請求)
      後端微服務
         ↓ (同時異步)
      ctx.waitUntil(logTokenUsage())
         ↓
      Token Manager Backend
         ↓
      更新 last_used 時間
```

---

## 🔧 技術實現

### **1. 後端 API**

新增 endpoint：`POST /api/usage-log`

```python
@app.post("/api/usage-log")
async def log_token_usage(request: Request):
    """
    記錄 Token 使用情況（由 Cloudflare Worker 調用）
    不需要認證，因為是內部調用
    """
    data = await request.json()
    token_hash = data.get('token_hash')
    route_path = data.get('route')
    timestamp = data.get('timestamp')
    
    # 更新 Token 的 last_used 時間
    async with db.pool.acquire() as conn:
        await conn.execute("""
            UPDATE tokens 
            SET last_used = NOW()
            WHERE token_hash = $1
        """, token_hash)
    
    return {"status": "logged"}
```

**特點**：
- ⚠️ **不需要認證**：這是內部 API，由 Worker 調用
- 🔄 **異步處理**：即使失敗也不影響主流程
- 📝 **簡單記錄**：目前只更新 `last_used` 時間

---

### **2. Cloudflare Worker 更新**

#### **添加使用記錄函數**

```javascript
/**
 * 記錄 Token 使用情況到後端
 * 使用異步方式，不阻塞主請求
 */
async function logTokenUsage(tokenHash, routePath, env) {
  try {
    // 從環境變數獲取後端 URL
    const backendUrl = env.TOKEN_MANAGER_BACKEND || 
      'https://token-manager-backend-production.up.railway.app';
    
    await fetch(`${backendUrl}/api/usage-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_hash: tokenHash,
        route: routePath,
        timestamp: Date.now()
      })
    });
  } catch (error) {
    console.error('Failed to log token usage:', error);
  }
}
```

#### **在主流程中調用**

```javascript
// 11. 返回響應
const response = await fetch(backendRequest);

// 12. 記錄 Token 使用情況（異步，不阻塞響應）
ctx.waitUntil(
  logTokenUsage(tokenHash, matchedPath, env)
);

return response;
```

**重點**：
- ✅ 使用 `ctx.waitUntil()`：確保異步任務完成
- ✅ 不阻塞主響應：記錄發生在返回響應之後
- ✅ 錯誤不影響主流程：即使記錄失敗，API 調用照常進行

---

## 🚀 部署配置

### **Cloudflare Worker 環境變數**

需要在 Cloudflare Worker 設置環境變數：

```bash
# 方式 1：使用 wrangler
wrangler secret put TOKEN_MANAGER_BACKEND

# 輸入值：
https://token-manager-backend-production.up.railway.app
```

**或者**在 `wrangler.toml` 中添加：
```toml
[vars]
TOKEN_MANAGER_BACKEND = "https://your-backend-url.railway.app"
```

### **本地開發測試**

本地測試時，預設會使用 Railway 生產 URL。如果要測試本地後端：

```bash
# 設置環境變數
export TOKEN_MANAGER_BACKEND="http://localhost:8000"

# 或在 wrangler.toml 的 [env.dev] 中設置
[env.dev.vars]
TOKEN_MANAGER_BACKEND = "http://localhost:8000"
```

---

## 📊 數據展示

### **Token 列表顯示**

Token 列表已經有 `last_used` 欄位，現在會自動更新：

```jsx
// TokenList.jsx 已經顯示 last_used
{token.last_used ? (
  <span>最後使用: {formatDate(token.last_used)}</span>
) : (
  <span>尚未使用</span>
)}
```

### **Dashboard 統計（未來擴展）**

可以在 Dashboard 添加：
- 📈 Token 使用頻率圖表
- 🔥 最常使用的 Token Top 10
- 📍 最常訪問的路由
- 🕐 使用時段分析

---

## 🔮 未來擴展（可選）

### **階段 1：詳細使用日誌表**

目前只更新 `last_used` 時間，未來可以創建專門的使用日誌表：

```sql
CREATE TABLE token_usage_logs (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL,
    route_path VARCHAR(255),
    used_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- 可選欄位
    ip_address VARCHAR(45),
    user_agent TEXT,
    response_status INTEGER,
    response_time_ms INTEGER
);

CREATE INDEX idx_usage_token_hash ON token_usage_logs(token_hash);
CREATE INDEX idx_usage_used_at ON token_usage_logs(used_at DESC);
```

### **階段 2：高級分析**

基於詳細日誌，可以實現：
- 📊 使用趨勢圖表
- 🔍 按路由/團隊/時間的使用分析
- ⚠️ 異常使用檢測
- 📈 API 性能監控

### **階段 3：即時統計**

使用 Cloudflare Durable Objects 或 Analytics Engine：
- 即時使用計數
- 熱點路由識別
- Rate limiting 支持

---

## 🧪 測試指南

### **1. 後端 API 測試**

```bash
# 測試使用記錄 API
curl -X POST http://localhost:8000/api/usage-log \
  -H "Content-Type: application/json" \
  -d '{
    "token_hash": "test_hash_123",
    "route": "/api/test",
    "timestamp": 1699000000000
  }'

# 預期返回
{"status":"logged"}
```

### **2. 檢查 Token 的 last_used 時間**

```bash
# 創建測試 Token
# 使用 Token 調用 API（通過 Worker）
# 查詢 Token 列表，檢查 last_used 是否更新

# 或直接查詢資料庫
psql $DATABASE_URL -c "SELECT name, last_used FROM tokens WHERE name = 'Test Token';"
```

### **3. Worker 本地測試**

```bash
cd worker

# 本地運行 Worker
npm run dev

# 使用測試 Token 調用
curl http://localhost:8787/api/test \
  -H "X-API-Key: ntk_your_test_token"

# 檢查後端日誌，確認收到使用記錄
```

### **4. 端到端測試**

```bash
# 1. 創建測試 Token
# 2. 通過 Worker 調用 API
curl https://api-gateway.cryptoxlab.workers.dev/api/test \
  -H "X-API-Key: ntk_your_token"

# 3. 等待幾秒（異步處理）
# 4. 檢查 Token Manager，查看 last_used 時間
```

---

## 📝 注意事項

### **安全性**

⚠️ **`/api/usage-log` 不需要認證**

這是設計決策，因為：
1. 只有 Cloudflare Worker 會調用（內部 API）
2. 即使被濫用，也只會寫入 `last_used` 時間，不會造成安全問題
3. 可以通過檢查 IP 地址限制訪問（未來擴展）

**如果需要更高安全性**：
- 方案 1：使用共享密鑰（Worker 和後端共享）
- 方案 2：使用 Cloudflare 的 Authenticated Origin Pulls
- 方案 3：限制只允許 Cloudflare IP 訪問

### **性能考量**

✅ **不影響主請求性能**

- 使用 `ctx.waitUntil()`：異步執行
- 記錄失敗不影響 API 調用
- 後端使用簡單的 UPDATE 語句，非常快速

### **成本考量**

✅ **幾乎零成本**

- 不消耗 Cloudflare KV 寫入配額（最重要！）
- PostgreSQL 寫入成本極低
- 每次 API 調用只增加一個 UPDATE 語句

---

## 📊 數據統計示例

### **當前實現**

```sql
-- 查看最近使用的 Token
SELECT name, team_id, last_used 
FROM tokens 
WHERE last_used IS NOT NULL 
ORDER BY last_used DESC 
LIMIT 10;

-- 查看從未使用的 Token
SELECT name, team_id, created_at 
FROM tokens 
WHERE last_used IS NULL;

-- 查看長時間未使用的 Token
SELECT name, team_id, last_used 
FROM tokens 
WHERE last_used < NOW() - INTERVAL '30 days';
```

### **未來擴展（需要 usage_logs 表）**

```sql
-- 每小時的使用量
SELECT 
  DATE_TRUNC('hour', used_at) as hour,
  COUNT(*) as usage_count
FROM token_usage_logs
WHERE used_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;

-- 最常使用的路由
SELECT 
  route_path,
  COUNT(*) as usage_count
FROM token_usage_logs
WHERE used_at >= NOW() - INTERVAL '7 days'
GROUP BY route_path
ORDER BY usage_count DESC
LIMIT 10;
```

---

## ✅ 完成狀態

### **已實施**
- ✅ 後端 API：`POST /api/usage-log`
- ✅ Worker 異步記錄邏輯
- ✅ 更新 `last_used` 時間
- ✅ 錯誤處理和容錯
- ✅ 環境變數配置

### **前端展示（已存在）**
- ✅ Token 列表顯示 `last_used`
- ✅ 格式化時間顯示

### **未來可選**
- ⏳ 詳細使用日誌表
- ⏳ Dashboard 使用統計圖表
- ⏳ 使用趨勢分析
- ⏳ 異常檢測

---

## 🎯 總結

**這個功能解決了什麼問題？**

之前系統無法追蹤 Token 的實際使用情況，因為：
- Worker 驗證 Token 時不經過我們的後端
- 只有管理操作被記錄

**現在的解決方案：**
- Worker 在驗證成功後，異步通知後端
- 後端更新 `last_used` 時間
- 不影響性能，不消耗 KV 配額
- 為未來的使用分析打下基礎

**效果：**
- ✅ 可以看到每個 Token 最後使用時間
- ✅ 可以識別長時間未使用的 Token
- ✅ 為未來的詳細分析預留擴展空間

---

**文件版本**: 1.0  
**最後更新**: 2025-11-05  
**實施狀態**: 完成

