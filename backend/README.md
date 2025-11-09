# Token Manager Backend

FastAPI 後端服務

## 🚀 啟動方式（正規）

### 前置需求

- Python 3.10+
- uv (推薦) 或 pip

### 1. 安裝依賴

```bash
# 使用 uv（推薦，速度快 10-100 倍）
uv pip install -r requirements.txt

# 或使用傳統 pip
pip install -r requirements.txt
```

### 2. 設定環境變數

複製 `.env.example` 到 `.env`（如果有的話），或直接編輯 `.env`：

```bash
# PostgreSQL
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5433/tokenmanager

# Cloudflare
CF_ACCOUNT_ID=your_account_id
CF_API_TOKEN=your_api_token
CF_KV_NAMESPACE_ID=your_namespace_id

# Clerk
CLERK_SECRET_KEY=sk_test_your_secret_key
CLERK_FRONTEND_API=your-app.accounts.dev  # 從 Clerk Dashboard 獲取
```

### 3. 啟動開發服務器

```bash
# 使用 uv（推薦）
uv run uvicorn main:app --reload --port 8000

# 或使用傳統方式
uvicorn main:app --reload --port 8000
```

**參數說明：**
- `--reload` - 開發模式，代碼變更自動重載
- `--port 8000` - 指定端口（預設 8000）

### 4. 驗證服務

```bash
# 檢查健康狀態
curl http://localhost:8000/health

# 查看 API 文檔
open http://localhost:8000/docs
```

---

## 📦 生產環境部署

### 使用 Docker（推薦）

```bash
# 構建映像
docker build -t token-manager-backend .

# 運行容器
docker run -d -p 8000:8000 --env-file .env token-manager-backend
```

### 直接運行

```bash
# 使用 gunicorn + uvicorn workers
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

---

## 🛠️ 開發指令

### 安裝新套件

```bash
# 使用 uv
uv pip install package_name

# 更新 requirements.txt
uv pip freeze > requirements.txt
```

### 數據庫遷移

```bash
# 運行遷移（如果使用 Alembic）
alembic upgrade head
```

### 測試

```bash
# 運行測試
pytest

# 運行測試並顯示覆蓋率
pytest --cov=. --cov-report=html
```

---

## 📂 專案結構

```
backend/
├── main.py              # FastAPI 主應用
├── models.py            # Pydantic 模型
├── database.py          # 資料庫連接
├── cloudflare.py        # Cloudflare KV 操作
├── clerk_auth.py        # Clerk 認證
├── user_routes.py       # 用戶管理 API
├── requirements.txt     # Python 依賴
├── .env                 # 環境變數（不要提交到 git）
└── README.md           # 本文件
```

---

## 🔧 常見問題

### Q: 為什麼使用 uv？

**A:** uv 是基於 Rust 的現代 Python 套件管理器，比傳統 pip 快 10-100 倍，更穩定可靠。

### Q: 啟動時出現 "Address already in use"

**A:** 端口 8000 被佔用，殺掉舊進程：
```bash
lsof -ti:8000 | xargs kill -9
```

### Q: 資料庫連接失敗

**A:** 
1. 確認 PostgreSQL 正在運行
2. 檢查 DATABASE_URL 是否正確
3. 確認端口沒有衝突

### Q: Clerk 認證失敗（401）

**A:**
1. 確認 CLERK_SECRET_KEY 已設定
2. 確認 CLERK_FRONTEND_API 與你的 Clerk 應用匹配
3. 前往 Clerk Dashboard 確認 domain

---

## 📚 相關文檔

- [FastAPI 官方文檔](https://fastapi.tiangolo.com/)
- [Clerk 後端 API](https://clerk.com/docs/reference/backend-api)
- [uv 文檔](https://github.com/astral-sh/uv)

---

**啟動成功後，API 文檔可在 http://localhost:8000/docs 查看**



