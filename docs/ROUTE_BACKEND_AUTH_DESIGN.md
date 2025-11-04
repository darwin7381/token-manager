# 路由後端微服務認證設計

**日期**: 2025-11-03  
**問題**: 如何安全地管理後端微服務的 API Key？  
**優先級**: 🔴 高（安全性核心）

---

## 🎯 問題分析

### **使用場景**

```
n8n Workflow
  ↓ (使用我們的 Token)
Cloudflare Worker (我們的 Router)
  ↓ (需要後端 API Key)
後端微服務 (OpenAI, AWS, etc.)
  ↓
返回結果
```

### **問題**

```yaml
場景 1: 後端微服務需要 API Key
  例子: OpenAI API 需要 OPENAI_API_KEY
  
  Worker 轉發時需要:
    → 從 KV 讀取 OpenAI API Key
    → 添加到請求的 Authorization header
    → 轉發給 OpenAI

場景 2: 後端微服務需要不同的認證方式
  - Bearer Token (OAuth)
  - API Key (X-API-Key header)
  - Basic Auth (username:password)
  - Custom Header
  - 無需認證

問題:
  1. API Key 儲存在哪裡？
  2. 如何安全傳遞？
  3. 如何支援多種認證方式？
```

---

## 🏗️ 設計方案

### **方案 A：在路由中儲存後端認證（推薦）**

#### **數據模型**

```sql
-- 擴展 routes 表
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
    "token": "sk-xxxxxxxxxxxxxx"
  }

  id: 2
  path: "/api/aws"
  backend_url: "https://api.aws.com"
  backend_auth_type: "api-key"
  backend_auth_config: {
    "header_name": "X-API-Key",
    "api_key": "aws_xxxxxxxxxxxxxx"
  }

  id: 3
  path: "/api/internal"
  backend_url: "https://internal.company.com"
  backend_auth_type: "none"
  backend_auth_config: null
```

#### **支援的認證類型**

```javascript
// 認證類型枚舉
backend_auth_type:
  - "none"         → 無需認證
  - "bearer"       → Bearer Token
  - "api-key"      → API Key (可自訂 header 名稱)
  - "basic"        → Basic Auth (username:password)
  - "custom"       → 自訂 headers

// 對應的 config 結構
{
  "none": null,
  
  "bearer": {
    "token": "sk-xxxxxx"
  },
  
  "api-key": {
    "header_name": "X-API-Key",  // 可選，預設 X-API-Key
    "api_key": "xxxxxx"
  },
  
  "basic": {
    "username": "admin",
    "password": "password123"
  },
  
  "custom": {
    "headers": {
      "X-Custom-Auth": "value1",
      "X-Secret-Key": "value2"
    }
  }
}
```

---

### **儲存位置對比**

#### **選項 1: 儲存在 PostgreSQL（推薦）**

```sql
routes:
  backend_auth_config JSONB  -- 加密儲存

優點:
  ✅ 集中管理
  ✅ 可以加密（使用 pgcrypto）
  ✅ 易於備份
  ✅ 易於審計

缺點:
  ❌ 需要同步到 KV
  ❌ 敏感數據在資料庫中
```

#### **選項 2: 直接儲存在 Cloudflare KV**

```javascript
// KV 結構
routes: {
  "/api/openai": {
    "url": "https://api.openai.com/v1",
    "tags": ["ai", "premium"],
    "auth": {
      "type": "bearer",
      "token": "sk-xxxxxx"
    }
  }
}

優點:
  ✅ Worker 直接讀取，不需要額外請求
  ✅ 全球分佈（邊緣快取）

缺點:
  ❌ KV 明文儲存（Cloudflare 可以看到）
  ❌ 沒有加密選項
  ❌ 難以審計
```

#### **選項 3: 使用 Cloudflare Secrets（最安全）**

```javascript
// wrangler.toml
[vars]
OPENAI_API_KEY = "sk-xxxxx"  # 明文（不推薦）

# 或使用 wrangler secret put
wrangler secret put OPENAI_API_KEY
# 輸入密鑰，加密儲存

// Worker 中使用
export default {
  async fetch(request, env) {
    const openaiKey = env.OPENAI_API_KEY;
  }
}

優點:
  ✅ 加密儲存
  ✅ Cloudflare 內建安全機制
  ✅ 不會出現在代碼中

缺點:
  ❌ 需要為每個微服務手動設定
  ❌ 無法通過 UI 管理
  ❌ 不夠動態
```

---

## 💡 推薦方案：混合模式

### **設計**

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

### **優點**

```
✅ 安全: 金鑰不出現在資料庫
✅ 靈活: 可以通過 UI 管理路由配置
✅ 動態: 可以修改引用的變數名稱
✅ 分離: 金鑰管理與路由管理分離
```

