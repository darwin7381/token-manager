# 部署指南

> 詳細的部署步驟和配置說明

---

## 📋 部署清單

- [ ] Cloudflare KV Namespace 已創建
- [ ] Cloudflare API Token 已獲取
- [ ] GitHub 倉庫已創建並推送代碼
- [ ] Railway Project 已創建
- [ ] PostgreSQL 已添加
- [ ] 後端服務已部署
- [ ] 前端服務已部署
- [ ] 環境變數已配置
- [ ] Worker 已部署
- [ ] 測試 Token 已創建
- [ ] 測試路由已配置
- [ ] 端到端測試通過

---

## 🎯 部署架構

```
GitHub Repository
     ↓ (自動觸發)
Railway Project
  ├── Backend Service (backend/)
  ├── Frontend Service (frontend/)
  └── PostgreSQL
     ↓ (手動部署)
Cloudflare Worker
```

---

## 1. Cloudflare 配置

### 1.1 安裝 Wrangler CLI

```bash
# 全局安裝
npm install -g wrangler

# 或在 worker 目錄安裝
cd worker
npm install
```

### 1.2 登入 Cloudflare

```bash
wrangler login
```

這會打開瀏覽器進行授權。

### 1.3 創建 KV Namespace

```bash
cd worker
wrangler kv:namespace create "TOKENS"
```

**輸出示例:**
```
🌀 Creating namespace with title "api-gateway-TOKENS"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "TOKENS", id = "1234567890abcdef" }
```

**記下 Namespace ID**: `1234567890abcdef`

### 1.4 創建 API Token

1. 訪問 https://dash.cloudflare.com/profile/api-tokens
2. 點擊 "Create Token"
3. 使用 "Edit Cloudflare Workers" 模板
4. 或自定義權限:
   - Account > Workers KV Storage > Edit
   - Account > Workers Scripts > Edit
5. 點擊 "Continue to summary" → "Create Token"
6. **複製並保存 Token** (只顯示一次!)

### 1.5 獲取 Account ID

1. 訪問 Cloudflare Dashboard
2. 選擇任意域名 (或 Workers & Pages)
3. 在右側可以看到 "Account ID"
4. 點擊複製

---

## 2. GitHub 設置

### 2.1 創建倉庫

```bash
# 初始化 Git (如果還沒有)
cd /path/to/token-manager
git init

# 添加所有文件
git add .
git commit -m "Initial commit: Token Manager System"

# 創建 GitHub 倉庫 (在 GitHub 網站上)
# 然後連接本地倉庫
git remote add origin https://github.com/YOUR_USERNAME/token-manager.git
git branch -M main
git push -u origin main
```

### 2.2 驗證推送

確認所有文件都已推送到 GitHub:
- `backend/`
- `frontend/`
- `worker/`
- `docs/`
- `README.md`
- `.env.example`

---

## 3. Railway 部署

### 3.1 創建 Project

1. 訪問 https://railway.app/
2. 點擊 "Start a New Project"
3. 選擇 "Deploy from GitHub repo"
4. 授權 Railway 訪問您的 GitHub
5. 選擇 `token-manager` 倉庫

### 3.2 添加 PostgreSQL

1. 在 Project 中點擊 "+ New"
2. 選擇 "Database" → "Add PostgreSQL"
3. Railway 會自動創建數據庫
4. 記下數據庫連接信息 (自動生成)

### 3.3 配置後端服務

#### 設置 Root Directory

1. 點擊後端服務
2. Settings → Service
3. Root Directory: `backend`
4. 保存

#### 配置環境變數

Settings → Variables:

```env
# PostgreSQL (從 Railway 自動生成)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Cloudflare (填入實際值)
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token
CF_KV_NAMESPACE_ID=your_kv_namespace_id
```

**注意**: `DATABASE_URL` 使用 Railway 的引用語法,會自動連接到 PostgreSQL。

#### 設置啟動命令 (可選)

Settings → Deploy:
```bash
# Railway 會自動偵測 requirements.txt
# 默認命令: uvicorn main:app --host 0.0.0.0 --port $PORT

# 如果需要自定義:
uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2
```

#### 部署

點擊 "Deploy" 或等待自動部署完成。

#### 獲取後端 URL

Settings → Domains → Generate Domain

記下 URL,例如:
```
https://token-manager-backend-production-abc123.up.railway.app
```

### 3.4 配置前端服務

#### 添加新服務

1. 在 Project 中點擊 "+ New"
2. 選擇 "GitHub Repo"
3. 選擇同一個 `token-manager` 倉庫

#### 設置 Root Directory

Settings → Service:
```
Root Directory: frontend
```

#### 部署

Railway 會自動部署前端。

#### 獲取前端 URL

Settings → Domains → Generate Domain

記下 URL,例如:
```
https://token-manager-frontend-production-xyz789.up.railway.app
```

### 3.5 更新前端配置

修改 `frontend/index.html` 第 254 行:

```javascript
// 修改前
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000'
    : 'YOUR_BACKEND_URL';

// 修改後
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000'
    : 'https://token-manager-backend-production-abc123.up.railway.app';
```

提交並推送:

```bash
git add frontend/index.html
git commit -m "Update API_URL for production"
git push
```

Railway 會自動重新部署前端。

---

## 4. Cloudflare Worker 部署

### 4.1 更新 wrangler.toml

編輯 `worker/wrangler.toml`:

