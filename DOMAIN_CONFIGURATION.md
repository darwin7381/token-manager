# Token Manager 域名配置方案

**更新時間**: 2025-11-05  
**版本**: Final  
**狀態**: ✅ 已確認

---

## 🌐 完整域名架構

```
架構圖：

n8n Workflow
    ↓ X-API-Key: ntk_xxx
api.blocktempo.ai (Cloudflare Worker - API Gateway)
    ↓ 驗證、轉發、記錄
後端微服務 (OpenAI, AWS, CloudConvert, ...)
    ↓ 同時異步
tapi.blocktempo.ai (Token Manager Backend API)
    ↓ 記錄使用數據
PostgreSQL Database

管理員
    ↓ 瀏覽器訪問
token.blocktempo.ai (Frontend - 管理界面)
    ↓ API 調用
tapi.blocktempo.ai (Backend API)
```

---

## 📋 域名配置詳情

### **1. tapi.blocktempo.ai** - 後端 API

**部署位置**: Railway Backend Service

**用途**：
- ✅ 前端 API 調用（Token CRUD、路由管理、統計等）
- ✅ Worker 發送使用記錄（`POST /api/usage-log`）
- ✅ Clerk 認證回調
- ✅ 健康檢查

**配置步驟**：
```
Railway Dashboard:
1. 選擇 backend service
2. Settings → Networking → Custom Domain
3. 添加：tapi.blocktempo.ai
4. 等待 DNS 生效
```

**驗證**：
```bash
curl https://tapi.blocktempo.ai/health
curl https://tapi.blocktempo.ai/health/detailed
```

---

### **2. api.blocktempo.ai** - API Gateway (Worker)

**部署位置**: Cloudflare Worker

**用途**：
- ✅ n8n Workflow 調用入口
- ✅ 對外的統一 API Gateway
- ✅ Token 驗證和權限檢查
- ✅ 請求路由和轉發
- ✅ 後端認證自動添加

**當前 URL**: `https://api-gateway.cryptoxlab.workers.dev`

**配置自定義域名**（可選）：
```
Cloudflare Dashboard:
1. Workers & Pages → api-gateway
2. Triggers → Custom Domains
3. Add Domain: api.blocktempo.ai
4. 等待 SSL 證書生效
```

**或者保持現有 URL**：
- `https://api-gateway.cryptoxlab.workers.dev`（已可用）

---

### **3. token.blocktempo.ai** - 前端管理界面

**部署位置**: Railway Frontend Service 或 Cloudflare Pages

**用途**：
- ✅ 管理員登入（Clerk 認證）
- ✅ Token 和路由管理
- ✅ 使用統計查看
- ✅ 團隊和用戶管理
- ✅ Dashboard 和監控

**配置步驟（Railway）**：
```
Railway Dashboard:
1. 創建新 service 或使用現有
2. Root Directory: frontend
3. Settings → Networking → Custom Domain
4. 添加：token.blocktempo.ai
```

**配置步驟（Cloudflare Pages）**：
```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name token-manager
```

---

## 🔧 代碼配置更新

### **Worker 配置** ✅ 已更新

**文件**: `worker/wrangler.toml`

```toml
# 生產環境
[vars]
TOKEN_MANAGER_BACKEND = "https://tapi.blocktempo.ai"

# 本地開發環境
[env.dev]
vars = { TOKEN_MANAGER_BACKEND = "http://localhost:8000" }
```

**文件**: `worker/src/worker.js`

```javascript
// 預設值已更新
const backendUrl = env.TOKEN_MANAGER_BACKEND || 'https://tapi.blocktempo.ai';
```

---

### **前端配置**（部署時需要）

**文件**: `frontend/vite.config.js`（本地開發用）

保持現有配置：
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8000',  // 本地開發
    changeOrigin: true,
  }
}
```

**生產環境**（如果前端部署到 Railway）：
```javascript
// 前端直接調用 API，不經過 proxy
// 需要配置 CORS（後端已配置 allow_origins=["*"]）
```

---

### **文檔更新** ✅ 已完成

已更新以下文檔中的域名：
- ✅ USAGE_ANALYTICS_IMPLEMENTATION.md
- ✅ DASHBOARD_OPTIMIZATION_AND_USAGE_TRACKING.md
- ✅ TOKEN_USAGE_TRACKING.md
- ✅ IMPLEMENTATION_COMPLETE_V2.7.md
- ✅ COMPLETE_USAGE_ANALYTICS_GUIDE.md
- ✅ QUICK_REFERENCE.md
- ✅ DEMO_DATA_GENERATED.md
- ✅ DEPLOYMENT_CHECKLIST.md

**所有提到 `token.blocktempo.ai` 作為後端 URL 的地方都已改為 `tapi.blocktempo.ai`**

---

## 🌐 DNS 配置指南

### **在 Cloudflare DNS 設置**

```
記錄類型    名稱      目標                              代理狀態
--------   ------   -------------------------------   ---------
CNAME      tapi     your-backend.railway.app          Proxied
CNAME      token    your-frontend.railway.app         Proxied
CNAME      api      api-gateway.cryptoxlab.workers.dev Proxied
```

**或（如果使用 Railway 提供的 domain）**：
```
Railway 會自動處理 DNS，只需在 Railway 添加自定義域名即可
```

---

## 🚀 部署流程（最終版）

### **Step 1: 重新部署 Worker** ✅ 必須

```bash
cd worker
wrangler deploy --env=""

