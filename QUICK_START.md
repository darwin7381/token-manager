# ⚡ 快速啟動指南

> 使用 UV 和 dummy 憑證快速測試系統

---

## 🚀 一鍵啟動 (5分鐘搞定)

### 1. 啟動 PostgreSQL (Docker)

```bash
docker run --name token-manager-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=tokenmanager \
  -p 5433:5432 \
  -d postgres:15
```

**注意**: 使用 5433 端口避免與本地 PostgreSQL 衝突

### 2. 設置後端環境變數

```bash
cd backend
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5433/tokenmanager
CF_ACCOUNT_ID=dummy
CF_API_TOKEN=dummy  
CF_KV_NAMESPACE_ID=dummy
EOF
```

### 3. 啟動後端 (使用 UV)

```bash
cd backend

# 創建虛擬環境
uv venv

# 安裝依賴
uv pip install -r requirements.txt

# 啟動服務
uv run uvicorn main:app --reload --port 8000
```

### 4. 啟動前端

```bash
# 新終端
cd frontend
npm run dev
```

### 5. 測試系統

```bash
# 新終端
cd backend
./test_local.sh
```

---

## 🌐 訪問系統

- **後端 API**: http://localhost:8000
- **API 文檔**: http://localhost:8000/docs
- **前端 UI**: http://localhost:5173

---

## 🧪 手動測試

### 創建 Token
```bash
curl -X POST http://localhost:8000/api/tokens \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "department": "dev",
    "scopes": ["*"],
    "expires_days": 90
  }'
```

### 列出 Tokens
```bash
curl http://localhost:8000/api/tokens | uv run python -m json.tool
```

### 創建路由
```bash
curl -X POST http://localhost:8000/api/routes \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/test",
    "backend_url": "https://httpbin.org/anything",
    "description": "Test route"
  }'
```

### 列出路由
```bash
curl http://localhost:8000/api/routes | uv run python -m json.tool
```

---

## 🔧 Cloudflare Worker 設置 (可選)

如果要測試完整流程 (包含 Worker 驗證):

### 1. 安裝 Wrangler
```bash
npm install -g wrangler
```

### 2. 登入 Cloudflare
```bash
wrangler login
```

### 3. 創建 KV Namespace (**注意:沒有冒號**)
```bash
cd worker
wrangler kv namespace create "TOKENS"
```

### 4. 更新 wrangler.toml
將返回的 Namespace ID 填入 `worker/wrangler.toml`:
```toml
kv_namespaces = [
  { binding = "TOKENS", id = "your_actual_id_here" }
]
```

### 5. 更新後端 .env
```env
CF_ACCOUNT_ID=your_actual_account_id
CF_API_TOKEN=your_actual_api_token
CF_KV_NAMESPACE_ID=your_actual_namespace_id
```

### 6. 重啟後端
```bash
# 停止(找出佔用端口的進程並終止)
lsof -ti:8000 | xargs kill -9

# 啟動
cd backend
uv run uvicorn main:app --reload --port 8000
```

### 7. 本地測試 Worker
```bash
cd worker
npm install
npm run dev
```

### 8. 部署 Worker
```bash
wrangler deploy
```

---

## 📊 測試成功指標

✅ 後端健康檢查通過  
✅ 可以創建 Token  
✅ Token 正確返回 (ntk_ 前綴)  
✅ Token 列表正常顯示  
✅ 可以創建路由  
✅ 路由列表正常顯示  
✅ 統計信息正確  
✅ 前端可以打開  
✅ dummy 模式下顯示警告訊息 `⚠️ Warning: Using dummy Cloudflare credentials`

---

## 🛑 停止服務

```bash
# 停止後端(通過端口找到並終止)
lsof -ti:8000 | xargs kill -9

# 停止前端(Ctrl+C 在運行 npm run dev 的終端,或)
lsof -ti:5173 | xargs kill -9
# 如果端口自動跳轉到 5174
lsof -ti:5174 | xargs kill -9

# 停止 Docker PostgreSQL
docker stop token-manager-db
docker rm token-manager-db
```

---

## 🐛 常見問題

### 問題 1: 端口 5432 被佔用

**解決**: 改用 5433 端口 (已在指南中使用)

### 問題 2: 端口已被佔用 (Address already in use)

**解決**: 
```bash
# 找出佔用端口的進程
lsof -ti:8000  # 後端
lsof -ti:5173  # 前端(Vite會自動跳到5174如果5173被佔用)

# 終止該進程
lsof -ti:8000 | xargs kill -9   # 後端
lsof -ti:5173 | xargs kill -9   # 前端
```

### 問題 3: Worker KV 命令錯誤

**錯誤**: `wrangler kv:namespace create`  
**正確**: `wrangler kv namespace create` (沒有冒號!)

### 問題 4: dummy 憑證下 Token 創建失敗

**這是正常的!** dummy 憑證只跳過 KV 同步,Token 仍會存入資料庫。

---

## 🎉 下一步

本地測試成功後:
1. 按照 `docs/DEPLOYMENT.md` 部署到生產環境
2. 配置真實的 Cloudflare 憑證
3. 部署 Worker
4. 在 n8n 中開始使用！

---

**祝開發順利！** 🚀

