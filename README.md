# API Token 集中管理系統

> **版本**: v3.0 Per-Team Roles  
> **狀態**: Production Ready  
> **權限系統文檔**: [`docs/PERMISSION_RULES.md`](docs/PERMISSION_RULES.md)

一套為多微服務架構設計的集中式 API Token 管理系統，採用 Per-Team Roles 權限架構，支持多團隊協作與細粒度權限控制。

---

## 🎯 核心功能

- ✅ **Token 管理**: 創建、查看、撤銷 API Token
- ✅ **路由管理**: 動態新增/修改/刪除微服務路由
- ✅ **Per-Team Roles**: 每團隊獨立角色系統，完美團隊隔離
- ✅ **用戶管理**: 完整的用戶與團隊成員管理
- ✅ **團隊管理**: 創建團隊、管理成員、分配權限
- ✅ **用戶邀請**: Clerk Invitations，支持 Google Login
- ✅ **審計日誌**: 記錄所有管理操作
- ✅ **Modern UI**: React 18 + Clerk 認證
- ✅ **全球分佈**: Cloudflare Edge Network 低延遲

---

## 🏗️ 系統架構

```
n8n Workflows
     ↓
Cloudflare Worker (API Gateway)
     ↓
Backend Microservices

Token Manager (Railway)
     ↓
PostgreSQL
     ↓
Cloudflare KV (配置同步)
```

### 組件說明

1. **Token Manager** (Railway)
   - 後端: FastAPI + PostgreSQL
   - 前端: HTML/CSS/JS
   - 提供 Web UI 管理 Token 和路由

2. **Cloudflare Worker** (Edge Network)
   - 驗證 API Key
   - 路由轉發到對應後端

3. **Cloudflare KV** (全球分佈存儲)
   - 存儲 Token 元數據
   - 存儲路由映射

---

## 📁 專案結構

```
token-manager/
├── docs/                    # 📚 文檔
│   ├── PRD.md              # 產品需求文檔
│   ├── TODO.md             # 開發任務清單
│   └── draft.md            # 原始設計草稿
│
├── backend/                 # 🔧 後端 API (Railway Service 1)
│   ├── main.py             # FastAPI 主應用
│   ├── models.py           # Pydantic 模型
│   ├── database.py         # 數據庫連接
│   ├── cloudflare.py       # KV 同步
│   └── requirements.txt
│
├── frontend/                # 🎨 前端 UI (Railway Service 2)
│   └── index.html          # 管理界面
│
├── worker/                  # ⚡ Cloudflare Worker
│   ├── src/
│   │   └── worker.js       # Worker 代碼
│   ├── wrangler.toml       # Worker 配置
│   └── package.json
│
├── .env.example             # 環境變數範例
├── .gitignore
└── README.md
```

---

## 🚀 快速開始

### 前置需求

- **Cloudflare 帳號** (免費版即可)
- **Railway 帳號** (免費版即可)
- **GitHub 帳號**
- **Node.js** (用於部署 Worker)

### 1. Cloudflare 配置

#### 1.1 創建 KV Namespace

```bash
# 安裝 Wrangler CLI
npm install -g wrangler

# 登入 Cloudflare
wrangler login

# 創建 KV Namespace
cd worker
wrangler kv:namespace create "TOKENS"
```

記下返回的 Namespace ID。

#### 1.2 創建 API Token

1. 訪問 Cloudflare Dashboard → My Profile → API Tokens
2. 點擊 "Create Token"
3. 選擇 "Edit Cloudflare Workers" 模板
4. 權限: `Account > Workers KV Storage > Edit`
5. 記下 Token 值

#### 1.3 記錄 Account ID

在 Cloudflare Dashboard 右上角可找到 Account ID

---

### 2. Railway 部署

#### 2.1 準備 GitHub 倉庫

```bash
# 初始化 Git (如果還沒有)
git init
git add .
git commit -m "Initial commit"

# 推送到 GitHub
git remote add origin https://github.com/your-username/token-manager.git
git push -u origin main
```

#### 2.2 部署後端服務

