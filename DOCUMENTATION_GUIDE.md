# 文檔組織與維護規範

**建立日期**: 2025-11-08  
**適用範圍**: Token Manager 專案所有文檔

---

## 📁 文檔結構總覽

```
token-manager/
├── docs/                    # 核心功能文檔（當前系統）
│   ├── solutions/           # 技術解決方案（深度技術說明）
│   └── *.md                # 功能說明文檔
├── archive/                 # 歷史文檔（已完成的報告）
│   ├── implementation-docs/ # 功能實施報告
│   ├── progress-reports/    # 進度報告
│   ├── test-reports/        # 測試報告
│   ├── deployment-configs/  # 部署記錄
│   ├── analysis/            # 分析報告
│   └── design/              # 早期設計文檔
├── *.md                     # 根目錄核心文檔
├── backend/README.md        # 後端說明
└── frontend/README.md       # 前端說明
```

---

## 📝 文檔分類規則

### Docs/ - 當前系統功能文檔

**放什麼**：
- ✅ 功能使用說明（如何使用某功能）
- ✅ 系統設計文檔（當前架構）
- ✅ 權限規則說明
- ✅ 部署指南
- ✅ 測試指南
- ✅ API 說明（補充 FastAPI 自動生成的）
- ✅ 錯誤記錄（CRITICAL_ERRORS_LEARNED.md）

**不放什麼**：
- ❌ 實施報告（「我們做了什麼」）
- ❌ 進度報告（「完成度統計」）
- ❌ 過時的設計文檔
- ❌ 測試結果報告

**命名規範**：
- 大寫 + 底線：`PERMISSION_RULES.md`
- 描述性名稱：`ROUTE_BACKEND_AUTH.md`
- 避免版本號：❌ `GUIDE_V2.md`

---

### Docs/Solutions/ - 技術解決方案

**放什麼**：
- ✅ 深度技術問題分析
- ✅ 完整的解決方案和實作細節
- ✅ 技術決策說明（為什麼這樣做）
- ✅ 複雜機制的詳細解析

**範例**：
- `DATABASE_MIGRATION_EXPLAINED.md` - 零遷移檔案方案
- `CLIPBOARD_API_SOLUTION.md` - 瀏覽器 API 限制解決方案
- `TOKEN_LIFECYCLE_EXPLAINED.md` - Token 完整生命週期

**特點**：
- 內容技術性強
- 包含完整的代碼範例
- 對當前系統仍然有效
- 與 CRITICAL_ERRORS.md 互補（詳細 vs 精簡）

---

### Archive/ - 歷史文檔

#### Archive/Implementation-Docs/ - 功能實施報告

**放什麼**：
- ✅ 功能實施的完整報告
- ✅ 技術實現細節（歷史快照）
- ✅ 實施過程記錄

**範例**：
- `PER_TEAM_ROLES_COMPLETE.md` - Per-Team Roles 實施報告
- `BACKEND_AUTH_COMPLETE.md` - 後端認證實施報告
- `CORE_TEAM_IMPLEMENTATION.md` - Core Team 實施報告

**特點**：
- 標題包含「完成報告」、「實施報告」
- 記錄「做了什麼」而非「如何使用」
- 有歷史參考價值

---

#### Archive/Progress-Reports/ - 進度報告

**放什麼**：
- ✅ 階段性進度總結
- ✅ 版本完成報告
- ✅ 功能完成度統計

**範例**：
- `IMPLEMENTATION_COMPLETE_V2.7.md` - v2.7 實施完成
- `IMPLEMENTATION_SUMMARY_V2.1_GLOBAL_ROLE.md` - v2.1 總結（舊架構）

**特點**：
- 標題包含版本號
- 記錄特定時間點的狀態
- 對比「之前 vs 之後」

---

#### Archive/Design/ - 早期設計文檔

**放什麼**：
- ✅ 早期需求分析
- ✅ 技術方案對比
- ✅ 設計草稿

**範例**：
- `INITIAL_DESIGN_V1.0_DRAFT.md` - 早期設計草稿（2193 行）
- `PRD_V1.0_INITIAL.md` - 早期產品需求（如果移動的話）

**特點**：
- 標記「v1.0」、「Draft」、「Initial」
- 內容可能與當前系統不一致
- 記錄技術選型的理由

---

#### Archive/Test-Reports/ - 測試報告

**放什麼**：
- ✅ 端到端測試報告
- ✅ 功能測試結果
- ✅ 性能測試記錄

