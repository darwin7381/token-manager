# Token Manager 文檔索引

**最後更新**: 2025-11-07  
**專案版本**: v2.8.1

---

## 📚 文檔導航指南

### 🎯 從這裡開始

根據你的需求，選擇對應的文檔：

| 我想... | 閱讀這個文檔 |
|---------|------------|
| 了解專案整體進度和功能 | `PROJECT_PROGRESS_OVERVIEW.md` ⭐ |
| 快速開始使用專案 | `QUICK_START.md` |
| 本地開發環境設置 | `LOCAL_DEVELOPMENT.md` |
| 查詢 API 和常用命令 | `QUICK_REFERENCE.md` |
| 部署到生產環境 | `DEPLOYMENT_CHECKLIST.md` |
| 了解專案架構和設計 | `README.md` + `docs/PRD.md` |

---

## 📖 核心文檔（專案根目錄）

### 專案總覽
- **`PROJECT_PROGRESS_OVERVIEW.md`** ⭐ - 專案進度總覽（最重要）
  - 完成度統計
  - 功能模組說明
  - 文檔分類索引
  - 技術統計
  - 當前任務

### 快速開始
- **`README.md`** - 專案說明和架構介紹
- **`QUICK_START.md`** - 快速開始指南
- **`QUICK_REFERENCE.md`** - 常用命令和 API 快速參考

### 開發指南
- **`LOCAL_DEVELOPMENT.md`** - 本地開發完整指南
  - 環境設置
  - 開發流程
  - 常見問題

### 部署指南
- **`DEPLOYMENT_CHECKLIST.md`** - 生產部署完整檢查清單
  - 部署步驟
  - 環境變數配置
  - 測試驗證
  - 域名配置

---

## 📁 功能說明文檔（docs/ 目錄）

### 核心架構與設計
- `docs/PRD.md` - 產品需求文檔（Product Requirements Document）
- `docs/RBAC_REDESIGN.md` - RBAC 權限系統設計
- `docs/PER_TEAM_ROLES_ANALYSIS.md` - Per-Team Roles 架構分析

### 權限系統
- `docs/PERMISSIONS_GUIDE.md` - 權限系統完整指南
- `docs/PERMISSIONS_QUICK_REFERENCE.md` - 權限快速參考
- `docs/PERMISSION_RULES.md` - 詳細權限規則

### Token 管理
- `docs/TOKEN_LIFECYCLE_EXPLAINED.md` - Token 生命週期說明
- `docs/CLIPBOARD_API_SOLUTION.md` - Token 複製功能實現

### 路由與認證
- `docs/BACKEND_AUTH_USAGE_GUIDE.md` - 後端認證使用指南
- `docs/ROUTE_BACKEND_AUTH_DESIGN.md` - 路由後端認證設計
- `docs/ROUTE_TESTING_GUIDE.md` - 路由測試指南

### 數據庫
- `docs/DATABASE_MIGRATION_EXPLAINED.md` - 自動遷移機制說明

### 其他
- `docs/DEPLOYMENT.md` - 部署相關說明
- `docs/TODO.md` - 開發任務清單
- `docs/IMPLEMENTATION_SUMMARY.md` - 實現總結

---

## 🗃️ 歷史文檔（archive/ 目錄）

歷史文檔已按類型分類歸檔，這些內容反映開發過程的記錄。

**查看歸檔說明**: `archive/README.md`

### 目錄結構

```
archive/
├── progress-reports/      # 專案進度報告（8個）
├── implementation-docs/   # 功能實現文檔（8個）
├── test-reports/          # 測試報告（4個）
├── guides/                # 使用指南和分析（5個）
├── deployment-configs/    # 部署配置文檔（3個）
└── analysis/              # 分析和改進文檔（8個）
```

### 各目錄說明

