# 路由後端服務認證完整指南

**⚠️ 重要：請務必正確理解本指南，避免洩漏 API Key！**

**版本**: v2.3  
**最後更新**: 2025-11-08

---

## 📖 目錄

1. [快速開始](#-快速開始)
2. [核心概念](#-核心概念)
3. [完整操作步驟](#-完整操作步驟)
4. [設計架構](#-設計架構)
5. [支援的認證類型](#-支援的認證類型)
6. [安全最佳實踐](#-安全最佳實踐)
7. [故障排除](#-故障排除)
8. [UI 設計參考](#-ui-設計參考)

---

## 🚀 快速開始

### 設定 OpenAI API 路由（完整範例）

```bash
# Step 1: 設定 Cloudflare Secret（實際金鑰）
cd /Users/JL/Development/microservice-system/token-manager/worker
wrangler secret put OPENAI_API_KEY
# 輸入: sk-proj-xxxxxxxxxxxxxxxxxxxxx
✅ Success! Uploaded secret OPENAI_API_KEY

# Step 2: 在管理系統創建路由（UI 操作）
# 登入 → 路由管理 → 新增路由
名稱: OpenAI API
路徑: /api/openai
後端 URL: https://api.openai.com/v1
認證方式: Bearer Token
Token 環境變數名稱: OPENAI_API_KEY  ← 只填名稱！

# Step 3: 測試（假設你的 Token 是 ntk_test123）
curl -X POST https://your-worker.workers.dev/api/openai/chat/completions \
  -H "X-API-Key: ntk_test123" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'
```

---

## 🎯 核心概念

### 使用場景

```
n8n Workflow
  ↓ (使用我們的 Token: ntk_xxx)
Cloudflare Worker (我們的 Router)
  ↓ (自動添加後端 API Key)
後端微服務 (OpenAI, AWS, etc.)
  ↓
返回結果
```

### 什麼是「環境變數名稱」？

```yaml
環境變數名稱（Variable Name）:
  - 這是一個「代號」或「別名」
  - 例如: OPENAI_API_KEY, AWS_SECRET, BACKEND_TOKEN
  - 這個名稱會儲存在資料庫中
  - 這是安全的，可以公開

實際的 API Key（Secret Value）:
  - 這是真正的密鑰
  - 例如: sk-proj-xxxxxxxxxxxxx
  - 這個值儲存在 Cloudflare Worker Secrets 中
  - 這是機密的，絕不能洩漏
```

### 為什麼要分離？

```
錯誤做法（直接儲存）:
  資料庫 → 儲存 sk-proj-xxxxx
  ❌ 資料庫洩漏 = API Key 洩漏
  ❌ 所有有權限的人都能看到
  ❌ 難以更換金鑰

正確做法（引用）:
  資料庫 → 儲存 "OPENAI_API_KEY"（名稱）
  Cloudflare → 儲存實際值（加密）
  Worker → 讀取 env.OPENAI_API_KEY
  ✅ 資料庫洩漏也沒事
  ✅ 只有 Worker 能讀取實際值
  ✅ 可以獨立更換金鑰
```

---

## 📖 完整操作步驟

### Step 1: 設定 Cloudflare Worker Secret（實際金鑰）

```bash
# 1. 進入 worker 目錄
cd /Users/JL/Development/microservice-system/token-manager/worker

# 2. 使用 wrangler 設定 secret
wrangler secret put OPENAI_API_KEY

# 3. 系統會提示輸入（輸入實際的 API Key）
? Enter a secret value: sk-proj-TCTGBcWbsPaRTq0oZAWzxZK5U1NLkX984bhZTMXbLy...
# 按 Enter

# 4. 確認成功
✅ Creating the secret for the Worker "api-gateway" 
✅ Success! Uploaded secret OPENAI_API_KEY

# 重要：這個值現在儲存在 Cloudflare，加密且安全
```

**替代方式：使用 Cloudflare Dashboard**

```
登入 Cloudflare → Workers → 選擇 Worker
→ Settings → Variables → Add variable
→ Type: Secret
→ Name: OPENAI_API_KEY
→ Value: sk-proj-xxx
```

### Step 2: 在管理系統創建路由（填入引用名稱）

```
登入系統 → 路由管理 → 點擊「新增路由」

表單填寫:
  名稱: OpenAI Chat API
  路徑: /api/openai
  後端 URL: https://api.openai.com/v1
  
  後端服務認證方式: Bearer Token
  
  Token 環境變數名稱: OPENAI_API_KEY  ← 只填名稱！不是實際值！
  
[新增路由]
```

### Step 3: 系統自動同步

```
系統會自動:
  1. 儲存到資料庫
  2. 同步到 Cloudflare KV:
     {
       "/api/openai": {
         "url": "https://api.openai.com/v1",
         "auth": {
           "type": "bearer",
           "config": {
             "token_ref": "OPENAI_API_KEY"  ← 只有名稱
           }
         }
       }
     }
```

### Step 4: Worker 運行時

```javascript
// Worker 收到請求
const authConfig = route.auth.config;
const actualToken = env[authConfig.token_ref];  
// env.OPENAI_API_KEY = "sk-proj-xxx..."

// 添加到請求
backendHeaders.set('Authorization', `Bearer ${actualToken}`);

// 轉發給 OpenAI
```

---

## 🏗️ 設計架構

### 推薦方案：混合模式

```yaml
儲存層級:
  1. 敏感金鑰 → Cloudflare Secrets (環境變數)
  2. 路由配置 → PostgreSQL + KV
  3. 金鑰引用 → 使用變數名稱

實現:
  # PostgreSQL (routes 表)
  backend_auth_type: "bearer"
  backend_auth_config: {
    "token_ref": "OPENAI_API_KEY"  ← 引用，不是實際值
  }

  # Cloudflare Worker 環境變數
  OPENAI_API_KEY = "sk-xxxxx"  ← 實際金鑰

  # Worker 邏輯
  const authConfig = route.backend_auth_config;
  if (authConfig.token_ref) {
    const actualToken = env[authConfig.token_ref];  // 從環境變數讀取
    headers['Authorization'] = `Bearer ${actualToken}`;
  }
```

### 數據模型

```sql
-- routes 表
ALTER TABLE routes
ADD COLUMN backend_auth_type VARCHAR(50) DEFAULT 'none',
ADD COLUMN backend_auth_config JSONB;

-- 範例數據
routes:
  id: 1
  path: "/api/openai"
  backend_url: "https://api.openai.com/v1"
  backend_auth_type: "bearer"
  backend_auth_config: {
    "token_ref": "OPENAI_API_KEY"
  }
```

### Cloudflare KV 格式

```javascript
// Key: "routes"
// Value:
{
  "/api/openai": {
    "url": "https://api.openai.com/v1",
    "tags": ["ai", "premium"],
    "auth": {
      "type": "bearer",
      "config": {
        "token_ref": "OPENAI_API_KEY"
      }
    }
  },
  "/api/internal": {
    "url": "https://internal.company.com",
    "tags": ["internal"],
    "auth": null  // 無需認證
  }
}
```

---

## 📊 支援的認證類型

### 1. None（無需認證）

**用途**: 內部服務、公開 API

```javascript
{
  "type": "none",
  "config": null
}

// Worker: 直接轉發，不添加任何 header
```

### 2. Bearer Token

**用途**: OAuth 2.0、大多數現代 API (OpenAI, Anthropic 等)

```yaml
配置:
  backend_auth_type: "bearer"
  backend_auth_config: {
    "token_ref": "OPENAI_API_KEY"
  }

Worker 行為:
  backendHeaders.set('Authorization', `Bearer ${env.OPENAI_API_KEY}`);

範例服務:
  - OpenAI API
  - Anthropic Claude
  - Perplexity AI
```

**完整範例：**

```javascript
{
  "type": "bearer",
  "config": {
    "token_ref": "OPENAI_API_KEY"
  }
}

// Worker 處理:
const token = env[authConfig.token_ref];
headers['Authorization'] = `Bearer ${token}`;
```

### 3. API Key

**用途**: 傳統 API、自建服務

```yaml
配置:
  backend_auth_type: "api-key"
  backend_auth_config: {
    "header_name": "X-API-Key",  // 可選
    "key_ref": "BACKEND_API_KEY"
  }

Worker 行為:
  const headerName = config.header_name || 'X-API-Key';
  backendHeaders.set(headerName, env.BACKEND_API_KEY);

範例服務:
  - 自建微服務
  - 部分第三方 API
```

**完整範例：**

```javascript
{
  "type": "api-key",
  "config": {
    "header_name": "X-API-Key",  // 可選
    "key_ref": "BACKEND_API_KEY"
  }
}

// Worker 處理:
const headerName = config.header_name || 'X-API-Key';
const apiKey = env[authConfig.key_ref];
headers[headerName] = apiKey;
```

### 4. Basic Auth

**用途**: 舊式 HTTP Basic 認證

```yaml
配置:
  backend_auth_type: "basic"
  backend_auth_config: {
    "username_ref": "SERVICE_USERNAME",
    "password_ref": "SERVICE_PASSWORD"
  }

Worker 行為:
  const credentials = btoa(`${env.SERVICE_USERNAME}:${env.SERVICE_PASSWORD}`);
  backendHeaders.set('Authorization', `Basic ${credentials}`);

範例服務:
  - 舊式 API
  - 內部系統
```

**完整範例：**

```javascript
{
  "type": "basic",
  "config": {
    "username_ref": "SERVICE_USERNAME",
    "password_ref": "SERVICE_PASSWORD"
  }
}

// Worker 處理:
const username = env[config.username_ref];
const password = env[config.password_ref];
const credentials = btoa(`${username}:${password}`);
headers['Authorization'] = `Basic ${credentials}`;
```

### 5. Custom Headers（未來擴展）

```javascript
{
  "type": "custom",
  "config": {
    "headers": {
      "X-Custom-Auth": "CUSTOM_AUTH_TOKEN",
      "X-Service-Key": "SERVICE_KEY"
    }
  }
}

// Worker 處理:
for (const [headerName, envVarName] of Object.entries(config.headers)) {
  headers[headerName] = env[envVarName];
}
```

---

## 🔐 安全最佳實踐

### 金鑰儲存層級

```yaml
第 1 層: Cloudflare Worker Secrets (最安全)
  用途: 實際的 API Key
  設定: wrangler secret put OPENAI_API_KEY
  特性:
    ✅ 加密儲存
    ✅ 只有 Worker 能訪問
    ✅ 不會出現在代碼或日誌中
    ✅ 可以通過 Cloudflare Dashboard 管理

第 2 層: PostgreSQL + Cloudflare KV (引用)
  用途: 引用變數名稱
  儲存: "token_ref": "OPENAI_API_KEY"
  特性:
    ✅ 不儲存實際值
    ✅ 可以通過 UI 管理
    ✅ 易於修改和審計

第 3 層: 前端 UI (完全隱藏)
  用途: 只顯示「已設定」或「未設定」
  特性:
    ✅ 用戶看不到實際金鑰
    ✅ 只能修改引用名稱
```

### 1. 永不儲存明文 API Key

```python
# ❌ 錯誤
backend_auth_config: {
  "api_key": "sk-actual-key-here"  # 明文，危險！
}

# ✅ 正確
backend_auth_config: {
  "token_ref": "OPENAI_API_KEY"    # 引用環境變數
}
```

### 2. 最小權限原則

```yaml
誰可以看到後端 API Key？
  ❌ 所有人
  ❌ 所有 Core Team 成員
  ✅ 只有 Core Team ADMIN

實現:
  # 創建/編輯路由時
  if backend_auth_config 中有敏感數據:
    要求 Core Team ADMIN 權限
  
  # 列表顯示時
  if user.role != "CORE_ADMIN":
    隱藏 backend_auth_config
    顯示: "****** (已設定)"
```

### 3. 分離金鑰管理與路由管理

```
我們的系統:
  管理「配置」（路由、認證類型、引用名稱）
  
Cloudflare Worker:
  管理「實際密鑰」（環境變數、Secrets）
  
分離的原因:
  ✅ 安全：密鑰不經過我們的系統
  ✅ 簡單：我們不需要管理加密金鑰
  ✅ 標準：這是業界標準做法
```

---

## ❌ 故障排除

### 常見錯誤 1: 填入實際 API Key

```yaml
❌ 錯誤:
  Token 環境變數名稱: sk-proj-TCTGBcWbsPaRTq0o...
  
問題:
  - 實際金鑰儲存在資料庫（明文）
  - 所有人都能在 UI 看到
  - 極度危險！

✅ 正確:
  Token 環境變數名稱: OPENAI_API_KEY
  
  然後在 Worker 設定:
  wrangler secret put OPENAI_API_KEY
  輸入實際值: sk-proj-xxx...
```

### 常見錯誤 2: 沒有在 Worker 設定 Secret

```yaml
❌ 錯誤流程:
  1. 在 UI 填入: OPENAI_API_KEY
  2. 直接使用
  3. Worker 找不到 env.OPENAI_API_KEY
  4. 請求失敗

✅ 正確流程:
  1. 先在 Worker 設定: wrangler secret put OPENAI_API_KEY
  2. 再在 UI 填入: OPENAI_API_KEY
  3. Worker 能讀取到實際值
  4. 請求成功
```

### 常見錯誤 3: 路由遺失

```sql
檢查資料庫:
  psql $DATABASE_URL -c "SELECT id, path, backend_auth_type FROM routes;"

檢查 KV 同步:
  # 檢查 Worker 日誌或使用 wrangler kv:key get
```

### 驗證設定是否正確

```bash
# 檢查資料庫
psql $DATABASE_URL -c "SELECT id, path, backend_auth_type, backend_auth_config FROM routes WHERE path='/api/openai';"

# 應該看到:
backend_auth_type: bearer
backend_auth_config: {"token_ref": "OPENAI_API_KEY"}  ← 只有名稱

# 測試 API
curl -X POST https://your-worker.workers.dev/api/openai/chat/completions \
  -H "X-API-Key: ntk_test123" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'

# Worker 會自動:
# 1. 驗證 ntk_test123
# 2. 添加 Authorization: Bearer sk-proj-xxx（從 env 讀取）
# 3. 轉發到 OpenAI
# 4. 返回結果
```

---

## 🎨 UI 設計參考

### 創建路由表單

```
┌──────────────────────────────────────────┐
│ 新增路由                                 │
├──────────────────────────────────────────┤
│ 路徑: /api/openai                        │
│ 後端 URL: https://api.openai.com/v1     │
│                                          │
│ 後端服務認證設定                         │
│ ┌─────────────────────────────────────┐ │
│ │ 認證方式: [▼ Bearer Token]          │ │
│ │                                     │ │
│ │ Token 環境變數名稱 *                │ │
│ │ [OPENAI_API_KEY____________]        │ │
│ │                                     │ │
│ │ ⚠️ 提醒:                            │ │
│ │ 1. 這裡只填「變數名稱」             │ │
│ │ 2. 實際的 API Key 需要在            │ │
│ │    Cloudflare Worker 中設定:        │ │
│ │    wrangler secret put OPENAI_API_KEY│ │
│ └─────────────────────────────────────┘ │
│                                          │
│ [創建路由]                               │
└──────────────────────────────────────────┘
```

### 路由列表

```
┌──────────────────────────────────────────┐
│ ID | 路徑         | 後端認證             │
├──────────────────────────────────────────┤
│ 1  | /api/openai  | 🔒 Bearer (已設定)   │
│ 2  | /api/aws     | 🔒 API Key (已設定)  │
│ 3  | /api/public  | 🔓 無需認證          │
└──────────────────────────────────────────┘

註: 實際的 API Key 對所有人隱藏
```

### UI 改進建議

```jsx
<div className="form-group">
  <label>Token 環境變數名稱 *</label>
  <input
    placeholder="例如: OPENAI_API_KEY"
  />
  <div style={{ 
    backgroundColor: '#fef3c7', 
    padding: '10px',
    borderRadius: '6px',
    marginTop: '8px'
  }}>
    <strong>⚠️ 重要說明：</strong>
    <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px' }}>
      <li>這裡填入「環境變數的名稱」，例如：<code>OPENAI_API_KEY</code></li>
      <li>❌ 不要填入實際的 API Key（如 sk-proj-xxx）</li>
      <li>✅ 實際的 Key 要在 Cloudflare Worker 中設定：
        <br/><code>wrangler secret put OPENAI_API_KEY</code>
      </li>
    </ol>
  </div>
</div>
```

---

## 🔄 完整流程範例

### 設定多個服務

```bash
# === OpenAI ===
wrangler secret put OPENAI_API_KEY
# 在 UI 創建路由：/api/openai，引用 OPENAI_API_KEY

# === AWS ===
wrangler secret put AWS_SECRET_KEY
# 在 UI 創建路由：/api/aws，引用 AWS_SECRET_KEY

# === 內部服務（Basic Auth）===
wrangler secret put INTERNAL_USERNAME
wrangler secret put INTERNAL_PASSWORD
# 在 UI 創建路由：/api/internal，引用兩個變數
```

### n8n 使用範例

```
HTTP Request Node:
  URL: https://your-worker.workers.dev/api/openai/chat/completions
  Method: POST
  Headers:
    X-API-Key: ntk_your_token  ← 只需要我們的 Token
  Body:
    {
      "model": "gpt-4",
      "messages": [{"role": "user", "content": "Hello"}]
    }

Worker 自動處理:
  1. 驗證 ntk_your_token
  2. 添加 Authorization: Bearer sk-proj-xxx
  3. 轉發到 OpenAI
  4. 返回結果給 n8n
```

---

## 📝 後端實施參考

### models.py

```python
class RouteCreate(BaseModel):
    name: str
    path: str
    backend_url: str
    tags: Optional[List[str]] = []
    backend_auth_type: Optional[str] = "none"
    backend_auth_config: Optional[dict] = None
```

### main.py - 創建路由

```python
@app.post("/api/routes")
async def create_route(data: RouteCreate, request: Request):
    user = await verify_clerk_token(request)
    
    # 如果有 auth config，需要 ADMIN 權限
    if data.backend_auth_config:
        await check_core_team_admin_only(user)
    else:
        await check_core_team_permission(user, "create")
    
    # 儲存到資料庫
    # ...
    
    # 同步到 KV
    await sync_routes_to_kv()
```

### KV 同步

```python
async def sync_routes_to_kv():
    routes = await conn.fetch("SELECT * FROM routes")
    
    routes_map = {}
    for route in routes:
        routes_map[route['path']] = {
            'url': route['backend_url'],
            'tags': route['tags'] or [],
            'auth': {
                'type': route['backend_auth_type'],
                'config': route['backend_auth_config']
            }
        }
    
    await cf_kv.put_routes(routes_map)
```

### Worker 處理

```javascript
// worker/src/worker.js
export default {
  async fetch(request, env) {
    // 1. 驗證 Token
    // 2. 匹配路由
    const route = routes[matchedPath];
    
    // 3. 處理後端認證
    const backendHeaders = new Headers(request.headers);
    
    if (route.auth && route.auth.type !== 'none') {
      const authType = route.auth.type;
      const authConfig = route.auth.config;
      
      switch (authType) {
        case 'bearer':
          const token = env[authConfig.token_ref];
          backendHeaders.set('Authorization', `Bearer ${token}`);
          break;
        
        case 'api-key':
          const apiKey = env[authConfig.key_ref];
          const headerName = authConfig.header_name || 'X-API-Key';
          backendHeaders.set(headerName, apiKey);
          break;
        
        case 'basic':
          const username = env[authConfig.username_ref];
          const password = env[authConfig.password_ref];
          const credentials = btoa(`${username}:${password}`);
          backendHeaders.set('Authorization', `Basic ${credentials}`);
          break;
      }
    }
    
    // 4. 轉發請求
    const backendRequest = new Request(backendUrl, {
      method: request.method,
      headers: backendHeaders,
      body: request.body
    });
    
    return await fetch(backendRequest);
  }
}
```

---

## 🎯 系統價值

### 對用戶的價值

```yaml
1. 統一管理:
   所有微服務的 API Key 集中在 Cloudflare 管理
   
2. 安全隔離:
   n8n 工作流不需要知道真實的 API Key
   只需要我們的 Token
   
3. 便捷性:
   一個 Token 可以訪問多個後端服務
   不需要在 n8n 中管理多個 API Key

4. 可追蹤:
   所有請求都經過 Worker
   可以統計使用情況
```

### 對系統的優勢

```yaml
1. 職責分離:
   Core Team 管理基礎設施（路由 + 認證）
   業務團隊管理應用（Token）
   
2. 可擴展:
   輕鬆添加新的認證類型
   輕鬆添加新的後端服務

3. 安全性:
   多層安全防護
   金鑰不會洩漏
```

---

## 🔮 未來擴展

### MVP（當前支援）

```yaml
✅ none - 無需認證
✅ bearer - Bearer Token
✅ api-key - API Key
✅ basic - Basic Auth
```

### 未來增強

```yaml
🔮 OAuth 2.0 Client Credentials
🔮 JWT 認證
🔮 Custom Headers
🔮 金鑰輪換機制
🔮 金鑰過期提醒
🔮 認證測試功能
```

---

**文檔版本**: 2.3  
**最後更新**: 2025-11-08  
**維護者**: 開發團隊