**範例**：
- `END_TO_END_TEST_REPORT.md` - 端到端測試
- `NEW_FEATURES_TEST.md` - 新功能測試

**特點**：
- 記錄測試結果（通過/失敗）
- 包含測試數據和截圖
- 是歷史記錄，不是測試指南

---

#### Archive/Deployment-Configs/ - 部署記錄

**放什麼**：
- ✅ 首次部署完整記錄
- ✅ 部署過程遇到的問題
- ✅ 域名配置歷史

**範例**：
- `READY_FOR_DEPLOYMENT.md` - 首次部署完整記錄（包含所有問題）

**特點**：
- 記錄「部署過程」而非「部署指南」
- 包含錯誤和解決方案（已提取到 CRITICAL_ERRORS）

---

#### Archive/Analysis/ - 分析報告

**放什麼**：
- ✅ 技術決策分析
- ✅ 架構重構分析
- ✅ UX 改進報告

**範例**：
- `ROUTING_COMPARISON.md` - 路由重構場景對比
- `UX_IMPROVEMENTS_COMPLETE.md` - UX 改進完成

**特點**：
- 分析「為什麼要改」
- 對比「改之前 vs 改之後」

---

### 根目錄 - 核心導航文檔

**放什麼**：
- ✅ README.md - 專案主要說明
- ✅ QUICK_START.md - 快速啟動
- ✅ QUICK_REFERENCE.md - 常用命令參考
- ✅ DEPLOYMENT_CHECKLIST.md - 部署檢查清單

**不放什麼**：
- ❌ 詳細的功能文檔（放 docs/）
- ❌ 進度報告（放 archive/）
- ❌ 實施報告（放 archive/）

**限制**：
- 最多 5-6 個文檔
- 都是「快速導航」性質
- 簡潔明瞭

---

## 📋 文檔創建流程

### 情境 #1：實施新功能

**步驟**：
1. 實施功能（寫代碼）
2. 測試功能
3. 完成後創建實施報告 → `archive/implementation-docs/FEATURE_NAME_COMPLETE.md`
4. 如果功能需要使用說明 → `docs/FEATURE_NAME_GUIDE.md`

**範例**：
- Token 複製功能實施 → `archive/implementation-docs/TOKEN_COPY_FEATURE_COMPLETE.md`
- 使用追蹤功能說明 → `docs/TOKEN_USAGE_TRACKING.md`

---

### 情境 #2：遇到技術問題並解決

**步驟**：
1. 解決問題
2. 如果問題是系統性的、容易踩坑的 → 記錄到 `docs/CRITICAL_ERRORS_LEARNED.md`
3. 如果需要深度技術說明 → 創建 `docs/solutions/PROBLEM_SOLUTION.md`

**範例**：
- 瀏覽器剪貼簿 API 限制：
  - 精簡記錄 → CRITICAL_ERRORS.md（錯誤 #5）
  - 完整說明 → docs/solutions/CLIPBOARD_API_SOLUTION.md

---

### 情境 #3：架構重構

**步驟**：
1. 分析為什麼要改 → `archive/analysis/REFACTOR_ANALYSIS.md`
2. 實施重構
3. 記錄重構完成 → `archive/implementation-docs/REFACTOR_COMPLETE.md`
4. 更新相關的功能文檔 → `docs/PERMISSION_RULES.md` 等

**範例**：
- Per-Team Roles 重構：
  - 分析 → archive/implementation-docs/PER_TEAM_ROLES_ANALYSIS.md
  - 完成 → archive/implementation-docs/PER_TEAM_ROLES_COMPLETE.md
  - 更新 → docs/PERMISSION_RULES.md

---

### 情境 #4：發布新版本

**步驟**：
1. 完成所有功能
2. 創建版本總結 → `archive/progress-reports/IMPLEMENTATION_COMPLETE_V2.X.md`
3. 更新 README.md 的版本號
4. 更新 DEPLOYMENT_CHECKLIST.md

**不要**：
- ❌ 在根目錄創建進度報告
- ❌ 創建多個重複的完成報告

---

## 🔍 查詢文檔指南

### 我想知道...