**progress-reports/** - 專案進度報告
- 階段性進度總結
- 版本實現報告
- 完成度統計

**implementation-docs/** - 功能實現文檔
- 後端認證、Core Team 實現
- Per-Team Roles、團隊管理
- Token 功能、Dashboard 實現

**test-reports/** - 測試報告
- 系統測試、端到端測試
- 測試計劃和結果

**guides/** - 使用指南和分析
- 使用分析指南
- Token 追蹤、Dashboard 優化

**deployment-configs/** - 部署配置
- 域名配置和驗證
- 部署檢查

**analysis/** - 分析和改進
- 路由重構、UI 改進
- 技術決策分析

⚠️ **注意**: 歸檔文檔可能包含過時資訊，請以最新的核心文檔為準。

---

## 🎯 常見使用場景

### 場景 1：新加入專案的開發者

**閱讀順序**：
1. `README.md` - 了解專案是什麼
2. `PROJECT_PROGRESS_OVERVIEW.md` - 了解專案進度和功能
3. `LOCAL_DEVELOPMENT.md` - 設置開發環境
4. `QUICK_REFERENCE.md` - 查詢常用命令
5. `docs/PERMISSIONS_GUIDE.md` - 了解權限系統

### 場景 2：我想部署到生產環境

**閱讀順序**：
1. `DEPLOYMENT_CHECKLIST.md` - 完整的部署步驟
2. `docs/DATABASE_MIGRATION_EXPLAINED.md` - 了解數據庫遷移
3. `docs/BACKEND_AUTH_USAGE_GUIDE.md` - 配置後端認證

### 場景 3：我想了解某個功能怎麼實現的

**查詢路徑**：
1. 先查看 `PROJECT_PROGRESS_OVERVIEW.md` - 找到相關功能的說明和文檔連結
2. 根據連結查看對應的 `docs/` 目錄文檔
3. 如果需要歷史背景，可以查看 `archive/progress-reports/` 中的相關文檔

### 場景 4：我想測試某個功能

**參考文檔**：
- `QUICK_REFERENCE.md` - 常用測試命令
- `docs/ROUTE_TESTING_GUIDE.md` - 路由測試
- `LOCAL_DEVELOPMENT.md` - 測試環境設置

---

## 📊 文檔統計

### 文檔數量
```
核心文檔（根目錄）:         6 個
功能說明文檔（docs/）:      15 個
歸檔文檔（archive/）:       33 個
────────────────────────────
總計:                       54 個文檔
```

### 文檔行數
```
核心文檔:               約 35,000+ 行
功能說明文檔:           約 20,000+ 行
歸檔文檔:               約 15,000+ 行
────────────────────────────
總計:                   約 70,000+ 行文檔
```

---

## 🔍 文檔搜尋技巧

### 使用 grep 搜尋
```bash
# 在所有文檔中搜尋關鍵字
grep -r "關鍵字" *.md docs/*.md

# 在核心文檔中搜尋
grep -r "關鍵字" *.md

# 在功能文檔中搜尋
grep -r "關鍵字" docs/*.md

# 在歸檔中搜尋（如果需要查看歷史）
grep -r "關鍵字" archive/progress-reports/*.md
```

### 常見搜尋關鍵字
- `權限` / `permission` - 權限相關
- `Token` - Token 管理相關
- `路由` / `route` - 路由管理相關
- `認證` / `auth` - 認證相關
- `部署` / `deploy` - 部署相關
- `測試` / `test` - 測試相關

---

## ⚠️ 重要提示

### 文檔版本
- 所有核心文檔都會標註更新日期
- 如果發現內容衝突，以**最新日期**的文檔為準
- `PROJECT_PROGRESS_OVERVIEW.md` 是最權威的當前狀態文檔

### 文檔維護
- 新功能實現後，應該更新對應的功能說明文檔
- 重大變更應該更新 `PROJECT_PROGRESS_OVERVIEW.md`
- 歸檔文檔不應該再被修改，只作為歷史記錄保存

### 求助途徑
如果文檔無法解答你的問題：
1. 查看 `docs/TODO.md` - 可能是已知問題
2. 查看 Git commit 歷史 - 了解變更原因
3. 查看代碼註釋 - 直接查看實現細節

---

## 🎊 文檔整理完成

✅ **核心文檔** - 保留在專案根目錄，隨時可查閱  
✅ **功能文檔** - 組織在 docs/ 目錄，分類清晰  
✅ **進度文檔** - 歸檔到 archive/，保留歷史記錄  
✅ **文檔索引** - 本文檔，快速導航所有資料  

**現在文檔結構清晰，易於查找！** 🚀

---

**文件版本**: 1.0  
**建立時間**: 2025-11-07  
**維護者**: AI Team

