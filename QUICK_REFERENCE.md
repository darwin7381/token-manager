# Token Manager 快速參考指南

**版本**: v2.7  
**更新**: 2025-11-05

---

## 🚀 快速啟動

### **本地開發**

```bash
# 1. 後端（Terminal 1）
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# 2. 前端（Terminal 2）
cd frontend
npm run dev
# 訪問: http://localhost:5173

# 3. Worker 本地測試（Terminal 3，可選）
cd worker
npm run dev
# 訪問: http://localhost:8787
```

---

## 📱 頁面導航

| 頁面 | 路徑 | 說明 |
|------|------|------|
| 總覽 Dashboard | `/dashboard` | 系統統計、圖表、活動 |
| 系統健康 | `/system-health` | 服務狀態監控 |
| 審計日誌 | `/audit-logs` | 操作記錄查詢 |
| Token 管理 | `/tokens` | Token CRUD |
| 路由管理 | `/routes` | 路由 CRUD |
| 統計分析 | `/stats` | 基礎統計 |
| 用戶管理 | `/users` | 用戶和角色管理 |
| 團隊管理 | `/teams` | 團隊 CRUD |

---

## 🔑 API 快速參考

### **Dashboard API**
```bash
GET  /api/dashboard/overview           # Dashboard 數據
GET  /api/dashboard/audit-logs         # 審計日誌（分頁、篩選）
GET  /health/detailed                  # 詳細健康檢查
```

### **Token API**
```bash
GET    /api/tokens                     # Token 列表
POST   /api/tokens                     # 創建 Token
PUT    /api/tokens/{id}                # 更新 Token
DELETE /api/tokens/{id}                # 刪除 Token
GET    /api/tokens/{id}/reveal         # 解密 Token
```

### **路由 API**
```bash
GET    /api/routes                     # 路由列表
POST   /api/routes                     # 創建路由
PUT    /api/routes/{id}                # 更新路由
DELETE /api/routes/{id}                # 刪除路由
GET    /api/routes/tags                # 所有標籤
```

### **內部 API**
```bash
POST   /api/usage-log                  # Token 使用記錄（Worker 調用）
```

---

## 🧪 測試命令

### **健康檢查**
```bash
curl http://localhost:8000/health
curl http://localhost:8000/health/detailed
```

### **Dashboard 數據**
```bash
# 需要 Clerk token
curl http://localhost:8000/api/dashboard/overview \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

### **使用追蹤測試**
```bash
# 方式 1：使用腳本
./test_usage_tracking.sh

# 方式 2：手動測試
./test_usage_tracking.sh <token_hash>
```

---

## 🌐 環境變數

### **後端（Railway）**
```env
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_test_...
TOKEN_ENCRYPTION_KEY=...
CF_ACCOUNT_ID=...
CF_API_TOKEN=...
CF_KV_NAMESPACE_ID=...
```

### **Worker（Cloudflare）**
```toml
# 生產環境
TOKEN_MANAGER_BACKEND = "https://token.blocktempo.ai"

# 開發環境
TOKEN_MANAGER_BACKEND = "http://localhost:8000"
```

---

## 🎨 設計系統

### **顏色變數**
```css
/* 明亮模式 */
--bg-primary: #ffffff
--text-primary: #0f172a
--accent-primary: #3b82f6
--accent-success: #10b981
--accent-warning: #f59e0b
--accent-danger: #ef4444

/* 暗夜模式 */
--bg-primary: #0f172a
--text-primary: #f1f5f9
/* 其他變數參考 index.css */
```

### **按鈕類別**
```html
<button class="btn btn-primary">主要按鈕</button>
<button class="btn btn-secondary">次要按鈕</button>
<button class="btn btn-success">成功按鈕</button>
<button class="btn btn-danger">危險按鈕</button>
```

---

## 📂 關鍵文件位置

### **配置文件**
```
frontend/vite.config.js           - Vite 配置
frontend/src/index.css            - 設計系統變數
worker/wrangler.toml              - Worker 配置
backend/requirements.txt          - Python 依賴
```

### **組件文件**
```
frontend/src/components/
├── Dashboard/                    - Dashboard 組件
├── TokenManager/                 - Token 管理
├── RouteManager/                 - 路由管理
├── UserManagement/               - 用戶管理
├── TeamManagement/               - 團隊管理
├── Stats/                        - 統計頁面
└── Layout/                       - 布局組件
```

### **文檔文件**
```
IMPLEMENTATION_COMPLETE_V2.7.md              - 本次實施總結
DASHBOARD_OPTIMIZATION_AND_USAGE_TRACKING.md - 優化與配置
TOKEN_USAGE_TRACKING.md                      - 使用追蹤詳細文檔
DASHBOARD_MONITORING_COMPLETE.md             - Dashboard 完成報告
docs/PERMISSION_RULES.md                     - 權限規則
docs/BACKEND_AUTH_USAGE_GUIDE.md             - 後端認證指南
```

---

## 🐛 常見問題

### **Q: Dashboard 頁面空白**
**A**: 檢查瀏覽器 Console 錯誤，確認：
1. recharts 已安裝
2. API 返回數據正確
3. Clerk token 有效

### **Q: 系統健康檢查失敗**
**A**: 確認 Vite proxy 配置正確：
1. `vite.config.js` 包含 `/health` proxy
2. 重啟 Vite dev server
3. 檢查後端是否運行

### **Q: 使用追蹤不工作**
**A**: 檢查：
1. Worker 環境變數是否設置
2. 後端 `/api/usage-log` 是否可訪問
3. Worker 日誌是否有錯誤

### **Q: 暗夜模式下看不清文字**
**A**: 確認組件使用 CSS 變數而非硬編碼顏色

---

## 📞 支持資源

### **API 文檔**
- 本地: http://localhost:8000/docs
- 生產: https://token.blocktempo.ai/docs

### **相關文檔**
- `README.md` - 項目總覽
- `docs/PRD.md` - 產品需求
- `docs/PERMISSION_RULES.md` - 權限規則
- `IMPLEMENTATION_COMPLETE_V2.7.md` - 完整實施報告

---

**🎯 所有功能已完成，系統就緒！**

