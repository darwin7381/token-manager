# 🎉 新功能測試指南

> **更新時間**: 2025-10-30  
> **版本**: v1.1 (改進版)

---

## ✨ 新增功能

### 1. ✅ 路由編輯功能
- 可以編輯後端 URL
- 可以編輯描述
- 可以編輯標籤
- 路徑不可修改 (確保路由一致性)

### 2. ✅ Tags/分類系統
- 每個路由可以設置多個標籤
- 標籤用於權限分組
- 支持動態添加/刪除標籤

### 3. ✅ 改進的 Scopes 選擇器
- 視覺化選擇界面
- 支持三種權限模式:
  - **全部權限** (`*`)
  - **具體路徑** (`image`, `data`)
  - **標籤權限** (`tag:media`, `tag:premium`)

---

## 🧪 測試步驟

### 測試 1: 創建帶標籤的路由

1. 訪問 http://localhost:3001
2. 切換到 "路由管理" 頁面
3. 填寫表單:
   - 路徑: `/api/analytics`
   - 後端 URL: `https://analytics.example.com`
   - 描述: `數據分析服務`
   - 標籤: 輸入 `data` 按 Enter，再輸入 `analytics` 按 Enter，再輸入 `internal` 按 Enter
4. 點擊 "新增路由"
5. 確認路由列表中顯示三個標籤

✅ **預期結果**: 
- 路由成功創建
- 標籤正確顯示為三個橙色 badge
- 列表自動刷新

---

### 測試 2: 編輯現有路由

1. 在路由列表中找到剛才創建的路由
2. 點擊 "編輯" 按鈕
3. 彈出編輯對話框
4. 修改:
   - 後端 URL: `https://new-analytics.example.com`
   - 添加標籤: `premium`
   - 刪除標籤: 點擊 `internal` 旁的 ×
5. 點擊 "保存"

✅ **預期結果**:
- 對話框關閉
- 列表自動刷新
- URL 已更新
- 標籤變為: data, analytics, premium (沒有 internal)

---

### 測試 3: 使用 Scope 選擇器創建 Token

1. 切換到 "Token 管理" 頁面
2. 填寫:
   - 名稱: `Analytics-Worker`
   - 部門: `data-team`
3. 點擊 "選擇路由/標籤" 按鈕
4. 在彈出的對話框中:
   - 點擊路徑 `analytics` (如果有)
   - 點擊標籤 `🏷️ data`
   - 點擊標籤 `🏷️ premium`
5. 點擊 "確定"
6. 確認權限範圍顯示: `analytics`, `tag:data`, `tag:premium`
7. 點擊 "創建 Token"

✅ **預期結果**:
- Token 成功創建
- 權限範圍顯示三個 badge (不同顏色)
- Token 列表中正確顯示 scopes

---

### 測試 4: 驗證 Tags 權限邏輯

現在我們有:
- 路由 `/api/analytics` 標籤: `[data, analytics, premium]`
- Token scopes: `[tag:data, tag:premium]`

這個 Token 應該能訪問所有包含 `data` 或 `premium` 標籤的路由。

**API 測試** (稍後實現):
```bash
curl https://api-gateway.cryptoxlab.workers.dev/api/analytics \
  -H "X-API-Key: ntk_你的token"
```

✅ **預期結果**: 成功訪問 (因為有 tag:data 權限)

---

### 測試 5: 查看所有可用標籤

1. 切換到 "路由管理"
2. 創建幾個不同的路由，使用不同的標籤:
   - `/api/image` → tags: `[image, media, public]`
   - `/api/video` → tags: `[video, media, premium]`
   - `/api/data` → tags: `[data, internal]`
3. 點擊 "Token 管理" → "選擇路由/標籤"
4. 檢查 "標籤權限" 區域

✅ **預期結果**: 
- 顯示所有唯一的標籤
- 可以點擊選擇
- 選中的標籤變為綠色背景

---

## 🎨 UI 改進說明

### Token 創建表單
- ✅ 兩個按鈕: "全部權限" 和 "選擇路由/標籤"
- ✅ 視覺化顯示已選擇的 scopes
- ✅ 不同類型的 scope 使用不同顏色:
  - 綠色: `*` (全部權限)
  - 藍色: 具體路徑
  - 橙色: 標籤權限

### 路由管理表單
- ✅ 標籤輸入框 + "添加" 按鈕
- ✅ 支持 Enter 鍵快速添加
- ✅ 標籤顯示區域，點擊 × 刪除

### 路由列表
- ✅ 新增 "標籤" 欄位
- ✅ 新增 "編輯" 按鈕
- ✅ 標籤以橙色 badge 顯示

### 編輯對話框
- ✅ 路徑欄位禁用 (不可修改)
- ✅ 可以修改 URL、描述和標籤
- ✅ 保存和取消按鈕

---

## 🔧 後端 API 測試

### 測試路由編輯 API

```bash
# 只更新 URL
curl -X PUT http://localhost:8000/api/routes/1 \
  -H "Content-Type: application/json" \
  -d '{"backend_url": "https://new-backend.com"}'

# 只更新標籤
curl -X PUT http://localhost:8000/api/routes/1 \
  -H "Content-Type: application/json" \
  -d '{"tags": ["new-tag1", "new-tag2"]}'

# 同時更新多個字段
curl -X PUT http://localhost:8000/api/routes/1 \
  -H "Content-Type: application/json" \
  -d '{
    "backend_url": "https://updated.com",
    "description": "Updated description",
    "tags": ["tag1", "tag2", "tag3"]
  }'
```

### 測試 Tags API

```bash
# 獲取所有可用的 tags
curl http://localhost:8000/api/routes/tags

# 應返回:
# {"tags": ["analytics", "data", "image", "media", "premium", "video", ...]}
```

---

## 📋 功能檢查清單

請在前端逐一測試:

- [ ] 可以創建 Token (手動輸入 scopes)
- [ ] 可以點擊 "全部權限" 按鈕
- [ ] 可以點擊 "選擇路由/標籤" 打開對話框
- [ ] Scope 選擇器顯示所有路由
- [ ] Scope 選擇器顯示所有標籤
- [ ] 可以點擊選擇/取消選擇 scope
- [ ] 確定後正確更新 scopes 顯示
- [ ] Token 列表正確顯示不同類型的 scopes (不同顏色)
- [ ] 可以創建路由並添加標籤
- [ ] 標籤可以通過 Enter 鍵添加
- [ ] 標籤可以通過點擊 × 刪除
- [ ] 路由列表顯示標籤欄位
- [ ] 可以點擊 "編輯" 按鈕
- [ ] 編輯對話框正確顯示現有數據
- [ ] 可以在編輯對話框中修改 URL
- [ ] 可以在編輯對話框中修改標籤
- [ ] 保存後列表正確更新
- [ ] 刪除路由功能正常
- [ ] 統計頁面正常顯示

---

## 🎯 下一步: Worker 支持 Tag Scopes

目前 Worker 還不支持 `tag:xxx` 格式的權限檢查。

需要更新 Worker 代碼以支持標籤權限。

是否需要我更新 Worker 代碼？

---

**🎊 前端已完全更新！現在可以測試所有新功能了！** 

訪問 http://localhost:3001 開始測試！ 🚀

