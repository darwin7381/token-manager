# API Token 集中管理系統 - PRD

> **版本**: v1.0  
> **日期**: 2025-10-28  
> **狀態**: 已實施（當前系統基於此 PRD）
> 
> ⚠️ **注意**: 本文檔使用 `department` 概念，當前系統已改為 `team_id`（基於 Per-Team Roles 架構）。核心需求和架構設計仍然有效。

---

## 1. 產品概述

### 1.1 產品定位
一套為多微服務架構設計的集中式API Token管理系統,解決分散式部署環境下的身份驗證與路由管理問題。

### 1.2 核心價值
- **集中管理**: 統一管理所有微服務的API Token,無需修改環境變數
- **動態配置**: 通過Web UI即時新增/撤銷Token和路由,無需重啟服務
- **n8n友好**: 支持標準HTTP Header方式的API Key驗證
- **跨主機支持**: 微服務可部署在不同供應商的不同主機上

### 1.3 目標用戶
- **管理員**: 負責創建和管理API Token
- **n8n工作流**: 使用Token調用微服務的自動化流程
- **微服務**: 被保護和路由的後端服務

---

## 2. 技術架構

### 2.1 架構模式
```
n8n Workflows → Cloudflare Worker (Gateway) → Backend Microservices
                      ↓
                Cloudflare KV (Config Storage)
                      ↑
                Token Manager (Railway)
                      ↓
                PostgreSQL (Data Storage)
```

### 2.2 組件說明

#### **組件A: Token Manager (管理系統)**
- **部署**: Railway
- **技術棧**: FastAPI + PostgreSQL + HTML/CSS/JS
- **職責**: 提供Web UI進行Token和路由的CRUD操作

#### **組件B: Cloudflare Worker (API Gateway)**
- **部署**: Cloudflare Edge Network
- **技術棧**: JavaScript (Worker)
- **職責**: 驗證API Key並轉發請求到對應後端

#### **組件C: Cloudflare KV (配置存儲)**
- **類型**: Key-Value存儲
- **職責**: 存儲Token元數據和路由映射配置

---

## 3. 功能需求

### 3.1 Token管理 (Must Have)

#### FR-1: 創建Token
**需求描述**:  
管理員可以通過Web UI創建新的API Token

**輸入**:
- `name` (必填): Token名稱,如 "Marketing-John"
- `department` (必填): 所屬部門
- `scopes` (必填): 權限範圍數組,如 ["image", "data"] 或 ["*"]
- `expires_days` (可選): 過期天數,默認90天

**處理流程**:
1. 生成格式為 `ntk_` + 32字節URL-safe隨機字符串的Token
2. 計算Token的SHA256 hash
3. 存入PostgreSQL (存hash,不存明文)
4. 調用Cloudflare API將Token元數據寫入KV
5. 記錄審計日誌

**輸出**:
```json
{
  "id": 1,
  "token": "ntk_xxxxxxxxxxxx",  // 只返回一次
  "name": "Marketing-John",
  "department": "marketing",
  "scopes": ["image", "data"]
}
```

**驗收標準**:
- Token生成使用加密安全的隨機數生成器
- Token只在創建時返回一次,後續無法查看
- 成功同步到Cloudflare KV (< 60秒內生效)

---

#### FR-2: 查看Token列表
**需求描述**:  
管理員可以查看所有已創建的Token (不包含Token明文)

**輸出字段**:
- `id`: Token ID
- `name`: Token名稱
- `department`: 所屬部門
- `scopes`: 權限範圍
- `created_at`: 創建時間
- `expires_at`: 過期時間
- `last_used`: 最後使用時間 (可選實現)

**驗收標準**:
- 列表按創建時間降序排列
- 只顯示活躍的Token (`is_active = true`)
- 不包含Token明文或hash

---

#### FR-3: 撤銷Token
**需求描述**:  
管理員可以撤銷(刪除)指定的Token

**輸入**:
- `token_id`: 要撤銷的Token ID

**處理流程**:
1. 從PostgreSQL刪除Token記錄
2. 調用Cloudflare API從KV刪除對應的Token數據
3. 記錄審計日誌

**驗收標準**:
- Token在< 60秒內全球失效
- 撤銷操作不可逆
- 記錄完整的審計日誌

---

### 3.2 路由管理 (Must Have)

#### FR-4: 創建路由
**需求描述**:  
管理員可以動態新增微服務路由映射

**輸入**:
- `path` (必填): 路徑前綴,如 "/api/image"
- `backend_url` (必填): 後端微服務URL,如 "https://img.railway.app"
- `description` (可選): 路由描述

