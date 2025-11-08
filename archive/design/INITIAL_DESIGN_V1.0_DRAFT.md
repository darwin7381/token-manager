# API Token 集中管理系統 - 完整解決方案文件

> **文件版本：** v1.0  
> **最後更新：** 2025-10-28  
> **適用場景：** 多微服務分散式部署的 API Token 集中管理

---

## 📋 目錄

1. [原始需求與考量](#1-原始需求與考量)
2. [方案要求總結](#2-方案要求總結)
3. [建議方案與實施](#3-建議方案與實施)
4. [附錄](#4-附錄)

---

## 1. 原始需求與考量

### 1.1 核心問題

#### **問題描述：**
目前有 30-100 個 n8n 工作流需要調用各種微服務。這些工作流分佈在公司不同的人手中使用，需要一個集中管理 API Token 的機制，而不是將 Token 硬編碼在 Railway 環境變數中。

#### **當前痛點：**
1. **管理困難**：每次新增或撤銷 Token 都要修改 Railway 環境變數並重啟服務
2. **安全風險**：Token 分散在各處，難以追蹤和審計
3. **協作問題**：給不同部門/人員分配不同權限的 Token 很麻煩
4. **擴展性差**：無法動態新增或調整 Token

---

### 1.2 技術環境與約束

#### **基礎設施現狀：**
- **工作流引擎**：n8n
- **工作流數量**：30-100 個
- **主要部署平台**：Railway
- **微服務分佈**：
  - Railway：輕量級微服務（圖片處理、數據轉換等）
  - Hetzner：重型服務（ffmpeg 影片處理等）
  - 自有 VPS：其他微服務
  
#### **關鍵約束：**
1. ✅ **必須自架**：不考慮完全託管的商業服務（如 Auth0、AWS API Gateway）
2. ✅ **跨主機支持**：微服務分散在不同供應商的不同主機上
3. ✅ **n8n 友好**：必須支持 API Key 方式（HTTP Header），而不是只有 JWT
4. ✅ **動態管理**：需要 Web UI 可視化操作，而非修改配置文件
5. ✅ **逐步遷移**：能夠逐步將現有微服務接入，不需要一次性改造所有服務
6. ✅ **預算有限**：希望控制在合理成本範圍內（< $30/月）

---

### 1.3 技術考量

#### **架構層面：**

**1. 驗證方式選擇**
- ❌ **純 JWT**：n8n HTTP 節點使用 Bearer Token 太長，容易出錯
- ✅ **API Key**：`X-API-Key: ntk_xxxxx` 簡單直觀
- ✅ **支持兩者**：API Key 為主，JWT 作為選項

**2. 部署模式**
- ❌ **每台主機都部署代理**：維護成本高，配置複雜
- ✅ **單一入口 Gateway**：統一驗證，簡化管理
- ⚠️ **分散式驗證**：無單點故障，但缺乏統一入口

**3. 管理界面**
- ❌ **Konga**：已停止維護（2021），只支持舊版 PostgreSQL
- ❌ **直接操作資料庫**：非技術人員無法使用
- ✅ **自建 Web UI**：完全控制，符合需求

**4. Token 撤銷時效性**
- **即時撤銷**：適合高安全要求場景
- **短延遲撤銷**（1-5 分鐘）：可接受的折衷方案
- **長期有效**（30-90 天）：JWT 方式的權衡

---

### 1.4 業務需求

#### **功能需求：**

**Token 管理**
- ✅ 創建 Token（指定名稱、部門、權限範圍）
- ✅ 查看 Token 列表（隱藏實際 Token 值）
- ✅ 撤銷 Token（立即或短時間內失效）
- ✅ 設置 Token 過期時間
- ✅ 查看 Token 使用記錄（最後使用時間）

**微服務管理**
- ✅ 動態新增微服務路由（無需修改代碼）
- ✅ 修改微服務後端 URL
- ✅ 刪除微服務路由

**權限控制**
- ✅ 基於 Scopes 的權限控制（如：image, data, video）
- ✅ 不同用戶/部門不同權限

**審計與監控**
- ✅ Token 使用日誌
- ✅ 創建/撤銷記錄
- ⚠️ 詳細的請求統計（可選）

---

### 1.5 非功能性需求

| 需求項 | 要求 | 優先級 |
|--------|------|--------|
| **可用性** | 99%+ | 高 |
| **延遲** | < 200ms（API Gateway 層） | 中 |
| **擴展性** | 支持 100+ 工作流同時使用 | 高 |
| **安全性** | Token 安全存儲、傳輸加密 | 高 |
| **維護性** | 易於部署和維護 | 高 |
| **成本** | < $30/月 | 高 |
| **學習曲線** | 團隊能快速上手 | 中 |

---

### 1.6 排除方案與原因

在討論過程中，以下方案被排除或降低優先級：

| 方案 | 排除原因 |
|------|----------|
| **Kong + Konga** | Konga 已停止維護，只支持舊版 PostgreSQL |
| **純 JWT** | n8n HTTP 節點使用不便，Token 太長 |
| **每台主機部署 Traefik** | 維護複雜，配置分散 |
| **Auth0 / Clerk** | 非自架，不符合要求 |
| **Keycloak** | 功能過於複雜，學習曲線陡峭，資源消耗大 |
| **AWS API Gateway** | 非自架，且綁定 AWS 生態 |
| **Istio / 服務網格** | 需要 Kubernetes，過於複雜 |

---

## 2. 方案要求總結

### 2.1 必須滿足（Must Have）

#### **架構要求**
1. ✅ **統一入口**：n8n 只需要記住一個 Gateway URL
2. ✅ **動態配置**：通過 Web UI 管理，無需修改代碼或重啟服務
3. ✅ **跨主機支持**：能夠將請求轉發到不同主機/供應商的微服務
4. ✅ **微服務無感**：現有微服務無需或只需最小改動

#### **功能要求**
1. ✅ **API Key 驗證**：支持 `X-API-Key` Header 方式
2. ✅ **Token CRUD**：創建、查看、撤銷 Token
3. ✅ **路由管理**：動態新增/修改/刪除微服務路由
4. ✅ **權限控制**：基於 Scopes 的細粒度權限

#### **運維要求**
1. ✅ **易部署**：部署步驟簡單清晰
2. ✅ **低維護**：日常維護工作量少
3. ✅ **可觀測**：能夠查看使用情況和日誌

---

### 2.2 應該滿足（Should Have）

1. ⭐ Token 撤銷在合理時間內生效（< 5 分鐘）
2. ⭐ 自動 HTTPS 支持
3. ⭐ DDoS 基礎防護
4. ⭐ 全球低延遲（如果用戶分佈全球）
5. ⭐ 審計日誌（誰在何時創建/使用/撤銷了 Token）

---

### 2.3 可以滿足（Could Have）

1. 💡 限流功能（Rate Limiting）
2. 💡 請求統計和分析
3. 💡 Webhook 通知（Token 即將過期等）
4. 💡 多因素認證（MFA）
5. 💡 SSO 整合

---

### 2.4 技術選型原則

根據需求，理想的解決方案應該：

```
優先級排序：
1. 功能完整性 > 技術先進性
2. 易維護性 > 功能豐富性  
3. 成本效益 > 性能極致
4. 快速上線 > 完美架構
```

---

## 3. 建議方案與實施

### 3.1 推薦方案：Cloudflare Workers + 自建管理系統

#### **🎯 為什麼選擇這個方案？**

**完美匹配度分析：**

| 需求 | 匹配度 | 說明 |
|------|--------|------|
| 統一入口 | ✅✅✅ | n8n 只需要記 `api.yourcompany.workers.dev` |
| 動態管理 | ✅✅✅ | Web UI 操作，即時同步到 Cloudflare KV |
| 跨主機支持 | ✅✅✅ | Worker 可轉發到任意 URL，無需 VPN |
| n8n 友好 | ✅✅✅ | 標準 `X-API-Key` Header |
| 微服務無感 | ✅✅✅ | 完全無需改動 |
| 低維護 | ✅✅✅ | Worker 無伺服器，零運維 |
| 成本 | ✅✅✅ | $5-10/月 |
| 快速上線 | ✅✅✅ | 1-2 天可部署完成 |

---

### 3.2 完整架構設計

#### **架構圖：**

```
┌─────────────────────────────────────────────────────┐
│                    n8n 工作流                        │
│  所有請求統一發送到：                                 │
│  https://api.yourcompany.workers.dev                │
│  Header: X-API-Key: ntk_xxxxxxxxxxxxx               │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓ HTTPS 請求
┌─────────────────────────────────────────────────────┐
│              Cloudflare Workers                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  worker.js (純轉發邏輯，幾乎不變)             │  │
│  │                                              │  │
│  │  1. 驗證 API Key                             │  │
│  │     └─ 從 KV 查詢 token:hash                 │  │
│  │                                              │  │
│  │  2. 查找路由                                  │  │
│  │     └─ 從 KV 查詢 routes 映射                │  │
│  │                                              │  │
│  │  3. 轉發請求到對應後端                        │  │
│  └─────────────┬────────────────────────────────┘  │
│                │                                    │
│  ┌─────────────▼────────────────────────────────┐  │
│  │  Cloudflare KV (配置存儲)                     │  │
│  │                                              │  │
│  │  tokens:                                     │  │
│  │    token:abc123... → {name, dept, scopes}   │  │
│  │    token:def456... → {name, dept, scopes}   │  │
│  │                                              │  │
│  │  routes:                                     │  │
│  │    {                                         │  │
│  │      "/api/image": "https://img.railway...",│  │
│  │      "/api/ffmpeg": "http://hetzner.com...",│  │
│  │      "/api/data": "https://vps.com..."      │  │
│  │    }                                         │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────┘
                      │ 轉發請求
      ┌───────────────┼───────────────┐
      │               │               │
      ↓               ↓               ↓
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Railway  │    │ Hetzner  │    │ 你的 VPS │
│ 微服務1  │    │  ffmpeg  │    │ 微服務2  │
│ 微服務2  │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘


        ↑ 配置同步 ↑
        
┌─────────────────────────────────────────────────────┐
│          Token 管理系統 (Railway)                     │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  前端 UI (React/HTML)                       │    │
│  │  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │ Token 管理   │  │ 路由管理     │       │    │
│  │  │              │  │              │       │    │
│  │  │ [創建 Token] │  │ [新增路由]   │       │    │
│  │  │ [查看列表]   │  │ [修改 URL]   │       │    │
│  │  │ [撤銷 Token] │  │ [刪除路由]   │       │    │
│  │  └──────────────┘  └──────────────┘       │    │
│  └────────────┬───────────────────────────────┘    │
│               │                                     │
│  ┌────────────▼───────────────────────────────┐    │
│  │  後端 API (FastAPI/Express)                 │    │
│  │                                            │    │
│  │  POST   /api/tokens                        │    │
│  │  GET    /api/tokens                        │    │
│  │  DELETE /api/tokens/:id                    │    │
│  │                                            │    │
│  │  POST   /api/routes                        │    │
│  │  PUT    /api/routes/:id                    │    │
│  │  DELETE /api/routes/:id                    │    │
│  └────────────┬───────────────────────────────┘    │
│               │                                     │
│  ┌────────────▼───────────────────────────────┐    │
│  │  PostgreSQL                                 │    │
│  │  ┌──────────────────────────────────────┐ │    │
│  │  │ tokens 表                             │ │    │
│  │  │  - id, token_hash, name, department  │ │    │
│  │  │  - scopes, created_at, expires_at    │ │    │
│  │  └──────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────┐ │    │
│  │  │ routes 表                             │ │    │
│  │  │  - id, path, backend_url, description│ │    │
│  │  └──────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────┐ │    │
│  │  │ audit_logs 表                         │ │    │
│  │  │  - action, user, timestamp, details  │ │    │
│  │  └──────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  每次操作都調用 Cloudflare API 同步到 KV              │
└──────────────────────────────────────────────────────┘
```

---

### 3.3 核心組件說明

#### **組件 1：Token 管理系統（你的控制中心）**

**部署位置：** Railway  
**技術棧：** FastAPI (Python) + PostgreSQL + React/HTML  
**職責：**
- 提供 Web UI 供管理員操作
- 處理 Token 的 CRUD 操作
- 管理微服務路由映射
- 同步配置到 Cloudflare KV
- 記錄審計日誌

**核心邏輯：**
```python
# 創建 Token
def create_token():
    1. 生成隨機 token (ntk_xxxxx)
    2. 計算 SHA256 hash
    3. 存入 PostgreSQL (hash, name, dept, scopes)
    4. 調用 CF API 寫入 KV
    5. 返回 token (只顯示一次！)

# 撤銷 Token
def revoke_token():
    1. 從 PostgreSQL 刪除記錄
    2. 調用 CF API 從 KV 刪除
    3. 記錄審計日誌

# 新增路由
def create_route():
    1. 存入 PostgreSQL (path, backend_url)
    2. 讀取所有路由
    3. 調用 CF API 更新 KV 中的 routes 對象
```

---

#### **組件 2：Cloudflare Worker（轉發引擎）**

**部署位置：** Cloudflare Edge（全球分佈）  
**技術棧：** JavaScript (Worker)  
**職責：**
- 驗證 API Key
- 查找路由映射
- 轉發請求到後端微服務
- 返回響應

**核心邏輯：**
```javascript
// Worker 主邏輯（幾乎永遠不變）
async function handleRequest(request, env) {
    // 1. 提取 API Key
    const apiKey = request.headers.get('X-API-Key');
    
    // 2. 計算 hash 並驗證
    const hash = await sha256(apiKey);
    const tokenData = await env.KV.get(`token:${hash}`, {type: 'json'});
    if (!tokenData) return new Response('Unauthorized', {status: 401});
    
    // 3. 查找路由
    const routes = await env.KV.get('routes', {type: 'json'});
    const url = new URL(request.url);
    const backend = matchRoute(url.pathname, routes);
    if (!backend) return new Response('Not Found', {status: 404});
    
    // 4. 轉發請求
    return fetch(backend, {
        method: request.method,
        headers: request.headers,
        body: request.body
    });
}
```

**為什麼 Worker 代碼幾乎不變？**
- ✅ 所有配置都在 KV 中
- ✅ 只負責「讀取配置 → 驗證 → 轉發」
- ✅ 新增 Token/路由不需要改 Worker

---

#### **組件 3：Cloudflare KV（配置存儲）**

**用途：** 高性能全球分佈的 Key-Value 存儲  
**存儲內容：**

```javascript
// Token 數據（每個 token 一個 key）
"token:abc123def456..." → {
    "name": "Marketing-John",
    "department": "marketing",
    "scopes": ["image", "data"],
    "created_at": "2025-10-28T10:00:00Z"
}

// 路由映射（單一對象）
"routes" → {
    "/api/image": "https://image-service.railway.app",
    "/api/ffmpeg": "http://your-hetzner.com:8080",
    "/api/data": "https://data.your-vps.com"
}
```

**同步機制：**
- 管理系統每次操作後立即調用 CF API 更新 KV
- KV 更新後全球生效時間：< 60 秒
- Worker 每次請求都實時讀取 KV（有邊緣緩存）

---

### 3.4 數據流詳解

#### **場景 1：管理員創建新 Token**

```
1. 管理員打開 Web UI
   https://token-manager.railway.app
   
2. 填寫表單：
   - 名稱：Marketing-John
   - 部門：marketing
   - 權限：image, data
   - 過期：90天
   
3. 點擊「創建」按鈕
   ↓
4. 前端發送請求：
   POST https://token-manager.railway.app/api/tokens
   Body: {name, department, scopes, expires_days}
   ↓
5. 後端處理：
   a. 生成 token: ntk_kRj9fL3mP8q...
   b. 計算 hash: sha256(token)
   c. 存入 PostgreSQL
   d. 調用 Cloudflare API:
      PUT https://api.cloudflare.com/.../kv/.../values/token:hash
      Body: {name, department, scopes, created_at}
   ↓
6. 返回給前端（只顯示一次！）：
   {
     "token": "ntk_kRj9fL3mP8q...",
     "name": "Marketing-John"
   }
   ↓
7. 管理員複製 token 並發給 John
```

---

#### **場景 2：n8n 使用 Token 調用微服務**

```
1. n8n 工作流執行到 HTTP 節點
   ↓
2. 發送請求：
   POST https://api.yourcompany.workers.dev/api/image/process
   Headers:
     X-API-Key: ntk_kRj9fL3mP8q...
     Content-Type: application/json
   Body: {image_url: "..."}
   ↓
3. 到達 Cloudflare Worker：
   a. 提取 X-API-Key
   b. 計算 sha256 hash
   c. 查詢 KV: token:hash
      ↓ 找到：{name: "Marketing-John", scopes: ["image", "data"]}
   d. 檢查權限：/api/image 需要 "image" scope ✅
   e. 查詢 KV: routes
      ↓ 找到："/api/image" → "https://image-service.railway.app"
   f. 構建後端請求：
      POST https://image-service.railway.app/api/image/process
      Headers: (原始 headers)
      Body: (原始 body)
   g. 轉發請求到 Railway
   ↓
4. Railway 上的微服務處理請求
   ↓
5. 返回結果給 Worker
   ↓
6. Worker 原樣返回給 n8n
   ↓
7. n8n 繼續執行後續流程
```

**對 n8n 來說：**
- 只知道一個入口：`api.yourcompany.workers.dev`
- 只需要帶上 `X-API-Key` header
- 完全不知道後端微服務在哪台主機
- 完全不知道驗證邏輯

---

#### **場景 3：管理員新增微服務路由**

```
1. 公司新部署了一個 PDF 處理服務在 Hetzner
   URL: http://pdf-service.hetzner.com:9000
   
2. 管理員打開 Web UI 的「路由管理」頁面
   
3. 填寫表單：
   - 路徑：/api/pdf
   - 後端 URL：http://pdf-service.hetzner.com:9000
   - 描述：PDF 處理服務（Hetzner）
   
4. 點擊「新增」
   ↓
5. 前端發送請求：
   POST https://token-manager.railway.app/api/routes
   ↓
6. 後端處理：
   a. 存入 PostgreSQL routes 表
   b. 讀取所有路由（包括新的）
   c. 構建路由對象：
      {
        "/api/image": "https://...",
        "/api/ffmpeg": "http://...",
        "/api/pdf": "http://pdf-service.hetzner.com:9000"  ← 新的
      }
   d. 調用 Cloudflare API 更新 KV:
      PUT https://api.cloudflare.com/.../kv/.../values/routes
      Body: {完整路由對象}
   ↓
7. 等待 < 60 秒，全球 Worker 都能讀到新路由
   ↓
8. n8n 立即可以使用：
   POST https://api.yourcompany.workers.dev/api/pdf/convert
   Header: X-API-Key: ntk_...
```

**重點：**
- ✅ 無需修改 Worker 代碼
- ✅ 無需重啟任何服務
- ✅ 無需通知 n8n 使用者（他們只需要知道新路徑）

---

### 3.5 完整實現代碼

#### **文件結構：**

```
project/
├── token-manager/              # 管理系統（Railway）
│   ├── backend/
│   │   ├── main.py            # FastAPI 應用
│   │   ├── models.py          # 數據模型
│   │   ├── database.py        # 資料庫連接
│   │   ├── cloudflare.py      # CF API 客戶端
│   │   └── requirements.txt
│   ├── frontend/
│   │   └── index.html         # 管理 UI
│   ├── docker-compose.yml
│   └── Dockerfile
│
└── cloudflare-worker/          # Cloudflare Worker
    ├── worker.js              # Worker 代碼
    └── wrangler.toml          # 配置文件
```

---

#### **代碼 1：Token Manager 後端 (main.py)**

```python
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import secrets
import hashlib
import os
import httpx
import asyncpg

app = FastAPI(title="Token Manager")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 環境變數
DATABASE_URL = os.getenv("DATABASE_URL")
CF_ACCOUNT_ID = os.getenv("CF_ACCOUNT_ID")
CF_API_TOKEN = os.getenv("CF_API_TOKEN")
CF_KV_NAMESPACE_ID = os.getenv("CF_KV_NAMESPACE_ID")

# ==================== 數據模型 ====================

class TokenCreate(BaseModel):
    name: str
    department: str
    scopes: List[str]
    expires_days: Optional[int] = 90

class TokenResponse(BaseModel):
    id: int
    name: str
    department: str
    scopes: List[str]
    created_at: datetime
    expires_at: Optional[datetime]
    last_used: Optional[datetime]

class RouteCreate(BaseModel):
    path: str
    backend_url: str
    description: str

class RouteResponse(BaseModel):
    id: int
    path: str
    backend_url: str
    description: str
    created_at: datetime

# ==================== 資料庫初始化 ====================

@app.on_event("startup")
async def startup():
    app.state.db = await asyncpg.create_pool(DATABASE_URL)
    
    async with app.state.db.acquire() as conn:
        # Tokens 表
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS tokens (
                id SERIAL PRIMARY KEY,
                token_hash VARCHAR(64) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                department VARCHAR(100) NOT NULL,
                scopes TEXT[] NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMP,
                last_used TIMESTAMP,
                is_active BOOLEAN NOT NULL DEFAULT TRUE
            )
        """)
        
        # Routes 表
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS routes (
                id SERIAL PRIMARY KEY,
                path VARCHAR(255) NOT NULL UNIQUE,
                backend_url TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
        
        # Audit logs 表
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                action VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INTEGER,
                details JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)

@app.on_event("shutdown")
async def shutdown():
    await app.state.db.close()

# ==================== 工具函數 ====================

def generate_token() -> str:
    """生成安全的 API Token"""
    return f"ntk_{secrets.token_urlsafe(32)}"

def hash_token(token: str) -> str:
    """計算 token 的 SHA256 hash"""
    return hashlib.sha256(token.encode()).hexdigest()

async def sync_token_to_cf(token_hash: str, data: dict):
    """同步單個 token 到 Cloudflare KV"""
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces/{CF_KV_NAMESPACE_ID}/values/token:{token_hash}"
    
    async with httpx.AsyncClient() as client:
        response = await client.put(
            url,
            headers={
                "Authorization": f"Bearer {CF_API_TOKEN}",
                "Content-Type": "application/json"
            },
            json=data
        )
        
        if response.status_code not in [200, 201]:
            raise HTTPException(500, f"Failed to sync to Cloudflare: {response.text}")

async def delete_token_from_cf(token_hash: str):
    """從 Cloudflare KV 刪除 token"""
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces/{CF_KV_NAMESPACE_ID}/values/token:{token_hash}"
    
    async with httpx.AsyncClient() as client:
        await client.delete(
            url,
            headers={"Authorization": f"Bearer {CF_API_TOKEN}"}
        )

async def sync_all_routes_to_cf():
    """同步所有路由到 Cloudflare KV"""
    async with app.state.db.acquire() as conn:
        routes = await conn.fetch("SELECT path, backend_url FROM routes")
    
    routes_map = {route['path']: route['backend_url'] for route in routes}
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces/{CF_KV_NAMESPACE_ID}/values/routes"
    
    async with httpx.AsyncClient() as client:
        response = await client.put(
            url,
            headers={
                "Authorization": f"Bearer {CF_API_TOKEN}",
                "Content-Type": "application/json"
            },
            json=routes_map
        )
        
        if response.status_code not in [200, 201]:
            raise HTTPException(500, f"Failed to sync routes: {response.text}")

async def log_audit(action: str, entity_type: str, entity_id: int = None, details: dict = None):
    """記錄審計日誌"""
    async with app.state.db.acquire() as conn:
        await conn.execute("""
            INSERT INTO audit_logs (action, entity_type, entity_id, details)
            VALUES ($1, $2, $3, $4)
        """, action, entity_type, entity_id, details)

# ==================== Token API ====================

@app.post("/api/tokens", response_model=dict)
async def create_token(data: TokenCreate):
    """創建新的 API Token"""
    
    # 1. 生成 token
    token = generate_token()
    token_hash = hash_token(token)
    
    # 2. 計算過期時間
    expires_at = None
    if data.expires_days:
        expires_at = datetime.utcnow() + timedelta(days=data.expires_days)
    
    # 3. 存入資料庫
    async with app.state.db.acquire() as conn:
        token_id = await conn.fetchval("""
            INSERT INTO tokens (token_hash, name, department, scopes, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        """, token_hash, data.name, data.department, data.scopes, expires_at)
    
    # 4. 同步到 Cloudflare KV
    await sync_token_to_cf(token_hash, {
        "name": data.name,
        "department": data.department,
        "scopes": data.scopes,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": expires_at.isoformat() if expires_at else None
    })
    
    # 5. 審計日誌
    await log_audit("create", "token", token_id, {"name": data.name})
    
    # 6. 返回（只顯示一次！）
    return {
        "id": token_id,
        "token": token,  # ⚠️ 只在創建時返回！
        "name": data.name,
        "department": data.department,
        "scopes": data.scopes
    }

@app.get("/api/tokens", response_model=List[TokenResponse])
async def list_tokens():
    """列出所有 tokens（不包含實際 token 值）"""
    async with app.state.db.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, name, department, scopes, created_at, expires_at, last_used
            FROM tokens
            WHERE is_active = TRUE
            ORDER BY created_at DESC
        """)
    
    return [dict(row) for row in rows]

@app.delete("/api/tokens/{token_id}")
async def delete_token(token_id: int):
    """撤銷（刪除）token"""
    
    # 1. 獲取 token_hash
    async with app.state.db.acquire() as conn:
        token = await conn.fetchrow("""
            SELECT token_hash, name FROM tokens WHERE id = $1
        """, token_id)
        
        if not token:
            raise HTTPException(404, "Token not found")
        
        # 2. 從資料庫刪除
        await conn.execute("DELETE FROM tokens WHERE id = $1", token_id)
    
    # 3. 從 Cloudflare KV 刪除
    await delete_token_from_cf(token['token_hash'])
    
    # 4. 審計日誌
    await log_audit("delete", "token", token_id, {"name": token['name']})
    
    return {"status": "deleted"}

# ==================== Route API ====================

@app.post("/api/routes", response_model=RouteResponse)
async def create_route(data: RouteCreate):
    """新增微服務路由"""
    
    # 1. 存入資料庫
    async with app.state.db.acquire() as conn:
        route_id = await conn.fetchval("""
            INSERT INTO routes (path, backend_url, description)
            VALUES ($1, $2, $3)
            RETURNING id
        """, data.path, data.backend_url, data.description)
        
        created_at = await conn.fetchval(
            "SELECT created_at FROM routes WHERE id = $1", route_id
        )
    
    # 2. 同步所有路由到 Cloudflare
    await sync_all_routes_to_cf()
    
    # 3. 審計日誌
    await log_audit("create", "route", route_id, {
        "path": data.path,
        "backend_url": data.backend_url
    })
    
    return {
        "id": route_id,
        "path": data.path,
        "backend_url": data.backend_url,
        "description": data.description,
        "created_at": created_at
    }

@app.get("/api/routes", response_model=List[RouteResponse])
async def list_routes():
    """列出所有路由"""
    async with app.state.db.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, path, backend_url, description, created_at
            FROM routes
            ORDER BY created_at DESC
        """)
    
    return [dict(row) for row in rows]

@app.put("/api/routes/{route_id}", response_model=RouteResponse)
async def update_route(route_id: int, data: RouteCreate):
    """修改路由"""
    
    async with app.state.db.acquire() as conn:
        await conn.execute("""
            UPDATE routes
            SET path = $1, backend_url = $2, description = $3
            WHERE id = $4
        """, data.path, data.backend_url, data.description, route_id)
        
        route = await conn.fetchrow("SELECT * FROM routes WHERE id = $1", route_id)
        
        if not route:
            raise HTTPException(404, "Route not found")
    
    # 同步到 Cloudflare
    await sync_all_routes_to_cf()
    
    # 審計日誌
    await log_audit("update", "route", route_id, {
        "path": data.path,
        "backend_url": data.backend_url
    })
    
    return dict(route)

@app.delete("/api/routes/{route_id}")
async def delete_route(route_id: int):
    """刪除路由"""
    
    async with app.state.db.acquire() as conn:
        route = await conn.fetchrow("SELECT path FROM routes WHERE id = $1", route_id)
        
        if not route:
            raise HTTPException(404, "Route not found")
        
        await conn.execute("DELETE FROM routes WHERE id = $1", route_id)
    
    # 同步到 Cloudflare
    await sync_all_routes_to_cf()
    
    # 審計日誌
    await log_audit("delete", "route", route_id, {"path": route['path']})
    
    return {"status": "deleted"}

# ==================== 統計 API ====================

@app.get("/api/stats")
async def get_stats():
    """獲取統計信息"""
    async with app.state.db.acquire() as conn:
        total_tokens = await conn.fetchval("SELECT COUNT(*) FROM tokens WHERE is_active = TRUE")
        total_routes = await conn.fetchval("SELECT COUNT(*) FROM routes")
        
        recent_logs = await conn.fetch("""
            SELECT action, entity_type, details, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT 10
        """)
    
    return {
        "total_tokens": total_tokens,
        "total_routes": total_routes,
        "recent_activity": [dict(log) for log in recent_logs]
    }

# ==================== 健康檢查 ====================

@app.get("/health")
async def health():
    return {"status": "healthy"}

# ==================== 靜態文件（前端） ====================

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
```

---

#### **代碼 2：前端 UI (index.html)**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Token 管理系統</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #f5f7fa;
            color: #333;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        header {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }
        
        .subtitle {
            color: #666;
            font-size: 14px;
        }
        
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            background: white;
            padding: 15px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .tab {
            padding: 12px 24px;
            cursor: pointer;
            background: #f5f7fa;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        .tab:hover {
            background: #e1e8ed;
        }
        
        .tab.active {
            background: #4CAF50;
            color: white;
        }
        
        .section {
            background: white;
            padding: 30px;
            margin-bottom: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        h2 {
            font-size: 20px;
            margin-bottom: 20px;
            color: #333;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            font-size: 14px;
        }
        
        input[type="text"],
        input[type="number"],
        textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.2s;
        }
        
        input:focus,
        textarea:focus {
            outline: none;
            border-color: #4CAF50;
        }
        
        .btn {
            padding: 12px 24px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
        }
        
        .btn:hover {
            background: #45a049;
        }
        
        .btn-danger {
            background: #f44336;
        }
        
        .btn-danger:hover {
            background: #da190b;
        }
        
        .btn-secondary {
            background: #757575;
        }
        
        .btn-secondary:hover {
            background: #616161;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #f0f0f0;
        }
        
        th {
            background: #f5f7fa;
            font-weight: 600;
            font-size: 13px;
            color: #666;
            text-transform: uppercase;
        }
        
        td {
            font-size: 14px;
        }
        
        tr:hover {
            background: #f9f9f9;
        }
        
        .token-display {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        
        .token-value {
            background: white;
            padding: 15px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            word-break: break-all;
            margin-top: 10px;
        }
        
        .warning {
            color: #d32f2f;
            font-weight: 500;
            margin-bottom: 10px;
        }
        
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .badge-success {
            background: #e8f5e9;
            color: #2e7d32;
        }
        
        .badge-info {
            background: #e3f2fd;
            color: #1976d2;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
        }
        
        .stat-value {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 14px;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔑 API Token 管理系統</h1>
            <p class="subtitle">集中管理所有微服務的 API Token 和路由配置</p>
        </header>

        <div class="tabs">
            <button class="tab active" onclick="showTab('tokens')">Token 管理</button>
            <button class="tab" onclick="showTab('routes')">路由管理</button>
            <button class="tab" onclick="showTab('stats')">統計資訊</button>
        </div>

        <!-- Token 管理頁面 -->
        <div id="tokens-tab" class="tab-content active">
            <div class="section">
                <h2>創建新 Token</h2>
                <div class="form-group">
                    <label>名稱（例如：Marketing-John）</label>
                    <input type="text" id="tokenName" placeholder="Marketing-John">
                </div>
                <div class="form-group">
                    <label>部門</label>
                    <input type="text" id="tokenDept" placeholder="marketing">
                </div>
                <div class="form-group">
                    <label>權限範圍（逗號分隔，例如：image,data,video）</label>
                    <input type="text" id="tokenScopes" placeholder="image,data" value="*">
                </div>
                <div class="form-group">
                    <label>過期天數（留空表示永不過期）</label>
                    <input type="number" id="tokenExpires" placeholder="90">
                </div>
                <button class="btn" onclick="createToken()">創建 Token</button>
                
                <div id="newTokenDisplay" style="display:none;" class="token-display">
                    <p class="warning">⚠️ 請立即保存此 Token！它只會顯示一次。</p>
                    <div class="token-value" id="tokenValue"></div>
                </div>
            </div>

            <div class="section">
                <h2>現有 Tokens</h2>
                <button class="btn btn-secondary" onclick="loadTokens()">🔄 刷新</button>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>名稱</th>
                            <th>部門</th>
                            <th>權限</th>
                            <th>創建時間</th>
                            <th>過期時間</th>
                            <th>最後使用</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody id="tokensBody"></tbody>
                </table>
            </div>
        </div>

        <!-- 路由管理頁面 -->
        <div id="routes-tab" class="tab-content">
            <div class="section">
                <h2>新增微服務路由</h2>
                <div class="form-group">
                    <label>路徑（例如：/api/image）</label>
                    <input type="text" id="routePath" placeholder="/api/image">
                </div>
                <div class="form-group">
                    <label>後端 URL（例如：https://image-service.railway.app）</label>
                    <input type="text" id="routeBackend" placeholder="https://service.railway.app">
                </div>
                <div class="form-group">
                    <label>描述</label>
                    <input type="text" id="routeDesc" placeholder="圖片處理服務">
                </div>
                <button class="btn" onclick="createRoute()">新增路由</button>
            </div>

            <div class="section">
                <h2>現有路由</h2>
                <button class="btn btn-secondary" onclick="loadRoutes()">🔄 刷新</button>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>路徑</th>
                            <th>後端 URL</th>
                            <th>描述</th>
                            <th>創建時間</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody id="routesBody"></tbody>
                </table>
            </div>
        </div>

        <!-- 統計資訊頁面 -->
        <div id="stats-tab" class="tab-content">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="statTokens">-</div>
                    <div class="stat-label">活躍 Tokens</div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                    <div class="stat-value" id="statRoutes">-</div>
                    <div class="stat-label">微服務路由</div>
                </div>
            </div>

            <div class="section">
                <h2>最近活動</h2>
                <table>
                    <thead>
                        <tr>
                            <th>時間</th>
                            <th>操作</th>
                            <th>類型</th>
                            <th>詳情</th>
                        </tr>
                    </thead>
                    <tbody id="logsBody"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        const API_URL = window.location.origin;

        // Tab 切換
        function showTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            
            event.target.classList.add('active');
            document.getElementById(tabName + '-tab').classList.add('active');
            
            if (tabName === 'tokens') loadTokens();
            if (tabName === 'routes') loadRoutes();
            if (tabName === 'stats') loadStats();
        }

        // ============ Token 操作 ============
        
        async function createToken() {
            const name = document.getElementById('tokenName').value;
            const department = document.getElementById('tokenDept').value;
            const scopesInput = document.getElementById('tokenScopes').value;
            const expires_days = document.getElementById('tokenExpires').value;

            if (!name || !department) {
                alert('請填寫名稱和部門');
                return;
            }

            const scopes = scopesInput.split(',').map(s => s.trim()).filter(s => s);

            try {
                const response = await fetch(`${API_URL}/api/tokens`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        name,
                        department,
                        scopes,
                        expires_days: expires_days ? parseInt(expires_days) : null
                    })
                });

                const data = await response.json();
                
                if (response.ok) {
                    document.getElementById('tokenValue').textContent = data.token;
                    document.getElementById('newTokenDisplay').style.display = 'block';
                    
                    // 清空表單
                    document.getElementById('tokenName').value = '';
                    document.getElementById('tokenDept').value = '';
                    document.getElementById('tokenScopes').value = '*';
                    document.getElementById('tokenExpires').value = '';
                    
                    loadTokens();
                } else {
                    alert('錯誤：' + (data.detail || '未知錯誤'));
                }
            } catch (error) {
                alert('網絡錯誤：' + error.message);
            }
        }

        async function loadTokens() {
            try {
                const response = await fetch(`${API_URL}/api/tokens`);
                const tokens = await response.json();
                
                const tbody = document.getElementById('tokensBody');
                tbody.innerHTML = '';
                
                tokens.forEach(token => {
                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td>${token.id}</td>
                        <td><strong>${token.name}</strong></td>
                        <td><span class="badge badge-info">${token.department}</span></td>
                        <td>${token.scopes.map(s => `<span class="badge badge-success">${s}</span>`).join(' ')}</td>
                        <td>${new Date(token.created_at).toLocaleString('zh-TW')}</td>
                        <td>${token.expires_at ? new Date(token.expires_at).toLocaleString('zh-TW') : '永不過期'}</td>
                        <td>${token.last_used ? new Date(token.last_used).toLocaleString('zh-TW') : '從未使用'}</td>
                        <td>
                            <button class="btn btn-danger" onclick="deleteToken(${token.id})">撤銷</button>
                        </td>
                    `;
                });
            } catch (error) {
                alert('載入失敗：' + error.message);
            }
        }

        async function deleteToken(id) {
            if (!confirm('確定要撤銷此 Token？此操作無法撤銷。')) return;
            
            try {
                await fetch(`${API_URL}/api/tokens/${id}`, {method: 'DELETE'});
                loadTokens();
            } catch (error) {
                alert('刪除失敗：' + error.message);
            }
        }

        // ============ 路由操作 ============
        
        async function createRoute() {
            const path = document.getElementById('routePath').value;
            const backend_url = document.getElementById('routeBackend').value;
            const description = document.getElementById('routeDesc').value;

            if (!path || !backend_url) {
                alert('請填寫路徑和後端 URL');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/routes`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({path, backend_url, description})
                });

                if (response.ok) {
                    document.getElementById('routePath').value = '';
                    document.getElementById('routeBackend').value = '';
                    document.getElementById('routeDesc').value = '';
                    loadRoutes();
                } else {
                    const data = await response.json();
                    alert('錯誤：' + (data.detail || '未知錯誤'));
                }
            } catch (error) {
                alert('網絡錯誤：' + error.message);
            }
        }

        async function loadRoutes() {
            try {
                const response = await fetch(`${API_URL}/api/routes`);
                const routes = await response.json();
                
                const tbody = document.getElementById('routesBody');
                tbody.innerHTML = '';
                
                routes.forEach(route => {
                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td>${route.id}</td>
                        <td><code>${route.path}</code></td>
                        <td><code>${route.backend_url}</code></td>
                        <td>${route.description || '-'}</td>
                        <td>${new Date(route.created_at).toLocaleString('zh-TW')}</td>
                        <td>
                            <button class="btn btn-danger" onclick="deleteRoute(${route.id})">刪除</button>
                        </td>
                    `;
                });
            } catch (error) {
                alert('載入失敗：' + error.message);
            }
        }

        async function deleteRoute(id) {
            if (!confirm('確定要刪除此路由？')) return;
            
            try {
                await fetch(`${API_URL}/api/routes/${id}`, {method: 'DELETE'});
                loadRoutes();
            } catch (error) {
                alert('刪除失敗：' + error.message);
            }
        }

        // ============ 統計信息 ============
        
        async function loadStats() {
            try {
                const response = await fetch(`${API_URL}/api/stats`);
                const stats = await response.json();
                
                document.getElementById('statTokens').textContent = stats.total_tokens;
                document.getElementById('statRoutes').textContent = stats.total_routes;
                
                const tbody = document.getElementById('logsBody');
                tbody.innerHTML = '';
                
                stats.recent_activity.forEach(log => {
                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td>${new Date(log.created_at).toLocaleString('zh-TW')}</td>
                        <td><span class="badge badge-info">${log.action}</span></td>
                        <td>${log.entity_type}</td>
                        <td><code>${JSON.stringify(log.details)}</code></td>
                    `;
                });
            } catch (error) {
                alert('載入失敗：' + error.message);
            }
        }

        // 初始化
        loadTokens();
    </script>
</body>
</html>
```

---

#### **代碼 3：Cloudflare Worker (worker.js)**

```javascript
/**
 * Cloudflare Worker - API Gateway
 * 
 * 職責：
 * 1. 驗證 API Key
 * 2. 路由轉發
 * 3. 返回響應
 * 
 * 注意：此代碼幾乎永遠不需要修改！
 * 所有配置都在 KV 中，由管理系統動態更新。
 */

export default {
  async fetch(request, env, ctx) {
    try {
      // 1. 提取 API Key
      const apiKey = request.headers.get('X-API-Key');
      
      if (!apiKey) {
        return new Response(JSON.stringify({
          error: 'Missing API Key',
          message: 'Please provide X-API-Key header'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 2. 計算 token hash（與後端一致的算法）
      const tokenHash = await sha256(apiKey);
      
      // 3. 從 KV 查詢 token
      const tokenData = await env.TOKENS.get(`token:${tokenHash}`, { type: 'json' });
      
      if (!tokenData) {
        return new Response(JSON.stringify({
          error: 'Invalid API Key',
          message: 'The provided API Key is invalid or has been revoked'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 4. 檢查過期
      if (tokenData.expires_at) {
        const expiresAt = new Date(tokenData.expires_at);
        if (expiresAt < new Date()) {
          return new Response(JSON.stringify({
            error: 'Token Expired',
            message: 'The API Key has expired'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // 5. 獲取路由映射
      const routes = await env.TOKENS.get('routes', { type: 'json' });
      
      if (!routes) {
        return new Response(JSON.stringify({
          error: 'Routes Not Configured',
          message: 'No routes have been configured'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 6. 匹配路由
      const url = new URL(request.url);
      let backend = null;
      let matchedPath = null;
      
      // 按路徑長度降序排序，確保最具體的路徑優先匹配
      const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length);
      
      for (const path of sortedPaths) {
        if (url.pathname.startsWith(path)) {
          backend = routes[path];
          matchedPath = path;
          break;
        }
      }
      
      if (!backend) {
        return new Response(JSON.stringify({
          error: 'Route Not Found',
          message: `No route configured for ${url.pathname}`
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 7. 檢查權限範圍（Scopes）
      // 從路徑提取服務名稱（例如 /api/image -> image）
      const serviceName = matchedPath.split('/').filter(s => s)[1]; // 跳過 'api'
      
      if (serviceName && !tokenData.scopes.includes('*') && !tokenData.scopes.includes(serviceName)) {
        return new Response(JSON.stringify({
          error: 'Permission Denied',
          message: `Token does not have '${serviceName}' scope`
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 8. 構建後端 URL
      // 移除匹配的路徑前綴
      const backendPath = url.pathname.substring(matchedPath.length);
      const backendUrl = backend + backendPath + url.search;
      
      // 9. 轉發請求
      const backendRequest = new Request(backendUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow'
      });
      
      // 10. 返回響應
      const response = await fetch(backendRequest);
      
      // 11. （可選）記錄使用情況到 KV
      // 注意：KV 寫入有配額，生產環境建議用 Durable Objects 或外部日誌服務
      
      return response;
      
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * 計算 SHA256 hash
 */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
```

---

#### **代碼 4：Worker 配置 (wrangler.toml)**

```toml
name = "api-gateway"
main = "worker.js"
compatibility_date = "2024-10-01"

# KV Namespace 綁定
kv_namespaces = [
  { binding = "TOKENS", id = "your_kv_namespace_id" }
]

# Routes
routes = [
  { pattern = "api.yourcompany.com/*", zone_name = "yourcompany.com" }
]

# 或使用 workers.dev 子域名（開發環境）
# workers_dev = true
```

---

### 3.6 部署步驟

#### **步驟 1：準備環境**

```bash
# 1. 註冊 Cloudflare 帳號
# 前往 https://dash.cloudflare.com/

# 2. 創建 KV Namespace
# Dashboard → Workers & Pages → KV → Create Namespace
# 名稱：api-gateway-tokens

# 3. 獲取 Cloudflare API Token
# Dashboard → My Profile → API Tokens → Create Token
# 權限：Account > Workers KV Storage > Edit

# 4. 記錄以下信息：
# - Account ID
# - KV Namespace ID
# - API Token
```

---

#### **步驟 2：部署管理系統到 Railway**

```bash
# 1. Clone 項目
git clone <your-repo>
cd token-manager

# 2. 在 Railway 創建項目
# 前往 https://railway.app/new

# 3. 添加 PostgreSQL
# 點擊 "New" → "Database" → "PostgreSQL"

# 4. 設置環境變數
# 在 Railway 項目設置中添加：

DATABASE_URL=postgresql://user:pass@host:5432/db
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token
CF_KV_NAMESPACE_ID=your_kv_namespace_id

# 5. 部署
# Railway 會自動從 Dockerfile 構建並部署
```

**Dockerfile：**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY frontend/ ./frontend/

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**requirements.txt：**

```
fastapi==0.104.1
uvicorn==0.24.0
asyncpg==0.29.0
httpx==0.25.0
python-multipart==0.0.6
```

---

#### **步驟 3：部署 Cloudflare Worker**

```bash
# 1. 安裝 Wrangler CLI
npm install -g wrangler

# 2. 登入 Cloudflare
wrangler login

# 3. 更新 wrangler.toml
# 填入你的 KV Namespace ID

# 4. 部署 Worker
cd cloudflare-worker
wrangler deploy

# 5. Worker 會部署到：
# https://api-gateway.<your-subdomain>.workers.dev
# 或你的自定義域名
```

---

#### **步驟 4：配置自定義域名（可選）**

```bash
# 1. 在 Cloudflare Dashboard
# Workers & Pages → api-gateway → Settings → Triggers

# 2. 添加自定義域名
# api.yourcompany.com

# 3. Cloudflare 會自動配置 DNS 和 SSL
```

---

#### **步驟 5：測試**

```bash
# 1. 訪問管理系統
https://token-manager.railway.app

# 2. 創建一個測試 Token
# - 名稱：Test
# - 部門：test
# - 權限：*

# 3. 複製生成的 token (ntk_xxxxx)

# 4. 創建一個測試路由
# - 路徑：/api/test
# - 後端：https://httpbin.org/anything

# 5. 測試請求
curl https://api.yourcompany.workers.dev/api/test \
  -H "X-API-Key: ntk_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"hello": "world"}'

# 6. 應該收到 httpbin 的回應
```

---

### 3.7 成本分析

#### **詳細成本預估（每月）：**

| 項目 | 服務 | 配置 | 成本 |
|------|------|------|------|
| **管理系統** | Railway | Hobby Plan (512MB RAM) | $5 |
| **資料庫** | Railway PostgreSQL | Shared (500MB) | $5 |
| **Worker** | Cloudflare Workers | Free Plan (100k req/day) | $0 |
| **KV** | Cloudflare KV | Free Plan (100k reads/day) | $0 |
| **域名** | 可選 | 已有域名 | $0 |
| **總計** | - | - | **$10/月** |

**如果流量更大：**
- Cloudflare Workers Standard: $5/月（1000 萬請求）
- Railway Pro: $20/月（8GB RAM）
- **總計：約 $25-30/月**

---

### 3.8 擴展性與高可用

#### **當前架構的可擴展性：**

**負載能力：**
```
Cloudflare Worker:
- 免費版：100,000 請求/天
- 付費版：無限請求
- 延遲：全球 < 50ms

管理系統：
- Railway Hobby：~1000 併發
- 只處理管理操作，流量很小

n8n 工作流：
- 100 個工作流
- 假設每個工作流每小時執行 10 次
- 總請求量：100 × 10 × 24 = 24,000/天
- 完全在免費額度內！
```

**高可用方案：**
```
1. Cloudflare Worker：
   ✅ 自動全球分佈
   ✅ 無單點故障
   ✅ 99.99%+ SLA

2. 管理系統：
   ⚠️ Railway 單實例
   解決方案：
   - Railway 支持多實例部署
   - 或使用 Cloudflare Tunnel 連接自有主機

3. PostgreSQL：
   ⚠️ Railway 單實例
   解決方案：
   - 升級到 Railway Pro（備份）
   - 或使用 Supabase（託管 PostgreSQL）
```

---

### 3.9 安全性考慮

#### **安全措施：**

**1. Token 安全：**
```
✅ Token 永遠不明文存儲
✅ 只存儲 SHA256 hash
✅ Token 生成使用加密安全的隨機數
✅ Token 只在創建時顯示一次
✅ 支持 Token 過期時間
```

**2. 傳輸安全：**
```
✅ 所有通信都走 HTTPS
✅ Cloudflare 自動提供 SSL
✅ Worker 到後端微服務可配置 HTTPS
```

**3. 訪問控制：**
```
✅ 管理系統需要登入（可添加）
✅ 基於 Scopes 的細粒度權限
✅ 審計日誌記錄所有操作
```

**4. 防護措施：**
```
✅ Cloudflare 自動 DDoS 防護
⚠️ 可添加 Rate Limiting（Worker 層）
⚠️ 可添加 IP 白名單（管理系統層）
```

---

### 3.10 監控與日誌

#### **可監控的指標：**

**Worker 層：**
```
- Cloudflare Dashboard 自動提供：
  ✅ 請求量
  ✅ 錯誤率
  ✅ 響應時間
  ✅ 流量分佈
```

**管理系統層：**
```
- 審計日誌表記錄：
  ✅ 誰創建了 Token
  ✅ 誰撤銷了 Token
  ✅ 何時新增了路由
```

**可選的進階監控：**
```
1. Worker 使用 Durable Objects 記錄每次 API 調用
2. 集成 Sentry 監控錯誤
3. 集成 Grafana 可視化
```

---

### 3.11 維護手冊

#### **日常操作：**

**新增用戶：**
```
1. 訪問 https://token-manager.railway.app
2. 點擊「創建新 Token」
3. 填寫用戶信息
4. 複製 Token 並安全地發送給用戶
```

**撤銷 Token：**
```
1. 在 Token 列表找到該用戶
2. 點擊「撤銷」按鈕
3. Token 在 < 60 秒內全球失效
```

**新增微服務：**
```
1. 部署微服務到任意主機
2. 在管理系統「路由管理」頁面
3. 新增路由：路徑 + 後端 URL
4. < 60 秒後即可使用
```

**升級 Worker：**
```
# 修改 worker.js 後
wrangler deploy

# Worker 會自動全球部署，零停機
```

---

## 4. 附錄

### 4.1 常見問題 FAQ

**Q1：Cloudflare Worker 掛了怎麼辦？**
> A：Cloudflare Worker 的可用性 > 99.99%，幾乎不會掛。如果真的掛了，可以暫時用備用方案：讓 n8n 直接請求微服務（去掉驗證），等 Worker 恢復後再開啟。

**Q2：Token Manager 掛了會影響已有的 Token 嗎？**
> A：不會。Token 和路由配置都在 Cloudflare KV 中，Worker 可以正常工作。Token Manager 只負責管理操作，不影響實際驗證。

**Q3：如何遷移到其他方案？**
> A：數據都在你的 PostgreSQL 中，可以輕鬆導出。如果要換成 Kong 或其他方案，只需要寫一個遷移腳本把數據導入新系統。

**Q4：能否支持更複雜的權限控制？**
> A：可以。目前的 Scopes 機制已經支持基本權限。如果需要更複雜的 RBAC（Role-Based Access Control），可以在資料庫中添加 roles 表，Worker 讀取時做更複雜的判斷。

**Q5：100 個工作流夠用免費版嗎？**
> A：完全夠用。假設每個工作流每小時執行 10 次，一天總共 24,000 次請求，遠低於 Cloudflare 免費版的 100,000 次/天限制。

---

### 4.2 故障排查

#### **Token 驗證失敗：**

```bash
# 1. 檢查 Token 是否正確
curl https://token-manager.railway.app/api/tokens

# 2. 檢查 Cloudflare KV
# Dashboard → Workers → KV → 查看 token:xxx 是否存在

# 3. 檢查 Worker 日誌
# Dashboard → Workers → api-gateway → Logs

# 4. 手動測試 hash 計算
echo -n "ntk_xxx" | shasum -a 256
```

---

#### **路由不生效：**

```bash
# 1. 檢查路由是否正確保存
curl https://token-manager.railway.app/api/routes

# 2. 檢查 Cloudflare KV
# Dashboard → Workers → KV → 查看 routes key

# 3. 等待 60 秒（KV 全球同步時間）

# 4. 清除瀏覽器緩存（如果用瀏覽器測試）
```

---

#### **管理系統無法連接 Cloudflare：**

```bash
# 1. 檢查環境變數
echo $CF_ACCOUNT_ID
echo $CF_API_TOKEN
echo $CF_KV_NAMESPACE_ID

# 2. 測試 API Token
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $CF_API_TOKEN"

# 3. 檢查 API Token 權限
# 必須有：Account > Workers KV Storage > Edit
```

---

### 4.3 備用方案

如果 Cloudflare Workers 不符合需求，可以快速切換到以下方案：

#### **方案 A：自建輕量 Gateway（Railway）**
- 時間：1 天
- 成本：$5/月
- 代碼量：<100 行
- 參考本文檔 3.1 方案 3

#### **方案 B：Kong Gateway**
- 時間：2-3 天
- 成本：$20-25/月
- 功能更豐富
- 參考本文檔 3.1 方案 2

---

### 4.4 roadmap

#### **Phase 1（當前）：**
- ✅ 基本 Token 管理
- ✅ 路由管理
- ✅ API Key 驗證
- ✅ Web UI

#### **Phase 2（1-3 個月）：**
- ⏳ Token 使用統計
- ⏳ 請求日誌
- ⏳ Rate Limiting
- ⏳ 用戶管理系統

#### **Phase 3（3-6 個月）：**
- ⏳ SSO 整合
- ⏳ Webhook 通知
- ⏳ 多環境支持（dev/staging/prod）
- ⏳ API 版本控制

---

### 4.5 參考資源

**官方文檔：**
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare KV](https://developers.cloudflare.com/kv/)
- [Railway Documentation](https://docs.railway.app/)
- [FastAPI](https://fastapi.tiangolo.com/)

**相關項目：**
- [Kong Gateway](https://konghq.com/)
- [Traefik](https://traefik.io/)
- [n8n](https://n8n.io/)

---

## 📝 文件更新日誌

- **v1.0** (2025-10-28)：初始版本，完整方案設計與實現

---

**文件結束**

如有任何問題或需要進一步的技術支持，請聯繫技術團隊。