| 問題 | 查詢位置 |
|------|---------|
| 如何快速啟動系統？ | `QUICK_START.md` |
| 如何部署到生產？ | `DEPLOYMENT_CHECKLIST.md` → `docs/DEPLOYMENT.md` |
| 權限系統如何運作？ | `docs/PERMISSION_RULES.md` |
| 如何設定後端認證？ | `docs/ROUTE_BACKEND_AUTH.md` |
| 如何測試路由？ | `docs/ROUTE_TESTING_GUIDE.md` |
| Token 如何與團隊綁定？ | `docs/TOKEN_TEAM_INTEGRATION.md` |
| 遇到某個錯誤怎麼辦？ | `docs/CRITICAL_ERRORS_LEARNED.md` |
| 資料庫遷移如何運作？ | `docs/solutions/DATABASE_MIGRATION_EXPLAINED.md` |
| 為什麼選擇這個技術棧？ | `docs/PRD.md` |
| 某功能是怎麼實施的？ | `archive/implementation-docs/` |
| 過去的進度記錄？ | `archive/progress-reports/` |

---

## ⚠️ 文檔維護規則

### 禁止行為

❌ **不要創建重複文檔**
- 同一主題只能有一個當前文檔
- 舊版本移至 archive/

❌ **不要在根目錄堆積文檔**
- 根目錄最多 5-6 個導航文檔
- 詳細文檔放 docs/

❌ **不要修改 archive/ 的內容**
- Archive 是歷史快照
- 不要「更新」archive 文檔

❌ **不要在多處重複相同資訊**
- 集中在一個文檔
- 其他地方用連結引用

---

### 必須行為

✅ **更新功能文檔**
- 功能改變時，更新對應的 docs/ 文檔
- 標記更新日期

✅ **記錄關鍵錯誤**
- 系統性錯誤 → CRITICAL_ERRORS_LEARNED.md
- 包含：問題、原因、解決方案、預防措施

