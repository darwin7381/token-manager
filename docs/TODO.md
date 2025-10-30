# API Token 管理系統 - 開發任務清單

> **版本**: v1.0  
> **更新**: 2025-10-28  
> **狀態**: Ready for Development

---

## 📋 任務總覽

本文件列出完整的開發任務,按優先級和依賴關係組織。所有任務均為AI開發團隊執行,無時間預估。

---

## Phase 1: 基礎架構搭建

### 1.1 專案初始化

- [ ] **TASK-001**: 創建專案目錄結構
  ```
  token-manager/
  ├── backend/
  │   ├── main.py
  │   ├── models.py
  │   ├── database.py
  │   ├── cloudflare.py
  │   ├── requirements.txt
  │   └── __init__.py
  ├── frontend/
  │   └── index.html
  ├── cloudflare-worker/
  │   ├── worker.js
  │   └── wrangler.toml
  ├── Dockerfile
  ├── .env.example
  └── README.md
  ```

- [ ] **TASK-002**: 創建 requirements.txt
  - 依賴項目:
    - `fastapi==0.104.1`
    - `uvicorn==0.24.0`
    - `asyncpg==0.29.0`
    - `httpx==0.25.0`
    - `python-multipart==0.0.6`

- [ ] **TASK-003**: 創建 Dockerfile
  - 基於 `python:3.11-slim`
  - 安裝依賴
  - 配置啟動命令

- [ ] **TASK-004**: 創建 .env.example
  - `DATABASE_URL`
  - `CF_ACCOUNT_ID`
  - `CF_API_TOKEN`
  - `CF_KV_NAMESPACE_ID`

---

## Phase 2: 後端開發 (Token Manager)

### 2.1 數據庫層

- [ ] **TASK-101**: 實現 `database.py`
  - 連接池配置
  - 啟動時自動創建表
  - 關閉時清理連接

- [ ] **TASK-102**: 創建 Tokens 表
  ```sql
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
  CREATE INDEX idx_tokens_hash ON tokens(token_hash);
  CREATE INDEX idx_tokens_active ON tokens(is_active);
  ```

- [ ] **TASK-103**: 創建 Routes 表
  ```sql
  CREATE TABLE routes (
      id SERIAL PRIMARY KEY,
      path VARCHAR(255) NOT NULL UNIQUE,
      backend_url TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
  CREATE INDEX idx_routes_path ON routes(path);
  ```

- [ ] **TASK-104**: 創建 Audit Logs 表
  ```sql
  CREATE TABLE audit_logs (
      id SERIAL PRIMARY KEY,
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INTEGER,
      details JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
  CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
  ```

---

### 2.2 核心工具函數

- [ ] **TASK-201**: 實現 Token 生成函數
  ```python
  def generate_token() -> str:
      """生成格式: ntk_{32字節URL-safe隨機字符串}"""
      return f"ntk_{secrets.token_urlsafe(32)}"
  ```

- [ ] **TASK-202**: 實現 Token Hash 函數
  ```python
  def hash_token(token: str) -> str:
      """計算 SHA256 hash"""
      return hashlib.sha256(token.encode()).hexdigest()
  ```

- [ ] **TASK-203**: 實現 Cloudflare KV 同步函數
  - `async def sync_token_to_cf(token_hash: str, data: dict)`
  - 使用 Cloudflare API 寫入 KV
  - 錯誤處理和重試機制

- [ ] **TASK-204**: 實現 KV Token 刪除函數
  - `async def delete_token_from_cf(token_hash: str)`
  - 調用 Cloudflare API 刪除

- [ ] **TASK-205**: 實現路由同步函數
  - `async def sync_all_routes_to_cf()`
  - 讀取所有路由構建JSON對象
  - 寫入KV的 "routes" key

- [ ] **TASK-206**: 實現審計日誌函數
  - `async def log_audit(action, entity_type, entity_id, details)`
  - 寫入 audit_logs 表

---

### 2.3 Pydantic 數據模型

- [ ] **TASK-301**: 定義 TokenCreate 模型
  ```python
  class TokenCreate(BaseModel):
      name: str
      department: str
      scopes: List[str]
      expires_days: Optional[int] = 90
  ```

- [ ] **TASK-302**: 定義 TokenResponse 模型
  - 包含所有Token字段但不含明文

- [ ] **TASK-303**: 定義 RouteCreate/RouteResponse 模型

---

### 2.4 Token API 實現

- [ ] **TASK-401**: 實現 POST /api/tokens
  - 生成Token和hash
  - 存入PostgreSQL
  - 同步到Cloudflare KV
  - 記錄審計日誌
  - 返回Token (只此一次)

- [ ] **TASK-402**: 實現 GET /api/tokens
  - 查詢所有活躍Token
  - 排除token_hash字段
  - 按創建時間降序