**處理流程**:
1. 驗證path格式 (必須以/開頭)
2. 驗證backend_url格式 (必須是有效URL)
3. 存入PostgreSQL
4. 讀取所有路由構建完整映射
5. 調用Cloudflare API更新KV中的routes對象

**驗收標準**:
- path必須唯一
- 路由在< 60秒內生效
- Worker無需重新部署

---

#### FR-5: 查看路由列表
**需求描述**:  
管理員可以查看所有已配置的路由

**輸出字段**:
- `id`: 路由ID
- `path`: 路徑前綴
- `backend_url`: 後端URL
- `description`: 描述
- `created_at`: 創建時間

---

#### FR-6: 修改路由
**需求描述**:  
管理員可以修改現有路由的backend_url或description

**驗收標準**:
- 修改後立即同步到KV
- 不影響其他路由

---

#### FR-7: 刪除路由
**需求描述**:  
管理員可以刪除不再需要的路由

**驗收標準**:
- 刪除後從KV中移除
- 使用該路由的請求返回404

---

### 3.3 API驗證與轉發 (Must Have)

#### FR-8: API Key驗證
**需求描述**:  
Worker驗證每個進入的請求的API Key

**處理流程**:
```
1. 提取 X-API-Key header
2. 計算SHA256 hash
3. 查詢KV: token:{hash}
4. 檢查Token是否存在
5. 檢查Token是否過期
6. 檢查Token的scopes是否包含請求的服務
```

**錯誤處理**:
- 缺少API Key → 401 "Missing API Key"
- API Key無效 → 401 "Invalid API Key"  
- API Key已過期 → 401 "Token Expired"
- 權限不足 → 403 "Permission Denied"

---

#### FR-9: 請求路由與轉發
**需求描述**:  
Worker根據請求路徑將請求轉發到對應的後端微服務

**路由匹配邏輯**:
```javascript
// 按路徑長度降序排序,確保最具體的路徑優先匹配
// 例如: /api/image/process 應該匹配 /api/image 而不是 /api
sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length)
for (path of sortedPaths) {
  if (url.pathname.startsWith(path)) {
    backend = routes[path]
    break
  }
}
```

**URL構建**:
```
請求: https://api.yourcompany.workers.dev/api/image/process?size=large
匹配: /api/image → https://img.railway.app
轉發: https://img.railway.app/process?size=large
```

**驗收標準**:
- 正確移除匹配的路徑前綴
- 保留query parameters
- 轉發原始HTTP method和headers
- 轉發原始request body

---

#### FR-10: Scope權限檢查
**需求描述**:  
基於Token的scopes字段進行細粒度權限控制

**權限檢查邏輯**:
```javascript
// 從路徑提取服務名稱
// /api/image/xxx → serviceName = "image"
serviceName = matchedPath.split('/').filter(s => s)[1]

// 檢查權限
if (scopes.includes('*')) {
  // 擁有所有權限
  allow()
} else if (scopes.includes(serviceName)) {
  // 擁有特定服務權限
  allow()
} else {
  // 無權限
  deny()
}
```

**特殊scope**:
- `*`: 通配符,擁有所有權限
- 具體服務名: 如 `image`, `data`, `video`

---

### 3.4 審計與統計 (Should Have)

#### FR-11: 審計日誌
**需求描述**:  
記錄所有管理操作以供追溯

**記錄內容**:
```sql
audit_logs:
- action: create/update/delete
- entity_type: token/route
- entity_id: 實體ID
- details: JSON格式的詳細信息
- created_at: 操作時間
```

**驗收標準**:
- 所有CRUD操作都記錄
- 日誌不可修改
- 可通過API查詢最近的日誌

---

#### FR-12: 統計信息
**需求描述**:  
顯示系統使用概況

**統計指標**:
- 活躍Token總數
- 已配置路由總數
- 最近10條操作記錄

---

### 3.5 Web UI (Must Have)

#### FR-13: 管理界面
**需求描述**:  
提供友好的Web界面進行所有管理操作

**頁面結構**:
```
Header (系統標題)
  ↓
Tab Navigation (Token管理 | 路由管理 | 統計資訊)
  ↓
Content Area
  - Token管理頁: 創建表單 + Token列表
  - 路由管理頁: 創建表單 + 路由列表
  - 統計頁: 統計卡片 + 審計日誌
```

**UI要求**:
- 響應式設計,支持桌面和平板
- 清晰的成功/錯誤提示
- Token創建後醒目提示"只顯示一次"
- 刪除操作需二次確認
- 列表支持刷新按鈕

---

## 4. 非功能需求

### 4.1 性能需求

| 指標 | 要求 |
|-----|-----|
| Worker延遲 | P95 < 200ms |
| Token驗證 | < 50ms (邊緣緩存) |
| Token撤銷生效時間 | < 60秒 |
| 路由更新生效時間 | < 60秒 |
| 管理UI響應時間 | < 2秒 |