```toml
name = "api-gateway"
main = "src/worker.js"
compatibility_date = "2024-10-01"

kv_namespaces = [
  { binding = "TOKENS", id = "YOUR_KV_NAMESPACE_ID" }  # 替換為實際 ID
]

# 如果要使用自定義域名
# routes = [
#   { pattern = "api.yourcompany.com/*", zone_name = "yourcompany.com" }
# ]
```

### 4.2 部署

```bash
cd worker

# 部署
npm run deploy

# 或
wrangler deploy
```

**輸出示例:**
```
⛅️ wrangler 3.x.x
-------------------
Your worker has been published to:
 https://api-gateway.your-subdomain.workers.dev
```

**記下 Worker URL!**

### 4.3 配置自定義域名 (可選)

如果您有自己的域名:

1. 訪問 Cloudflare Dashboard
2. Workers & Pages → api-gateway
3. Settings → Triggers
4. Custom Domains → Add Custom Domain
5. 輸入子域名,如 `api.yourcompany.com`
6. Cloudflare 會自動配置 DNS 和 SSL

---

## 5. 測試部署

### 5.1 測試後端 API

```bash
# 健康檢查
curl https://token-manager-backend-production.up.railway.app/health

# 應返回:
# {"status":"healthy","service":"token-manager","version":"1.0.0"}
```

### 5.2 測試前端

訪問前端 URL:
```
https://token-manager-frontend-production.up.railway.app
```

應該能看到管理界面。

### 5.3 創建測試 Token

1. 在前端界面創建一個 Token:
   - 名稱: Test
   - 部門: test
   - 權限: *
   - 過期: 90天
2. 複製生成的 Token

### 5.4 創建測試路由

1. 在前端界面創建一個路由:
   - 路徑: `/api/test`
   - 後端 URL: `https://httpbin.org/anything`
   - 描述: 測試路由

### 5.5 等待 KV 同步

等待約 60 秒,讓配置同步到 Cloudflare KV。

### 5.6 端到端測試

```bash
# 使用剛才創建的 Token
curl https://api-gateway.your-subdomain.workers.dev/api/test \
  -H "X-API-Key: ntk_xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"hello": "world"}'
```

**預期結果**: 返回 httpbin.org 的響應,包含您發送的數據。

---

## 6. 生產環境優化

### 6.1 啟用 Railway Pro (可選)

如果需要更多資源:
1. Railway Dashboard → Project Settings
2. Upgrade to Pro
3. 獲得更多 RAM、存儲和備份

### 6.2 配置 Cloudflare 付費版 (可選)

如果流量超過免費額度:
1. Cloudflare Dashboard → Workers & Pages
2. Purchase Workers Paid ($5/month)
3. 獲得無限請求

### 6.3 設置監控

#### Cloudflare Analytics

1. Workers & Pages → api-gateway
2. Metrics 標籤
3. 監控:
   - 請求量
   - 錯誤率
   - 延遲

#### Railway Logs

1. Backend Service → Deployments
2. 查看實時日誌
3. 排查錯誤

---

## 7. 維護操作

### 7.1 更新代碼

```bash
# 修改代碼
git add .
git commit -m "Update: description"
git push

# Railway 會自動重新部署
```

### 7.2 更新 Worker

```bash
cd worker
# 修改 src/worker.js
wrangler deploy
```

### 7.3 數據庫備份

Railway Pro 提供自動備份。

免費版手動備份:
```bash
# 導出數據
pg_dump $DATABASE_URL > backup.sql

# 恢復
psql $DATABASE_URL < backup.sql
```

---

## 8. 故障恢復

### 後端服務故障

1. 查看 Railway Logs
2. 檢查環境變數
3. 重新部署:
   - Deployments → Latest → Redeploy

### Worker 故障

1. 查看 Cloudflare Logs
2. 回滾到上一版本:
   ```bash
   wrangler rollback
   ```

### 數據庫故障

1. 檢查連接
2. 重啟 PostgreSQL (Railway Dashboard)
3. 恢復備份

---

## 📝 環境變數清單

### Backend (Railway)

| 變數 | 來源 | 示例 |
|-----|------|------|
| DATABASE_URL | Railway 自動 | postgresql://... |
| CF_ACCOUNT_ID | Cloudflare Dashboard | 1234567890abcdef |
| CF_API_TOKEN | Cloudflare API Tokens | abc123xyz... |
| CF_KV_NAMESPACE_ID | wrangler kv:namespace create | 1234567890abcdef |

### Worker (wrangler.toml)

| 配置 | 值 |
|-----|---|
| name | api-gateway |
| kv_namespaces.id | YOUR_KV_NAMESPACE_ID |

---

## ✅ 部署檢查清單

部署完成後,確認以下項目:

- [ ] 後端健康檢查通過 (`/health`)
- [ ] 前端可以訪問
- [ ] 可以創建 Token
- [ ] Token 顯示正確
- [ ] 可以創建路由
- [ ] Worker 可以訪問
- [ ] Worker 可以驗證 Token
- [ ] Worker 可以轉發請求
- [ ] 審計日誌正常記錄
- [ ] 統計信息正確顯示

---

## 🎉 部署完成!

現在您的 Token Manager 系統已經部署完成,可以開始使用了!

**下一步:**
1. 創建實際的 Token
2. 配置您的微服務路由
3. 在 n8n 中開始使用

如有問題,請參考 [故障排查](#7-故障恢復) 章節。