### **實施步驟**

```bash
# 1. 設定 Cloudflare Secret
cd worker
wrangler secret put OPENAI_API_KEY
# 輸入: sk-xxxxxxxxxxxxxx

wrangler secret put AWS_SECRET_KEY
# 輸入: aws_xxxxxxxxxxxxxx

# 2. 在管理系統中創建路由
POST /api/routes
{
  "path": "/api/openai",
  "backend_url": "https://api.openai.com/v1",
  "backend_auth_type": "bearer",
  "backend_auth_config": {
    "token_ref": "OPENAI_API_KEY"
  }
}

# 3. Worker 自動處理
Worker 收到請求 → 讀取 route config → 從 env 讀取實際 token → 轉發
```

---

## 🔐 安全最佳實踐

### **1. 永不儲存明文 API Key**

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

### **2. 使用加密（如果必須儲存）**

```sql
-- 使用 pgcrypto 擴展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 加密儲存
INSERT INTO routes (backend_auth_config) 
VALUES (pgp_sym_encrypt('{"token": "sk-xxx"}', 'encryption-key'));

-- 解密讀取
SELECT pgp_sym_decrypt(backend_auth_config, 'encryption-key') FROM routes;
```

### **3. 最小權限原則**

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

---

## 📋 完整實施方案（推薦）

### **Phase 1: 擴展 Routes Schema**

```sql
ALTER TABLE routes
ADD COLUMN backend_auth_type VARCHAR(50) DEFAULT 'none',
ADD COLUMN backend_auth_config JSONB;
```

### **Phase 2: 後端 API 支援**

```python
# models.py
class RouteCreate(BaseModel):
    name: str
    path: str
    backend_url: str
    tags: Optional[List[str]] = []
    backend_auth_type: Optional[str] = "none"  # 新增
    backend_auth_config: Optional[dict] = None  # 新增

# main.py
@app.post("/api/routes")
async def create_route(data: RouteCreate, request: Request):
    user = await verify_clerk_token(request)
    
    # 如果有 auth config，需要 ADMIN 權限
    if data.backend_auth_config:
        await check_core_team_admin_only(user)
    else:
        await check_core_team_permission(user, "create")
    
    # 儲存（考慮加密）
    # ...
```

### **Phase 3: KV 同步**

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
                'config': route['backend_auth_config']  # 包含引用
            }
        }
    
    await cf_kv.put_routes(routes_map)
```

### **Phase 4: Worker 處理**

```javascript
// worker.js
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
          const token = env[authConfig.token_ref];  // 從環境變數讀取
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
    
    // 4. 轉發請求（帶上後端認證）
    const backendRequest = new Request(backendUrl, {
      method: request.method,
      headers: backendHeaders,
      body: request.body
    });
    
    return await fetch(backendRequest);
  }
}
```

### **Phase 5: UI 支援**

```jsx
// RouteForm.jsx
function RouteForm() {
  const [authType, setAuthType] = useState('none');
  const [authConfig, setAuthConfig] = useState({});
  
  return (
    <form>
      {/* 基本資訊 */}
      <input name="path" />
      <input name="backend_url" />
      
      {/* 後端認證設定 */}
      <div className="form-group">
        <label>後端服務認證方式</label>
        <select value={authType} onChange={e => setAuthType(e.target.value)}>
          <option value="none">無需認證</option>
          <option value="bearer">Bearer Token</option>
          <option value="api-key">API Key</option>
          <option value="basic">Basic Auth</option>
        </select>
      </div>
      
      {authType === 'bearer' && (
        <div className="form-group">
          <label>Token 環境變數名稱</label>
          <input 
            placeholder="例如: OPENAI_API_KEY"
            value={authConfig.token_ref || ''}
            onChange={e => setAuthConfig({...authConfig, token_ref: e.target.value})}
          />
          <small>
            ⚠️ 實際的 API Key 需要在 Cloudflare Worker 中設定為環境變數
          </small>
        </div>
      )}
      
      {authType === 'api-key' && (
        <>
          <div className="form-group">
            <label>Header 名稱 (可選)</label>
            <input 
              placeholder="預設: X-API-Key"
              value={authConfig.header_name || ''}
            />
          </div>
          <div className="form-group">
            <label>API Key 環境變數名稱</label>
            <input 
              placeholder="例如: AWS_API_KEY"
              value={authConfig.key_ref || ''}
            />
          </div>
        </>
      )}
    </form>
  );
}
```

---

## 🔒 安全策略

### **金鑰儲存層級**

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

---

## 🎨 UI 設計

### **創建路由（Core Team ADMIN）**

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

### **路由列表（普通用戶）**

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

### **編輯路由（Core Team ADMIN）**

```
┌──────────────────────────────────────────┐
│ 編輯路由                                 │
├──────────────────────────────────────────┤
│ 後端認證: Bearer Token                   │
│                                          │
│ 當前設定:                                │
│ Token 引用: OPENAI_API_KEY               │
│                                          │
│ [修改引用名稱]                           │
│ [移除認證設定]                           │
│                                          │
│ 註: 修改實際的 API Key 值請使用:         │
│ wrangler secret put OPENAI_API_KEY       │
└──────────────────────────────────────────┘
```

---

## 🔄 完整流程範例

### **設定 OpenAI 路由**

```bash
# Step 1: 在 Cloudflare 設定實際金鑰
cd worker
wrangler secret put OPENAI_API_KEY
# 輸入: sk-proj-xxxxxxxxxxxxxxxxxxxxx
✅ Secret OPENAI_API_KEY uploaded

