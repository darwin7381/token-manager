# 啟動指令標準化指南

> **重要**: 本專案統一使用 `uv` 管理 Python 環境,禁止直接使用 `python3` 或 `pip` 指令

---

## 🎯 標準化原則

1. **所有 Python 指令必須通過 `uv` 執行**
2. **停止服務使用 `lsof` 找到 PID,而非 `pkill`**
3. **所有路徑必須明確,避免相對路徑錯誤**

---

## 📚 正確的指令對照表

### Python 執行

| ❌ 錯誤指令 | ✅ 正確指令 |
|-----------|-----------|
| `python3 script.py` | `uv run python script.py` |
| `python3 -m module` | `uv run python -m module` |
| `python3 -c "code"` | `uv run python -c "code"` |
| `pip install package` | `uv pip install package` |

### 服務啟動

| ❌ 錯誤指令 | ✅ 正確指令 |
|-----------|-----------|
| `uvicorn main:app --reload` | `uv run uvicorn main:app --reload --port 8000` |
| `python -m http.server` | `npm run dev` (前端使用 Vite) |

### 停止服務

| ❌ 錯誤指令 | ✅ 正確指令 |
|-----------|-----------|
| `pkill -f "uvicorn"` | `lsof -ti:8000 \| xargs kill -9` |
| `pkill -f "vite"` | `lsof -ti:5173 \| xargs kill -9` (或 Ctrl+C) |

---

## 🚀 標準啟動流程

### 1. 啟動 PostgreSQL

```bash
docker run --name token-manager-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=tokenmanager \
  -p 5433:5432 \
  -d postgres:15
```

### 2. 設置後端環境變數

```bash
cd /Users/JL/Development/microservice-system/token-manager/backend
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5433/tokenmanager
CF_ACCOUNT_ID=dummy
CF_API_TOKEN=dummy  
CF_KV_NAMESPACE_ID=dummy
EOF
```

### 3. 安裝依賴（首次或更新時）

```bash
cd /Users/JL/Development/microservice-system/token-manager/backend

# 創建虛擬環境
uv venv

# 安裝依賴
uv pip install -r requirements.txt
```

### 4. 啟動後端服務

```bash
cd /Users/JL/Development/microservice-system/token-manager/backend
uv run uvicorn main:app --reload --port 8000
```

**驗證**: 訪問 http://localhost:8000/health 應返回:
```json
{"status":"healthy","service":"token-manager","version":"1.0.0"}
```

### 5. 啟動前端（新終端）

```bash
cd /Users/JL/Development/microservice-system/token-manager/frontend

# 首次啟動需要安裝依賴
npm install

# 啟動 Vite 開發伺服器
npm run dev
```

**驗證**: 訪問 http://localhost:5173 應顯示前端界面

**注意**: 如果 5173 端口被佔用,Vite 會自動使用 5174、5175 等端口

---

## 🛑 停止服務

### 停止後端

```bash
# 找出佔用 8000 端口的進程並終止
lsof -ti:8000 | xargs kill -9
```

### 停止前端

```bash
# 方法 1: 在運行 npm run dev 的終端按 Ctrl+C

# 方法 2: 找出佔用端口的進程並終止
lsof -ti:5173 | xargs kill -9
# 如果 Vite 自動跳到其他端口
lsof -ti:5174 | xargs kill -9
```

### 停止資料庫

```bash
docker stop token-manager-db
docker rm token-manager-db
```

---

## 🐛 常見錯誤與解決

### 錯誤 1: Address already in use

**症狀**:
```
ERROR: [Errno 48] Address already in use
```

**原因**: 端口已被佔用

**解決**:
```bash
# 檢查是哪個進程佔用
lsof -ti:8000  # 或 :3001

# 終止該進程
lsof -ti:8000 | xargs kill -9

# 重新啟動
cd /Users/JL/Development/microservice-system/token-manager/backend
uv run uvicorn main:app --reload --port 8000
```

### 錯誤 2: command not found: uvicorn

**症狀**:
```
zsh: command not found: uvicorn
```

**原因**: 沒有通過 `uv run` 執行

**解決**:
```bash
# ❌ 錯誤
uvicorn main:app --reload

# ✅ 正確
uv run uvicorn main:app --reload --port 8000
```

### 錯誤 3: 前端端口跳轉到 5174

**症狀**:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5174/
```

**原因**: 5173 端口被佔用,Vite 自動跳到下一個可用端口

**解決**:
```bash
# 檢查是什麼佔用了 5173
lsof -ti:5173

# 終止佔用的進程
lsof -ti:5173 | xargs kill -9

# 重新啟動前端,會回到 5173
npm run dev
```

---

## 📝 測試腳本標準

所有測試腳本都已更新為使用 `uv`:

### test_local.sh

```bash
cd /Users/JL/Development/microservice-system/token-manager
./test_local.sh
```

內部使用:
- `uv run python -m json.tool` 解析 JSON
- `uv run python -c "code"` 執行簡單腳本

### 其他測試腳本

- `scripts/generate_demo_data.sh`
- `scripts/generate_test_usage_data.sh`
- `scripts/quick_generate_real_data.sh`

全部已統一使用 `uv run python`

---

## 🔍 驗證修正

### 檢查所有包含 python3 的檔案

```bash
cd /Users/JL/Development/microservice-system/token-manager
grep -r "python3" --include="*.sh" --include="*.md" .
```

**預期結果**: 應該只在以下位置出現:
- 註釋中的說明
- `backend/final_test.py` (舊測試檔案)
- `nixpacks.toml` (部署配置,不影響本地開發)
- archived 文檔中

### 檢查所有包含 pkill 的檔案

```bash
cd /Users/JL/Development/microservice-system/token-manager
grep -r "pkill" --include="*.sh" --include="*.md" .
```

**預期結果**: 應該沒有任何使用 `pkill` 的活躍腳本

---

## ✅ 已修正的檔案清單

### 文檔類
1. `QUICK_START.md` - 快速啟動指南
2. `README.md` - 主文檔
3. `docs/ROUTE_TESTING_GUIDE.md` - 路由測試指南

### 腳本類
1. `test_local.sh` - 本地測試腳本
2. `scripts/generate_test_usage_data.sh` - 生成測試數據
3. `scripts/generate_demo_data.sh` - 生成演示數據
4. `scripts/quick_generate_real_data.sh` - 快速生成真實數據

### 修正內容
- ✅ 所有 `python3` → `uv run python`
- ✅ 所有 `pkill` → `lsof -ti:PORT | xargs kill -9`
- ✅ 統一使用絕對路徑
- ✅ 新增正確的錯誤處理說明

---

## 📌 開發者備忘

### 記住這些原則

1. **永遠不要** 直接執行 `python3`、`pip`、`uvicorn`
2. **永遠使用** `uv run python`、`uv pip`、`uv run uvicorn`
3. **停止服務** 使用 `lsof -ti:PORT | xargs kill -9`
4. **路徑要明確** 使用絕對路徑或明確 `cd` 到正確目錄

### 快速參考

```bash
# 啟動後端
cd /Users/JL/Development/microservice-system/token-manager/backend
uv run uvicorn main:app --reload --port 8000

# 啟動前端(新終端)
cd /Users/JL/Development/microservice-system/token-manager/frontend
npm run dev

# 停止後端
lsof -ti:8000 | xargs kill -9

# 停止前端
lsof -ti:5173 | xargs kill -9  # 或在終端按 Ctrl+C

# 測試系統
cd /Users/JL/Development/microservice-system/token-manager
./test_local.sh
```

---

**文件版本**: 1.0  
**最後更新**: 2025-11-09  
**維護者**: AI Team