### 4.2 可用性需求

| 組件 | SLA目標 |
|-----|--------|
| Cloudflare Worker | 99.99% |
| Token Manager | 99% |
| 整體系統 | 99% |

**容錯設計**:
- Token Manager故障不影響已有Token的驗證
- Worker故障時可臨時移除驗證層
- KV數據持久化,不會丟失

### 4.3 安全需求

#### 數據安全
- ✅ Token明文永不存儲,只存SHA256 hash
- ✅ Token生成使用 `secrets.token_urlsafe(32)`
- ✅ 所有通信強制HTTPS
- ✅ 管理系統需要身份驗證 (Phase 2)

#### 傳輸安全
- ✅ Cloudflare自動提供SSL/TLS
- ✅ Worker到後端可配置HTTPS
- ✅ 敏感信息(如Token)不出現在URL中

#### 權限控制
- ✅ 基於Scopes的細粒度權限
- ✅ 審計日誌記錄所有操作
- ✅ Token支持過期時間

### 4.4 可擴展性需求

**負載能力**:
- 支持100個n8n工作流同時使用
- 預估流量: 24,000 請求/天
- 峰值QPS: 50 (假設峰值是平均值的10倍)

**水平擴展**:
- Worker自動全球分佈,無需手動擴展
- Token Manager支持多實例部署 (Phase 2)

### 4.5 維護性需求

**部署要求**:
- Worker部署零停機
- Token Manager支持滾動更新
- 所有環境變數通過Railway配置

**監控要求**:
- Cloudflare Dashboard自動監控Worker
- 審計日誌可查詢和分析
- 關鍵錯誤需要記錄 (Phase 2: Sentry集成)

---

## 5. 數據模型

### 5.1 PostgreSQL Schema

```sql
-- Tokens表
CREATE TABLE tokens (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    scopes TEXT[] NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    last_used TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Routes表
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    path VARCHAR(255) NOT NULL UNIQUE,
    backend_url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit Logs表
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_tokens_hash ON tokens(token_hash);
CREATE INDEX idx_tokens_active ON tokens(is_active);
CREATE INDEX idx_routes_path ON routes(path);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

### 5.2 Cloudflare KV Schema

```javascript
// Token數據 (每個token一個key)
Key: "token:{sha256_hash}"
Value: {
  "name": "Marketing-John",
  "department": "marketing",
  "scopes": ["image", "data"],
  "created_at": "2025-10-28T10:00:00Z",
  "expires_at": "2026-01-26T10:00:00Z"
}

// 路由映射 (單一key)
Key: "routes"
Value: {
  "/api/image": "https://image-service.railway.app",
  "/api/ffmpeg": "http://your-hetzner.com:8080",
  "/api/data": "https://data.your-vps.com"
}
```

---

## 6. API規格

### 6.1 Token Manager API

#### POST /api/tokens
創建新Token

**Request**:
```json
{
  "name": "Marketing-John",
  "department": "marketing",
  "scopes": ["image", "data"],
  "expires_days": 90
}
```

**Response 200**:
```json
{
  "id": 1,
  "token": "ntk_kRj9fL3mP8qN2sT7vX9yZ...",
  "name": "Marketing-John",
  "department": "marketing",
  "scopes": ["image", "data"]
}
```

---

#### GET /api/tokens
獲取Token列表

**Response 200**:
```json
[
  {
    "id": 1,
    "name": "Marketing-John",
    "department": "marketing",
    "scopes": ["image", "data"],
    "created_at": "2025-10-28T10:00:00Z",
    "expires_at": "2026-01-26T10:00:00Z",
    "last_used": null
  }
]
```

---

#### DELETE /api/tokens/:id
撤銷Token

**Response 200**:
```json
{
  "status": "deleted"
}
```

---

#### POST /api/routes
創建路由

**Request**:
```json
{
  "path": "/api/image",
  "backend_url": "https://image-service.railway.app",
  "description": "圖片處理服務"
}
```

---

#### GET /api/routes
獲取路由列表

---

#### PUT /api/routes/:id
修改路由

---

#### DELETE /api/routes/:id
刪除路由

---

#### GET /api/stats
獲取統計信息

**Response 200**:
```json
{
  "total_tokens": 5,
  "total_routes": 3,
  "recent_activity": [
    {
      "action": "create",
      "entity_type": "token",
      "details": {"name": "Marketing-John"},
      "created_at": "2025-10-28T10:00:00Z"
    }
  ]
}
```

---

#### GET /health
健康檢查

**Response 200**:
```json
{
  "status": "healthy"
}
```

---

### 6.2 Cloudflare Worker API

#### 任意路徑請求
驗證並轉發請求

**Request**:
```
POST https://api.yourcompany.workers.dev/api/image/process
Headers:
  X-API-Key: ntk_xxxxxxxxxxxx
  Content-Type: application/json