1. 訪問 [Railway Dashboard](https://railway.app/)
2. 點擊 "New Project" → "Deploy from GitHub repo"
3. 選擇您的 `token-manager` 倉庫
4. 添加 PostgreSQL:
   - 點擊 "+ New" → "Database" → "Add PostgreSQL"
5. 配置後端服務:
   - 點擊後端服務
   - Settings → Root Directory: `backend`
   - Variables → 添加環境變數:
     ```
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     CF_ACCOUNT_ID=your_cloudflare_account_id
     CF_API_TOKEN=your_cloudflare_api_token
     CF_KV_NAMESPACE_ID=your_kv_namespace_id
     ```
6. Deploy!

#### 2.3 部署前端服務

1. 在同一個 Railway Project 中
2. 點擊 "+ New" → "GitHub Repo"
3. 選擇同一個倉庫
4. Settings → Root Directory: `frontend`
5. Deploy!

#### 2.4 記錄後端 URL

在後端服務的 Settings → Domains 中記錄 URL,例如:
```
https://token-manager-backend-production.up.railway.app
```

#### 2.5 更新前端配置

修改 `frontend/index.html` 中的 API_URL:

```javascript
const API_URL = 'https://token-manager-backend-production.up.railway.app';
```

提交並推送,Railway 會自動重新部署。

---

### 3. Cloudflare Worker 部署

```bash
cd worker

# 更新 wrangler.toml 中的 KV Namespace ID
# 將 YOUR_KV_NAMESPACE_ID 替換為實際的 ID

# 部署
npm run deploy
```

部署成功後會顯示 Worker URL:
```
https://api-gateway.your-subdomain.workers.dev
```

---

## 📖 使用指南

### 創建 Token

1. 訪問前端管理界面
2. 點擊 "Token 管理" 標籤
3. 填寫表單:
   - 名稱: Marketing-John
   - 部門: marketing
   - 權限: image,data 或 * (全部權限)
   - 過期天數: 90
4. 點擊 "創建 Token"
5. **立即複製顯示的 Token** (只顯示一次!)

### 新增路由

1. 點擊 "路由管理" 標籤
2. 填寫表單:
   - 路徑: /api/image
   - 後端 URL: https://image-service.railway.app
   - 描述: 圖片處理服務
3. 點擊 "新增路由"
4. 約 60 秒後生效

### n8n 使用示例

在 n8n HTTP Request 節點中:

```
URL: https://api-gateway.your-subdomain.workers.dev/api/image/process
Method: POST
Headers:
  X-API-Key: ntk_xxxxxxxxxxxxxxxxxxxxx
  Content-Type: application/json
Body:
  {
    "image_url": "https://example.com/image.jpg"
  }
```

---

## 🔒 安全最佳實踐

1. **Token 管理**
   - Token 只在創建時顯示一次,請妥善保管
   - 定期輪換 Token (建議 90 天)
   - 不再使用的 Token 立即撤銷

2. **權限控制**
   - 遵循最小權限原則
   - 不同部門使用不同 Token
   - 使用具體的 scopes 而非 *

3. **監控**
   - 定期查看審計日誌
   - 監控 Cloudflare Dashboard 的請求統計

---

## 🛠️ 開發

### 本地開發 - 後端

```bash
cd backend

# 創建虛擬環境
uv venv

# 安裝依賴
uv pip install -r requirements.txt

# 設置環境變數
cp ../.env.example .env
# 編輯 .env 填入實際值

# 啟動服務
uv run uvicorn main:app --reload --port 8000
```

訪問 http://localhost:8000/docs 查看 API 文檔

### 本地開發 - Worker

```bash
cd worker

# 安裝依賴
npm install

# 本地測試
npm run dev
```

---

## 📊 系統限制

### Cloudflare 免費版

- Worker 請求: 100,000 次/天
- KV 讀取: 100,000 次/天
- KV 寫入: 1,000 次/天
- KV 存儲: 1 GB

**對於 100 個 n8n 工作流完全夠用!**

### Railway 免費版

- $5 免費額度/月
- 512 MB RAM
- 1 GB Disk

**升級到 Hobby ($5/月) 可獲得更多資源**

---

## 🐛 故障排查

### Token 驗證失敗

1. 檢查 Token 是否正確 (包括 `ntk_` 前綴)
2. 檢查 Token 是否已被撤銷
3. 檢查 Token 是否過期
4. 等待 60 秒讓 KV 同步完成

### 路由不生效

1. 檢查路由路徑是否以 `/` 開頭
2. 檢查後端 URL 是否可訪問
3. 等待 60 秒讓 KV 同步完成
4. 在 Cloudflare Dashboard 檢查 KV 中的 `routes` key

### 後端服務無法啟動

1. 檢查環境變數是否正確設置
2. 檢查 PostgreSQL 連接
3. 查看 Railway 日誌

---

## 📈 性能指標

| 指標 | 目標 | 實際 |
|-----|------|------|
| Worker 延遲 (P95) | < 200ms | ~50ms |
| Token 撤銷生效時間 | < 60s | < 60s |
| 路由更新生效時間 | < 60s | < 60s |
| 系統可用性 | 99% | 99.9%+ |

---

## 🗺️ Roadmap

### Phase 1 (✅ 已完成)
- ✅ Token CRUD
- ✅ 路由 CRUD
- ✅ Worker 驗證與轉發
- ✅ Web UI
- ✅ 審計日誌

### Phase 2 (規劃中)
- ⏳ 管理系統登入認證
- ⏳ Token 使用統計
- ⏳ Rate Limiting
- ⏳ Webhook 通知

### Phase 3 (未來)
- ⏳ SSO 整合
- ⏳ 多環境支持
- ⏳ API 版本控制

---

## 📝 API 文檔

完整的 API 文檔請參考:
- 開發環境: http://localhost:8000/docs
- 生產環境: https://your-backend.railway.app/docs

---

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request!

---

## 📄 授權

MIT License

---

## 📞 支持與文檔

### 權限系統
- 🔐 **[完整權限規則](docs/PERMISSION_RULES.md)** - Per-Team Roles 架構說明
- 📊 **[權限矩陣](docs/PERMISSION_RULES.md#完整權限矩陣)** - 所有角色的權限對照表

### 開發文檔
- 📚 [產品需求文檔](docs/PRD.md)
- 📋 [開發任務清單](docs/TODO.md)
- 🏗️ [Per-Team Roles 分析](docs/PER_TEAM_ROLES_ANALYSIS.md)

### 舊版文檔（已過時，僅供參考）
- ~~[PERMISSIONS_GUIDE.md](docs/PERMISSIONS_GUIDE.md)~~ - 已被 PERMISSION_RULES.md 取代
- ~~[RBAC_REDESIGN.md](docs/RBAC_REDESIGN.md)~~ - 舊架構設計

---

**🚀 現在開始使用吧!**

