# 本地開發指南

> 在部署到生產環境之前，先在本地完整測試系統

---

## 📋 前置需求

- Python 3.11+
- PostgreSQL (或使用 Docker)
- Node.js 18+ (用於 Wrangler)
- Cloudflare 帳號 (免費版即可)

---

## 🚀 快速開始

### 步驟 1: 設置 Cloudflare KV (只需一次)

```bash
# 安裝 Wrangler
npm install -g wrangler

# 登入 Cloudflare
wrangler login

# 創建 KV Namespace
cd worker
wrangler kv:namespace create "TOKENS"
```

**記下返回的 Namespace ID**，例如：
```
{ binding = "TOKENS", id = "1234567890abcdef" }
```

### 步驟 2: 獲取 Cloudflare 憑證

1. **Account ID**: Cloudflare Dashboard 右側
2. **API Token**: 
   - Dashboard → My Profile → API Tokens
   - Create Token → Edit Cloudflare Workers
   - 權限: Account > Workers KV Storage > Edit

### 步驟 3: 設置本地 PostgreSQL

#### 選項 A: 使用 Docker (推薦)

```bash
# 啟動 PostgreSQL
docker run --name token-manager-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=tokenmanager \
  -p 5432:5432 \
  -d postgres:15

# 驗證運行
docker ps | grep token-manager-db
```

#### 選項 B: 使用本地 PostgreSQL

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# 創建數據庫
createdb tokenmanager
```

### 步驟 4: 配置環境變數

```bash
cd backend
cp ../.env.example .env
```

編輯 `.env`:
```env
# Docker PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/tokenmanager

# 或本地 PostgreSQL
# DATABASE_URL=postgresql://localhost:5432/tokenmanager

# Cloudflare (填入實際值)
CF_ACCOUNT_ID=your_account_id_here
CF_API_TOKEN=your_api_token_here
CF_KV_NAMESPACE_ID=your_namespace_id_here
```

### 步驟 5: 安裝後端依賴

```bash
cd backend

# 創建虛擬環境
python -m venv venv

# 啟動虛擬環境
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# 安裝依賴
pip install -r requirements.txt
```

### 步驟 6: 啟動後端

```bash
# 確保在 backend/ 目錄且虛擬環境已啟動
uvicorn main:app --reload --port 8000
```

**預期輸出:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using StatReload
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
✅ Database connected and tables initialized
INFO:     Application startup complete.
```

**測試後端:**
```bash
# 新開一個終端
curl http://localhost:8000/health

# 應返回:
# {"status":"healthy","service":"token-manager","version":"1.0.0"}
```

**查看 API 文檔:**
```
http://localhost:8000/docs
```

### 步驟 7: 測試前端

#### 選項 A: 使用 Python 簡單服務器

```bash
# 新終端
cd frontend
python -m http.server 3000
```

訪問: http://localhost:3000

#### 選項 B: 直接打開 HTML

```bash
# macOS
open frontend/index.html

# Linux
xdg-open frontend/index.html

# Windows
start frontend/index.html
```

**注意**: 前端的 `API_URL` 已設置為本地開發模式，會自動使用 `http://localhost:8000`

### 步驟 8: 測試 Cloudflare Worker (本地)

```bash
cd worker

# 安裝依賴
npm install

# 更新 wrangler.toml 中的 KV Namespace ID
# 將 YOUR_KV_NAMESPACE_ID 替換為實際 ID

# 本地運行 Worker
npm run dev
```

**預期輸出:**
```
⛅️ wrangler 3.x.x
-------------------
⬣ Listening on http://localhost:8787
```

---

## 🧪 完整測試流程

### 測試 1: 創建 Token

1. 訪問 http://localhost:3000
2. 在 "Token 管理" 頁面填寫:
   - 名稱: `Test-Local`
   - 部門: `development`
   - 權限: `*`
   - 過期天數: `90`
3. 點擊 "創建 Token"
4. **複製生成的 Token** (ntk_xxxxx...)

### 測試 2: 創建路由

1. 切換到 "路由管理" 頁面
2. 填寫:
   - 路徑: `/api/test`
   - 後端 URL: `https://httpbin.org/anything`
   - 描述: `測試路由`
3. 點擊 "新增路由"

### 測試 3: 等待 KV 同步

等待約 **60 秒**，讓 Token 和路由同步到 Cloudflare KV。

可以在 Cloudflare Dashboard 驗證:
- Workers & Pages → KV
- 選擇您的 Namespace
- 查看 `token:xxx` 和 `routes` keys

### 測試 4: Worker 驗證 (本地)

```bash
# 使用剛才創建的 Token
curl http://localhost:8787/api/test \
  -H "X-API-Key: ntk_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"hello": "world"}'
```

**預期結果**: 返回 httpbin 的響應，包含您的請求數據

### 測試 5: Worker 驗證 (線上)