Body:
  {"image_url": "https://..."}
```

**Response**: 透傳後端微服務的響應

**Error Responses**:
```json
// 401 - Missing API Key
{
  "error": "Missing API Key",
  "message": "Please provide X-API-Key header"
}

// 401 - Invalid API Key
{
  "error": "Invalid API Key",
  "message": "The provided API Key is invalid or has been revoked"
}

// 401 - Token Expired
{
  "error": "Token Expired",
  "message": "The API Key has expired"
}

// 403 - Permission Denied
{
  "error": "Permission Denied",
  "message": "Token does not have 'image' scope"
}

// 404 - Route Not Found
{
  "error": "Route Not Found",
  "message": "No route configured for /api/unknown"
}

// 500 - Internal Server Error
{
  "error": "Internal Server Error",
  "message": "..."
}
```

---

## 7. 部署架構

### 7.1 環境配置

#### Token Manager (Railway)
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token
CF_KV_NAMESPACE_ID=your_kv_namespace_id
```

#### Cloudflare Worker
```toml
# wrangler.toml
name = "api-gateway"
main = "worker.js"
compatibility_date = "2024-10-01"

kv_namespaces = [
  { binding = "TOKENS", id = "your_kv_namespace_id" }
]
```

### 7.2 部署流程

**Token Manager**:
1. Railway自動從Dockerfile構建
2. 連接PostgreSQL
3. 初始化數據表
4. 啟動FastAPI服務

**Cloudflare Worker**:
1. `wrangler deploy`部署到邊緣網絡
2. 全球分佈,自動生效
3. 綁定KV Namespace

---

## 8. 成功指標

### 8.1 技術指標
- [ ] Worker P95延遲 < 200ms
- [ ] Token撤銷在60秒內全球生效
- [ ] 系統整體可用性 > 99%
- [ ] 零安全事件 (Token洩露、未授權訪問等)

### 8.2 業務指標
- [ ] 支持100個n8n工作流正常運行
- [ ] 管理員可在5分鐘內完成Token創建和分發
- [ ] 新微服務接入時間 < 10分鐘

---

## 9. 約束與限制

### 9.1 技術約束
- Cloudflare KV寫入延遲: 最長60秒
- Cloudflare免費版限制: 100,000請求/天
- Railway Hobby限制: 512MB RAM

### 9.2 成本約束
- 月度預算: $10-15
  - Railway: $5-10
  - Cloudflare: $0 (免費版足夠)

### 9.3 兼容性約束
- 必須支持標準HTTP Header的API Key方式
- 後端微服務無需任何改動
- n8n工作流只需修改URL和添加Header

---

## 10. 風險與對策

| 風險 | 影響 | 概率 | 對策 |
|-----|------|------|------|
| Cloudflare Worker服務中斷 | 高 | 極低 | 監控+告警,必要時臨時移除驗證層 |
| Token Manager故障 | 低 | 低 | 不影響已有Token驗證,修復即可 |
| KV同步延遲超過60秒 | 中 | 低 | 文檔說明,管理員等待後再使用 |
| Token洩露 | 高 | 中 | 立即撤銷功能,審計日誌追溯 |
| 流量超出免費額度 | 低 | 低 | 監控用量,必要時升級到付費版 |

---

## 11. 開發優先級

### Phase 1 (MVP) - Must Have
- [P0] Token CRUD功能
- [P0] 路由CRUD功能
- [P0] Cloudflare Worker驗證與轉發
- [P0] Web UI基礎界面
- [P0] PostgreSQL數據持久化
- [P0] Cloudflare KV同步機制

### Phase 2 - Should Have
- [P1] 審計日誌查詢界面
- [P1] Token使用統計
- [P1] 管理系統身份驗證
- [P1] Rate Limiting

### Phase 3 - Could Have
- [P2] SSO整合
- [P2] Webhook通知
- [P2] 多環境支持
- [P2] API版本控制

---

## 12. 附錄

### 12.1 術語表
- **Token**: API Key,格式為 `ntk_` + 隨機字符串
- **Scope**: 權限範圍,控制Token可訪問的服務
- **Route**: 路徑到後端URL的映射關係
- **KV**: Cloudflare Key-Value存儲
- **Worker**: Cloudflare邊緣計算函數

### 12.2 參考文檔
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare KV](https://developers.cloudflare.com/kv/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Railway](https://docs.railway.app/)

---

**文件結束**