✅ **完成報告放 archive/**
- 功能實施完成 → archive/implementation-docs/
- 不要放在 docs/ 或根目錄

✅ **保持文檔精簡**
- 只記錄重點
- 冗長的技術細節放 solutions/
- 歷史過程放 archive/

---

## 📊 CRITICAL_ERRORS_LEARNED.md 記錄標準

### 什麼錯誤需要記錄？

✅ **必須記錄**：
1. **系統性錯誤**（不是一次性 bug）
   - PostgreSQL JSONB 處理
   - Clerk API 格式判斷
   - 環境變數配置

2. **隱蔽且難發現**（花費大量時間）
   - 前端 API 硬編碼（3 天 3 夜）
   - Clerk authorized_parties（本地正常生產失敗）

3. **容易重複踩坑**
   - 瀏覽器剪貼簿 API 限制
   - Wrangler 命令格式變更

4. **安全相關**
   - API Key 明文儲存
   - KV Secret 孤兒問題

### 什麼錯誤不需要記錄？

❌ **不記錄**：
- 一次性的 typo 或小 bug
- UI 樣式調整
- 簡單的邏輯錯誤
- 已有明確錯誤提示的問題

### 記錄格式

```markdown
## ❌ 錯誤 #X: 簡短描述（日期）

### 嚴重程度
🔴/🟡/🟢 + 影響說明

### 問題描述
一句話說明問題

### 錯誤代碼
❌ 錯誤的做法（精簡）

### 根本原因
為什麼會發生

### 正確做法
✅ 正確的做法（精簡）

### 關鍵點
1-4 個要點

### 影響範圍
具體影響

### 預防措施（可選）
如何避免

### 相關文檔
連結到完整說明
```

**篇幅控制**：
- 總長度：30-50 行
- 代碼範例：精簡到關鍵部分
- 詳細內容：連結到 solutions/ 文檔

---

## 🔄 文檔生命週期

### 創建階段

```
新功能開發
  ↓
實施完成
  ↓
創建實施報告 → archive/implementation-docs/
  ↓
如果需要使用說明
  ↓
創建功能文檔 → docs/
```

### 更新階段

```
功能修改
  ↓
更新對應的 docs/ 文檔
  ↓
標記更新日期
  ↓
（舊版本不保留，Git 歷史即可）
```

### 過時階段

```
功能被新架構取代
  ↓
在文檔頂部添加過時警告
  ↓
或移至 archive/
  ↓
創建新文檔取代
```

---

## 📝 文檔撰寫規範

### 標題格式

```markdown
# 文檔標題

**版本**: v3.0  
**狀態**: 當前有效 / 已實施 / 歷史記錄  
**更新日期**: 2025-11-08
```

### 過時標記

如果文檔部分過時：
```markdown
> ⚠️ **注意**: 本文檔使用 `department` 概念，當前系統已改為 `team_id`。
```

如果文檔完全過時：
```markdown
# ⚠️ 此文檔已過時

> **警告**: 此文檔基於舊架構，請參考 [新文檔](./NEW_DOC.md)
```

### 內部連結

```markdown
# 相對路徑（推薦）
[部署指南](./DEPLOYMENT.md)
[錯誤記錄](../docs/CRITICAL_ERRORS_LEARNED.md)

# 絕對路徑（避免）
❌ /Users/JL/Development/.../docs/xxx.md
```

---

## 🎯 最佳實踐

### Do's ✅

1. **一個主題一個文檔**
   - 權限系統 → PERMISSION_RULES.md
   - 後端認證 → ROUTE_BACKEND_AUTH.md

2. **精簡但完整**
   - 記錄重點和關鍵資訊
   - 詳細內容放 solutions/ 或連結

3. **及時更新**
   - 功能改變 → 立即更新文檔
   - 標記更新日期

4. **提取錯誤**
   - 重要錯誤 → CRITICAL_ERRORS.md
   - 完整說明 → solutions/

5. **保持結構清晰**
   - docs/ 不超過 15 個文檔
   - 根目錄不超過 6 個文檔
   - Archive 按類型分類

### Don'ts ❌

1. **不要重複記錄**
   - 同一內容出現在多個文檔
   - 用連結代替複製貼上

2. **不要混淆性質**
   - 實施報告不要放 docs/
   - 功能說明不要放 archive/

3. **不要過度分類**
   - 避免建立過多子目錄
   - 目前的三層結構已足夠

4. **不要保留臨時文檔**
   - 測試提示文檔（刪除）
   - 待辦清單（已完成的刪除）

---

## 📊 文檔審查檢查清單

### 每季度審查（建議）

- [ ] 檢查 docs/ 是否有過時內容
- [ ] 檢查是否有重複文檔
- [ ] 檢查 archive/ 是否有應該移到 docs/ 的
- [ ] 檢查根目錄是否堆積過多文檔
- [ ] 更新 CRITICAL_ERRORS.md（如有新錯誤）
- [ ] 移除臨時測試文檔
- [ ] 合併重複的進度報告

### 文檔品質檢查

- [ ] 標題清晰
- [ ] 有版本和日期標記
- [ ] 過時內容已標記
- [ ] 內部連結有效
- [ ] 代碼範例可執行
- [ ] 篇幅適中（不過長）

---

## 🎓 範例：完整的功能文檔化流程

### 情境：實施「Token 加密儲存」功能

**步驟 1**：開發功能
- 修改 database.py
- 添加 token_encrypted 欄位
- 實施 encrypt_token() 和 decrypt_token()

**步驟 2**：創建實施報告
- 創建 `archive/implementation-docs/TOKEN_COPY_FEATURE_COMPLETE.md`
- 記錄：做了什麼、如何實施、測試結果

**步驟 3**：創建技術說明（如果需要）
- 創建 `docs/solutions/TOKEN_LIFECYCLE_EXPLAINED.md`
- 深入解釋：為什麼用 Fernet、如何加密、安全性分析

**步驟 4**：記錄相關錯誤（如果有）
- 瀏覽器剪貼簿限制 → CRITICAL_ERRORS.md

**步驟 5**：更新相關文檔
- 更新 `docs/TOKEN_TEAM_INTEGRATION.md`（如果相關）
- 更新 README.md（如果是重要功能）

---

## 📚 特殊文檔說明

### CRITICAL_ERRORS_LEARNED.md

**唯一性**：整個專案只有這一個
**內容**：所有系統性錯誤的精簡記錄
**更新頻率**：遇到重要錯誤即更新
**不刪除**：永久保留，持續累積

### _OUTDATED_NOTICE.md

**作用**：標記哪些文檔已過時
**位置**：docs/
**內容**：列出已刪除的文檔和原因

### README.md

**分級**：
- 根目錄 README.md - 專案總體說明
- backend/README.md - 後端啟動說明
- frontend/README.md - 前端啟動說明
- archive/*/README.md - 該目錄說明

---

## 🎯 總結

**核心原則**：
1. **Docs/ = 當前系統的參考文檔**（開發者查閱）
2. **Archive/ = 歷史過程記錄**（了解演進）
3. **根目錄 = 快速導航**（新手入口）

**維護目標**：
- 找文檔快速（清晰分類）
- 資訊不重複（一個主題一個位置）
- 保留歷史（archive 完整記錄）
- 易於維護（規則明確）

---

**文件版本**: 1.0  
**建立日期**: 2025-11-08  
**維護者**: 開發團隊