- [ ] **TASK-403**: 實現 DELETE /api/tokens/:id
  - 從PostgreSQL刪除
  - 從KV刪除
  - 記錄審計日誌

---

### 2.5 Route API 實現

- [ ] **TASK-501**: 實現 POST /api/routes
  - 驗證path格式 (必須以/開頭)
  - 驗證backend_url格式
  - 存入PostgreSQL
  - 同步所有路由到KV

- [ ] **TASK-502**: 實現 GET /api/routes
  - 返回所有路由
  - 按創建時間降序

- [ ] **TASK-503**: 實現 PUT /api/routes/:id
  - 更新路由信息
  - 重新同步到KV

- [ ] **TASK-504**: 實現 DELETE /api/routes/:id
  - 刪除路由
  - 重新同步到KV

---

### 2.6 統計與健康檢查

- [ ] **TASK-601**: 實現 GET /api/stats
  - 活躍Token總數
  - 路由總數
  - 最近10條審計日誌

- [ ] **TASK-602**: 實現 GET /health
  - 返回系統健康狀態

---

### 2.7 CORS與靜態文件

- [ ] **TASK-701**: 配置CORS中間件
  - 允許所有來源 (開發階段)
  - 允許所有方法和Header

- [ ] **TASK-702**: 掛載靜態文件目錄
  - 掛載 `/` 到 `frontend/` 目錄
  - 支持 `index.html` 作為默認文件

---

## Phase 3: 前端開發 (Web UI)

### 3.1 基礎HTML結構

- [ ] **TASK-801**: 創建基礎HTML框架
  - HTML5 doctype
  - Meta標籤 (charset, viewport)
  - 標題和favicon

- [ ] **TASK-802**: 實現CSS樣式
  - 現代化扁平設計
  - 響應式佈局
  - 統一的色彩系統
  - 按鈕、輸入框、表格樣式

---

### 3.2 頁面佈局

- [ ] **TASK-901**: 實現Header區域
  - 系統標題和Logo
  - 副標題說明

- [ ] **TASK-902**: 實現Tab導航
  - Token管理
  - 路由管理
  - 統計資訊
  - Tab切換邏輯

---

### 3.3 Token管理頁面

- [ ] **TASK-1001**: 實現Token創建表單
  - 名稱輸入框
  - 部門輸入框
  - 權限範圍輸入框 (逗號分隔)
  - 過期天數輸入框
  - 創建按鈕

- [ ] **TASK-1002**: 實現Token創建邏輯
  - 表單驗證
  - 調用 POST /api/tokens
  - 顯示生成的Token (醒目提示)
  - 清空表單

- [ ] **TASK-1003**: 實現Token列表顯示
  - 表格結構 (ID, 名稱, 部門, 權限, 時間, 操作)
  - 調用 GET /api/tokens
  - 格式化時間顯示
  - 權限Badge樣式

- [ ] **TASK-1004**: 實現Token撤銷功能
  - 確認對話框
  - 調用 DELETE /api/tokens/:id
  - 刷新列表

---

### 3.4 路由管理頁面

- [ ] **TASK-1101**: 實現路由創建表單
  - 路徑輸入框
  - 後端URL輸入框
  - 描述輸入框
  - 新增按鈕

- [ ] **TASK-1102**: 實現路由創建邏輯
  - 表單驗證
  - 調用 POST /api/routes
  - 清空表單
  - 刷新列表

- [ ] **TASK-1103**: 實現路由列表顯示
  - 表格結構 (ID, 路徑, 後端URL, 描述, 時間, 操作)
  - 調用 GET /api/routes

- [ ] **TASK-1104**: 實現路由刪除功能
  - 確認對話框
  - 調用 DELETE /api/routes/:id
  - 刷新列表

---

### 3.5 統計資訊頁面

- [ ] **TASK-1201**: 實現統計卡片
  - 活躍Token數量卡片
  - 路由總數卡片
  - 漸變背景樣式

- [ ] **TASK-1202**: 實現審計日誌列表
  - 表格結構 (時間, 操作, 類型, 詳情)
  - 調用 GET /api/stats
  - 格式化JSON顯示

---

### 3.6 通用功能

- [ ] **TASK-1301**: 實現錯誤提示
  - Alert對話框
  - 網絡錯誤處理

- [ ] **TASK-1302**: 實現刷新按鈕
  - 每個列表都有刷新功能

- [ ] **TASK-1303**: 實現頁面初始化
  - 默認顯示Token管理頁
  - 自動加載Token列表

---

## Phase 4: Cloudflare Worker 開發

### 4.1 Worker 核心邏輯

- [ ] **TASK-1401**: 創建 worker.js 主函數
  ```javascript
  export default {
    async fetch(request, env, ctx) {
      // 主邏輯
    }
  }
  ```