# Step 2: 在管理系統創建路由
# UI 操作:
路徑: /api/openai
後端 URL: https://api.openai.com/v1
認證方式: Bearer Token
Token 引用: OPENAI_API_KEY
[創建路由]

# Step 3: 系統自動同步到 KV
{
  "/api/openai": {
    "url": "https://api.openai.com/v1",
    "tags": ["ai"],
    "auth": {
      "type": "bearer",
      "token_ref": "OPENAI_API_KEY"
    }
  }
}

# Step 4: n8n 使用
POST https://your-worker.workers.dev/api/openai/chat/completions
Headers:
  X-API-Key: ntk_your_token  ← 我們的 Token
Body:
  { "model": "gpt-4", "messages": [...] }

# Step 5: Worker 處理
1. 驗證 ntk_your_token ✅
2. 匹配路由 /api/openai ✅
3. 讀取 auth config
4. 從 env.OPENAI_API_KEY 讀取實際金鑰
5. 添加 Authorization: Bearer sk-proj-xxx
6. 轉發到 OpenAI API
7. 返回結果
```

---

## 📊 支援的認證類型總結

### **1. None（無需認證）**

```javascript
{
  "type": "none",
  "config": null
}

// Worker: 直接轉發，不添加任何 header
```

### **2. Bearer Token**

```javascript
{
  "type": "bearer",
  "config": {
    "token_ref": "OPENAI_API_KEY"
  }
}

// Worker: 
headers['Authorization'] = `Bearer ${env.OPENAI_API_KEY}`;
```

### **3. API Key**

```javascript
{
  "type": "api-key",
  "config": {
    "header_name": "X-API-Key",  // 可選
    "key_ref": "BACKEND_API_KEY"
  }
}

// Worker:
const headerName = config.header_name || 'X-API-Key';
headers[headerName] = env[config.key_ref];
```

### **4. Basic Auth**

```javascript
{
  "type": "basic",
  "config": {
    "username_ref": "SERVICE_USERNAME",
    "password_ref": "SERVICE_PASSWORD"
  }
}

// Worker:
const username = env[config.username_ref];
const password = env[config.password_ref];
const credentials = btoa(`${username}:${password}`);
headers['Authorization'] = `Basic ${credentials}`;
```

### **5. Custom Headers**

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

// Worker:
for (const [headerName, envVarName] of Object.entries(config.headers)) {
  headers[headerName] = env[envVarName];
}
```

---

## 🎯 推薦實施優先級

### **MVP（最小可行）**

```yaml
支援:
  ✅ none - 無需認證
  ✅ bearer - Bearer Token
  ✅ api-key - API Key

儲存:
  ✅ 引用環境變數名稱（不儲存實際值）
  ✅ 實際金鑰在 Cloudflare Secrets

UI:
  ✅ 創建時可以選擇認證類型
  ✅ 普通用戶看到「已設定」
  ✅ ADMIN 可以看到引用名稱
```

### **未來增強**

```yaml
  🔮 Basic Auth 支援
  🔮 Custom Headers 支援
  🔮 OAuth 2.0 支援
  🔮 金鑰輪換機制
  🔮 金鑰過期提醒
```

---

## ❓ 決策點

1. **是否現在實施後端認證功能？**
   - [ ] 是：現在就加入後端認證支援
   - [ ] 否：先完成基本路由管理，之後再加

2. **支援哪些認證類型？**
   - [ ] MVP：none, bearer, api-key
   - [ ] 完整：+ basic, custom

3. **金鑰儲存方式？**
   - [ ] 推薦：引用 Cloudflare Secrets
   - [ ] 備選：加密儲存在 PostgreSQL

---

**建議**: 先完成基本路由管理，後端認證作為下一個 Feature 實施。  
**原因**: 邏輯獨立，可以漸進式開發。

你想現在就實施後端認證功能，還是先把基本的路由管理測試完成？