# 確認環境變數：
# TOKEN_MANAGER_BACKEND = "https://tapi.blocktempo.ai"
```

### **Step 2: 部署後端到 Railway**

```bash
# 1. 提交代碼
git add .
git commit -m "feat: v2.8.1 - 域名配置調整為 tapi.blocktempo.ai"
git push origin main

# 2. Railway 自動部署

# 3. 在 Railway 設置域名
Settings → Networking → Custom Domain
添加：tapi.blocktempo.ai

# 4. 驗證
curl https://tapi.blocktempo.ai/health
```

### **Step 3: 部署前端到 Railway**

```bash
# 1. Railway 會自動從同一個 repo 部署

# 2. 設置域名
Settings → Networking → Custom Domain
添加：token.blocktempo.ai

# 3. 前端環境變數（如果需要）
VITE_API_URL=https://tapi.blocktempo.ai
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

---

## 📊 域名用途總結

| 域名 | 部署位置 | 用途 | 訪問者 |
|------|---------|------|--------|
| **tapi.blocktempo.ai** | Railway Backend | 後端 API | 前端 + Worker |
| **token.blocktempo.ai** | Railway Frontend | 管理界面 | 管理員 |
| **api.blocktempo.ai** | Cloudflare Worker | API Gateway | n8n Workflow |

---

## 🧪 部署後測試

### **Test 1: 後端可訪問**
```bash
curl https://tapi.blocktempo.ai/health/detailed
```

### **Test 2: Worker → 後端記錄**
```bash
# 通過 Worker 調用
curl -X POST https://api-gateway.cryptoxlab.workers.dev/api/openai/chat/completions \
  -H "X-API-Key: ntk_YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"測試"}],"max_tokens":5}'

# 等待 5-10 秒

# 查詢記錄
curl https://tapi.blocktempo.ai/api/usage/test-data

# 預期：看到新的使用記錄
```

### **Test 3: 前端訪問**
```bash
# 訪問前端
https://token.blocktempo.ai

# 登入後訪問
https://token.blocktempo.ai/usage-analytics
https://token.blocktempo.ai/dashboard
```

---

## ✅ 檢查清單

### **代碼更新**
- [x] ✅ worker/wrangler.toml - 已更新為 tapi.blocktempo.ai
- [x] ✅ worker/src/worker.js - 已更新預設 URL
- [x] ✅ 所有文檔 - 已批量更新
- [ ] ⏳ Worker 重新部署（下一步）

### **域名配置**
- [ ] ⏳ Railway 後端設置：tapi.blocktempo.ai
- [ ] ⏳ Railway 前端設置：token.blocktempo.ai
- [ ] ⏳ Cloudflare Worker（可選）：api.blocktempo.ai

### **驗證測試**
- [ ] ⏳ 後端健康檢查
- [ ] ⏳ Worker → 後端記錄測試
- [ ] ⏳ 前端功能測試
- [ ] ⏳ 完整端到端測試

---

## 🎯 下一步行動

### **立即執行**

```bash
# 1. 重新部署 Worker（使用新的後端 URL）
cd worker
wrangler deploy --env=""

# 2. 提交代碼
cd ..
git add .
git commit -m "feat: 域名配置調整 - tapi.blocktempo.ai (backend), token.blocktempo.ai (frontend)"
git push origin main

# 3. 在 Railway 配置域名
# tapi.blocktempo.ai → backend
# token.blocktempo.ai → frontend

# 4. 等待 DNS 生效後測試
curl https://tapi.blocktempo.ai/health
```

---

## 📝 域名配置對應關係

### **之前的計劃**
```
後端: token.blocktempo.ai
前端: app.blocktempo.ai
```

### **現在的配置** ✅
```
後端: tapi.blocktempo.ai  (Token API)
前端: token.blocktempo.ai (Token Manager)
Worker: api.blocktempo.ai (可選，或保持 api-gateway.cryptoxlab.workers.dev)
```

**優點**：
- ✅ 更清晰：tapi = Token API
- ✅ 更直觀：token.blocktempo.ai 給管理員用
- ✅ 統一命名：所有 token 相關的都在 blocktempo.ai

---

**🎊 所有配置已更新完成！準備重新部署 Worker 並開始正式部署流程！**

---

**文件版本**: 1.0  
**更新時間**: 2025-11-05  
**狀態**: 配置完成，等待部署