- [ ] **TASK-1402**: 實現 API Key 提取
  - 從 `X-API-Key` header 提取
  - 缺少時返回 401

- [ ] **TASK-1403**: 實現 SHA256 hash 函數
  ```javascript
  async function sha256(message) {
    // 使用 Web Crypto API
  }
  ```

- [ ] **TASK-1404**: 實現 Token 驗證邏輯
  - 計算hash
  - 查詢 KV: `token:{hash}`
  - 檢查是否存在
  - 檢查是否過期

- [ ] **TASK-1405**: 實現路由查找邏輯
  - 讀取 KV: `routes`
  - 按路徑長度降序排序
  - 使用 `startsWith` 匹配

- [ ] **TASK-1406**: 實現 Scope 權限檢查
  - 從路徑提取服務名稱
  - 檢查 Token 的 scopes 數組
  - `*` 表示全部權限

- [ ] **TASK-1407**: 實現請求轉發邏輯
  - 構建後端URL (移除匹配的前綴)
  - 保留query parameters
  - 轉發原始method, headers, body
  - 返回後端響應

---

### 4.2 錯誤處理

- [ ] **TASK-1501**: 實現標準錯誤響應格式
  ```javascript
  {
    "error": "錯誤類型",
    "message": "詳細說明"
  }
  ```

- [ ] **TASK-1502**: 處理各類錯誤情況
  - 缺少API Key → 401
  - API Key無效 → 401
  - Token過期 → 401
  - 權限不足 → 403
  - 路由不存在 → 404
  - 內部錯誤 → 500

---

### 4.3 Worker 配置

- [ ] **TASK-1601**: 創建 wrangler.toml
  - 設置Worker名稱
  - 綁定KV Namespace
  - 配置compatibility_date

- [ ] **TASK-1602**: 配置路由規則
  - 自定義域名配置
  - 或使用 workers.dev 子域名

---

## Phase 5: 部署與配置

### 5.1 Cloudflare 準備

- [ ] **TASK-1701**: 註冊/登入 Cloudflare
  - 訪問 https://dash.cloudflare.com/

- [ ] **TASK-1702**: 創建 KV Namespace
  - 名稱: `api-gateway-tokens`
  - 記錄 Namespace ID

- [ ] **TASK-1703**: 創建 API Token
  - 權限: Account > Workers KV Storage > Edit
  - 記錄 Token 值

- [ ] **TASK-1704**: 記錄 Account ID
  - 從 Dashboard 獲取

---

### 5.2 Railway 部署

- [ ] **TASK-1801**: 創建 Railway 項目
  - 訪問 https://railway.app/

- [ ] **TASK-1802**: 添加 PostgreSQL 服務
  - 創建數據庫
  - 獲取 DATABASE_URL

- [ ] **TASK-1803**: 配置環境變數
  - `DATABASE_URL`
  - `CF_ACCOUNT_ID`
  - `CF_API_TOKEN`
  - `CF_KV_NAMESPACE_ID`

- [ ] **TASK-1804**: 連接 GitHub 倉庫
  - 推送代碼到 GitHub
  - Railway 連接倉庫
  - 自動部署

---

### 5.3 Cloudflare Worker 部署

- [ ] **TASK-1901**: 安裝 Wrangler CLI
  ```bash
  npm install -g wrangler
  ```

- [ ] **TASK-1902**: 登入 Cloudflare
  ```bash
  wrangler login
  ```

- [ ] **TASK-1903**: 更新 wrangler.toml
  - 填入實際的 KV Namespace ID

- [ ] **TASK-1904**: 部署 Worker
  ```bash
  cd cloudflare-worker
  wrangler deploy
  ```

- [ ] **TASK-1905**: 配置自定義域名 (可選)
  - Workers & Pages → Triggers
  - 添加自定義域名

---

## Phase 6: 測試與驗證

### 6.1 單元測試

- [ ] **TASK-2001**: 測試 Token 生成
  - 格式正確 (ntk_ 前綴)
  - 長度正確
  - 隨機性

- [ ] **TASK-2002**: 測試 Hash 計算
  - SHA256 正確性
  - 與 Worker 一致

- [ ] **TASK-2003**: 測試數據庫操作
  - Token CRUD
  - Route CRUD
  - Audit Log 寫入

---

### 6.2 集成測試

- [ ] **TASK-2101**: 測試完整 Token 流程
  1. 創建 Token
  2. 驗證存入 PostgreSQL
  3. 驗證同步到 KV
  4. 使用 Token 調用 Worker
  5. 撤銷 Token
  6. 驗證 Token 失效

- [ ] **TASK-2102**: 測試完整路由流程
  1. 創建路由
  2. 驗證同步到 KV
  3. 使用路由發送請求
  4. 驗證正確轉發
  5. 修改路由
  6. 驗證更新生效
  7. 刪除路由
  8. 驗證返回 404