如果本地 Worker 測試通過，部署到 Cloudflare:

```bash
cd worker
wrangler deploy
```

使用返回的 Worker URL 測試:

```bash
curl https://api-gateway.your-subdomain.workers.dev/api/test \
  -H "X-API-Key: ntk_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"hello": "world"}'
```

### 測試 6: 錯誤場景測試

```bash
# 測試缺少 API Key
curl http://localhost:8787/api/test
# 應返回: {"error": "Missing API Key", ...}

# 測試錯誤的 API Key
curl http://localhost:8787/api/test \
  -H "X-API-Key: invalid_key"
# 應返回: {"error": "Invalid API Key", ...}

# 測試不存在的路由
curl http://localhost:8787/api/nonexistent \
  -H "X-API-Key: ntk_your_token_here"
# 應返回: {"error": "Route Not Found", ...}

# 測試權限不足
# 1. 創建一個只有 "image" scope 的 Token
# 2. 嘗試訪問 /api/data 路由
# 應返回: {"error": "Permission Denied", ...}
```

---

## 🔧 開發工作流

### 修改後端代碼

```bash
# 後端運行在 --reload 模式，修改會自動重啟
cd backend
# 修改 main.py 或其他文件
# 保存後自動重啟，無需手動操作
```

### 修改前端代碼

```bash
# 直接修改 frontend/index.html
# 刷新瀏覽器即可看到更改
```

### 修改 Worker 代碼

```bash
# Worker 運行在 dev 模式，修改會自動重啟
cd worker
# 修改 src/worker.js
# 保存後自動重啟
```

---

## 🐛 常見問題

### 問題 1: 後端啟動失敗 - 數據庫連接錯誤

```
ERROR: could not connect to server: Connection refused
```

**解決:**
```bash
# 檢查 PostgreSQL 是否運行
docker ps | grep postgres  # Docker
# 或
brew services list | grep postgresql  # 本地

# 檢查 DATABASE_URL 是否正確
cat backend/.env
```

### 問題 2: KV 同步失敗

```
Failed to sync to Cloudflare: 401 Unauthorized
```

**解決:**
- 檢查 `CF_API_TOKEN` 是否正確
- 檢查 Token 權限是否包含 "Workers KV Storage > Edit"
- 重新生成 API Token

### 問題 3: Worker 本地運行失敗

```
Error: No namespace with id "YOUR_KV_NAMESPACE_ID"
```

**解決:**
- 更新 `worker/wrangler.toml` 中的實際 KV Namespace ID
- 確認已執行 `wrangler kv:namespace create "TOKENS"`

### 問題 4: 前端無法連接後端

```
Network Error
```

**解決:**
- 確認後端運行在 http://localhost:8000
- 檢查瀏覽器控制台的 CORS 錯誤
- 確認 `frontend/index.html` 中的 `API_URL` 設置正確

### 問題 5: Token 驗證失敗但 Token 是正確的

**原因**: KV 同步延遲 (最多 60 秒)

**解決:**
- 等待 60 秒後重試
- 在 Cloudflare Dashboard 檢查 KV 中是否有數據

---

## 📊 驗證清單

在部署到生產環境之前，確認以下項目:

- [ ] 後端健康檢查通過 (`/health`)
- [ ] 後端 API 文檔可訪問 (`/docs`)
- [ ] 前端可以打開
- [ ] 可以創建 Token
- [ ] Token 正確顯示 (ntk_ 前綴)
- [ ] Token 列表正常顯示
- [ ] 可以撤銷 Token
- [ ] 可以創建路由
- [ ] 路由列表正常顯示
- [ ] 可以刪除路由
- [ ] 統計信息正確顯示
- [ ] 審計日誌正確記錄
- [ ] Worker 本地可以驗證 Token
- [ ] Worker 本地可以轉發請求
- [ ] Worker 線上可以驗證 Token
- [ ] Worker 線上可以轉發請求
- [ ] 錯誤場景正確處理

---

## 🎯 本地開發快速命令

### 一鍵啟動後端
```bash
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
```

### 一鍵啟動前端
```bash
cd frontend && python -m http.server 3000
```

### 一鍵啟動 Worker
```bash
cd worker && npm run dev
```

### 查看所有運行的服務
```bash
# 後端
curl http://localhost:8000/health

# 前端
open http://localhost:3000

# Worker
curl http://localhost:8787/api/test \
  -H "X-API-Key: your_token"
```

### 停止所有服務
```bash
# Ctrl+C 停止每個終端的服務

# 停止 Docker PostgreSQL (如果使用)
docker stop token-manager-db
```

---

## 🎉 本地測試成功後

當所有測試通過後，您可以:

1. 提交代碼到 GitHub
2. 按照 `docs/DEPLOYMENT.md` 部署到生產環境
3. 享受全自動部署的便利！

---

**祝開發順利！** 🚀

有問題隨時查看文檔或提問！