- [ ] **TASK-2103**: 測試權限控制
  - Token 有對應 scope → 通過
  - Token 無對應 scope → 403
  - Token 有 * scope → 通過所有

---

### 6.3 端到端測試

- [ ] **TASK-2201**: 測試 Web UI 操作
  - 訪問管理系統
  - 創建 Token
  - 複製 Token
  - 創建路由
  - 刷新列表
  - 撤銷 Token

- [ ] **TASK-2202**: 測試實際微服務調用
  - 創建測試路由 (指向 httpbin.org)
  - 使用 curl 或 n8n 發送請求
  - 驗證響應正確

- [ ] **TASK-2203**: 測試錯誤場景
  - 無 API Key → 401
  - 錯誤的 API Key → 401
  - 過期的 Token → 401
  - 不存在的路由 → 404
  - 權限不足 → 403

---

### 6.4 性能測試

- [ ] **TASK-2301**: 測試 Worker 延遲
  - 使用 curl 測試響應時間
  - 目標: P95 < 200ms

- [ ] **TASK-2302**: 測試 KV 同步時間
  - 創建/撤銷 Token 後測試生效時間
  - 目標: < 60秒

- [ ] **TASK-2303**: 測試並發請求
  - 使用 Apache Bench 或類似工具
  - 驗證 Worker 可處理預期負載

---

## Phase 7: 文檔與交付

### 7.1 README 文檔

- [ ] **TASK-2401**: 編寫 README.md
  - 項目簡介
  - 快速開始
  - 架構圖
  - 部署步驟
  - 使用示例

- [ ] **TASK-2402**: 編寫部署指南
  - Cloudflare 配置步驟
  - Railway 配置步驟
  - 環境變數說明

- [ ] **TASK-2403**: 編寫 API 文檔
  - 所有 API 端點
  - 請求/響應示例
  - 錯誤碼說明

---

### 7.2 運維文檔

- [ ] **TASK-2501**: 編寫維護手冊
  - 日常操作指南
  - 故障排查步驟
  - 常見問題 FAQ

- [ ] **TASK-2502**: 編寫監控指南
  - Cloudflare Dashboard 使用
  - 審計日誌查詢
  - 關鍵指標監控

---

### 7.3 安全文檔

- [ ] **TASK-2601**: 編寫安全最佳實踐
  - Token 管理建議
  - API Key 保護措施
  - 審計日誌審查

---

## Phase 8: 優化與改進 (Phase 2)

以下任務為第二階段功能,在 MVP 完成後實施:

### 8.1 認證系統

- [ ] **TASK-3001**: 實現管理系統登入
  - 用戶表
  - 密碼 hash
  - Session 管理

- [ ] **TASK-3002**: 實現 RBAC
  - 角色定義
  - 權限控制
  - 操作審計

---

### 8.2 進階功能

- [ ] **TASK-3101**: 實現 Rate Limiting
  - Worker 層限流
  - 基於 Token 或 IP

- [ ] **TASK-3102**: 實現詳細使用統計
  - Token 使用次數
  - 請求量統計
  - 趨勢圖表

- [ ] **TASK-3103**: 實現 Webhook 通知
  - Token 即將過期提醒
  - 異常行為告警

---

### 8.3 監控集成

- [ ] **TASK-3201**: 集成 Sentry
  - 錯誤監控
  - 性能追蹤

- [ ] **TASK-3202**: 集成 Grafana
  - 指標可視化
  - 告警配置

---

## 🎯 關鍵里程碑

### Milestone 1: 後端 API 完成
- 完成所有 Phase 2 任務
- 可通過 curl 測試所有端點

### Milestone 2: 前端 UI 完成
- 完成所有 Phase 3 任務
- 可通過瀏覽器完成所有操作

### Milestone 3: Worker 部署完成
- 完成所有 Phase 4 任務
- Worker 可正確驗證和轉發請求

### Milestone 4: 系統集成完成
- 完成所有 Phase 5-6 任務
- 端到端流程驗證通過

### Milestone 5: 生產就緒
- 完成所有 Phase 7 任務
- 文檔完整,可交付使用

---

## 📝 任務追蹤

### 任務狀態定義
- `[ ]` 待開始
- `[WIP]` 進行中
- `[✓]` 已完成
- `[BLOCKED]` 被阻塞
- `[SKIP]` 跳過

### 依賴關係
- Phase 2 必須在 Phase 3 之前完成大部分任務
- Phase 4 可與 Phase 2-3 並行
- Phase 5 依賴 Phase 2-4 完成
- Phase 6 依賴 Phase 5 完成

---

**文件結束**

開發團隊請按照任務順序執行,每完成一個任務標記為 `[✓]`,如遇到阻塞請在任務下方註記原因。

