# Dashboard 最近活動表格化重設計

> ⚠️ **極度重要：JSONB 欄位處理錯誤教訓**  
> 在處理 PostgreSQL 的 JSONB 欄位時，**絕對不能直接修改從資料庫查詢返回的 dict 物件**。
> 必須先轉換成新的 Python dict，否則會導致嚴重的運行時錯誤，造成整個 Dashboard API 崩潰。
> 
> **錯誤做法：**
> ```python
> log_dict = dict(log)  # log['details'] 仍是 JSONB 物件
> details = log_dict.get('details')  # JSONB 物件
> details['name'] = 'xxx'  # ❌ 錯誤！會導致崩潰
> log_dict['details'] = details
> ```
> 
> **正確做法：**
> ```python
> details = dict(log['details']) if isinstance(log['details'], dict) else json.loads(log['details'])
> details['name'] = 'xxx'  # ✅ 正確！這是新的 dict
> log_dict['details'] = details
> ```

## 改進概述

根據用戶反饋，將 Dashboard 的「最近活動」從卡片式列表重新設計為表格式佈局，參考「詳細調用記錄」的設計風格。

## 設計目標

1. **清晰的資訊層次** - 使用表格結構清楚呈現各項資訊
2. **快速掃描** - 表格行列對齊，易於快速瀏覽
3. **完整資訊** - 在有限空間內顯示所有關鍵資訊
4. **一致性** - 與系統其他表格（API 使用分析）保持一致的視覺風格

## 視覺對比

### 改進前（卡片式）
```
┌────────────────────────────────────────────┐
│ 🛣️ [創建] 路由「User Service」              │
│    路徑: /api/v1/users                     │
│    操作者: admin@company.com  11/06 16:17  │
└────────────────────────────────────────────┘
```

**問題：**
- 垂直空間占用大
- 資訊密度低
- 難以快速比較多筆記錄

### 改進後（表格式）
```
┌──────────────────────────────────────────────────────────────────────────┐
│ 時間              │ 類型   │ 操作 │ 資源名稱      │ 相關資訊           │ 操作者              │
├──────────────────────────────────────────────────────────────────────────┤
│ 2025/11/06 16:17  │ 🛣️ 路由 │ 創建 │ User Service │ 路徑: /api/v1/users│ admin@company.com  │
│ 2025/11/06 11:51  │ 🔑 Token│ 創建 │ Production   │ 團隊: Engineering  │ engineer@co.com    │
│ 2025/11/06 09:46  │ 🛣️ 路由 │ 更新 │ Payment API  │ 路徑: /api/payment │ admin@company.com  │
└──────────────────────────────────────────────────────────────────────────┘
```

**優勢：**
- ✅ 資訊密度高，一屏顯示更多記錄
- ✅ 列對齊，易於掃描和比較
- ✅ 結構清晰，快速定位所需資訊
- ✅ 與系統其他表格風格一致

## 實作細節

### 表格結構

```jsx
<table className="activity-table">
  <thead>
    <tr>
      <th>時間</th>
      <th>類型</th>
      <th>操作</th>
      <th>資源名稱</th>
      <th>相關資訊</th>
      <th>操作者</th>
    </tr>
  </thead>
  <tbody>
    {recent_logs.map((log, index) => (
      <ActivityRow key={index} log={log} />
    ))}
  </tbody>
</table>
```

### 欄位設計

| 欄位 | 寬度 | 內容 | 說明 |
|------|------|------|------|
| **時間** | 固定 | `2025/11/06 16:17:23` | 完整時間戳，使用等寬字體 |
| **類型** | 小 | `🔑 Token` / `🛣️ 路由` | 資源類型 Badge，帶圖標 |
| **操作** | 小 | `創建` / `更新` / `刪除` | 操作類型 Badge，顏色編碼 |
| **資源名稱** | 中 | `Production API Key` | 被操作的資源名稱，粗體 |
| **相關資訊** | 彈性 | `團隊: Engineering \| 範圍: api:read` | 上下文資訊，多項用 `\|` 分隔 |
| **操作者** | 中 | `user@example.com` | 操作者 Email，突出顯示 |

### Badge 設計

#### 資源類型 Badge（Entity Badge）

```jsx
<span className="entity-badge entity-token">
  <span className="entity-icon">🔑</span>
  Token
</span>
```

**樣式：**
- Token: 藍色背景 `rgba(59, 130, 246, 0.1)`
- 路由: 綠色背景 `rgba(16, 185, 129, 0.1)`
- 團隊: 紫色背景 `rgba(139, 92, 246, 0.1)`
- 用戶: 橙色背景 `rgba(245, 158, 11, 0.1)`

#### 操作類型 Badge（Action Badge）

```jsx
<span className="action-badge action-create">創建</span>
```

**樣式：**
- 創建: 綠色 `rgba(16, 185, 129, 0.15)`
- 更新: 藍色 `rgba(59, 130, 246, 0.15)`
- 刪除: 紅色 `rgba(239, 68, 68, 0.15)`

### 相關資訊組合邏輯

```javascript
const getRelatedInfo = () => {
  const info = [];
  if (teamName) info.push(`團隊: ${teamName}`);
  if (path) info.push(`路徑: ${path}`);
  if (scopes && scopes.length > 0) info.push(`範圍: ${scopes.join(', ')}`);
  return info.length > 0 ? info.join(' | ') : '-';
};
```

**顯示規則：**
- Token: 顯示「團隊」和「範圍」
- 路由: 顯示「路徑」
- 多項資訊用 `|` 分隔
- 無資訊時顯示 `-`

## CSS 關鍵樣式

### 表格基礎

```css
.activity-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-primary);
}

.activity-table thead {
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
}

.activity-table tbody tr:hover {
  background: var(--bg-secondary);
}
```

### 文字樣式

```css
.activity-time {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.activity-name {
  font-weight: 600;
  color: var(--text-primary);
}

.activity-operator {
  color: var(--accent-primary);
  font-weight: 500;
}
```

### 響應式處理

```css
.activity-table-wrapper {
  overflow-x: auto;  /* 小螢幕時可橫向滾動 */
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.activity-info {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

## 資料流

```
Backend (audit_logs)
       │
       ▼
GET /api/dashboard/overview
       │
       ▼
recent_logs: [
  {
    action: 'create',
    entity_type: 'token',
    entity_id: 123,
    details: {
      name: 'Production Key',
      team_name: 'Engineering',
      scopes: ['api:read', 'api:write'],
      created_by_email: 'user@example.com'
    },
    created_at: '2025-11-06T16:17:23Z'
  }
]
       │
       ▼
ActivityRow Component
       │
       ├─► 解析 details
       ├─► 生成 Badge
       ├─► 組合相關資訊
       ▼
Table Row Render
```

## 交互設計

### 懸停效果
- 滑鼠懸停時，整行背景色變化
- 過渡動畫 `transition: background-color 0.15s`

### 視覺層次
1. **主要資訊**（粗體）: 資源名稱
2. **次要資訊**（正常）: 時間、操作、類型
3. **輔助資訊**（淡色）: 相關資訊的細節
4. **強調資訊**（主題色）: 操作者

## 對比參考：API 使用分析表格

### 相似點
- 表格結構和樣式
- Badge 設計語言
- 懸停效果
- 等寬字體用於時間和代碼

### 差異點
| 特徵 | API 使用分析 | Dashboard 活動 |
|------|-------------|---------------|
| **用途** | 技術調用記錄 | 業務操作記錄 |
| **關鍵欄位** | Token Hash, 響應時間, IP | 操作者, 資源名稱 |
| **時間格式** | `MM/dd HH:mm:ss` | `yyyy/MM/dd HH:mm:ss` |
| **Badge 類型** | HTTP 方法, 狀態碼 | 資源類型, 操作類型 |
| **資訊密度** | 技術細節較多 | 業務上下文較多 |

## 優勢分析

### 1. 資訊密度提升
- **前**: 每條記錄約 80px 高度
- **後**: 每條記錄約 40px 高度
- **結果**: 同一屏幕可顯示 2 倍的記錄數

### 2. 掃描效率提升
- 列對齊使眼睛可以快速垂直掃描
- 不同欄位的資訊不會混淆
- 快速定位特定類型的操作

### 3. 比較便利性
- 多條記錄的時間、操作者、資源類型可直接對比
- 識別模式和異常更容易

### 4. 專業感
- 表格是企業級系統的標準展示方式
- 與系統其他部分保持一致
- 符合用戶對管理後台的期待

## 可能的未來改進

### 短期
1. **排序功能** - 點擊表頭排序（時間、類型、操作）
2. **篩選功能** - 快速篩選特定類型或操作
3. **展開詳情** - 點擊行展開完整的 JSON details

### 中期
4. **固定表頭** - 滾動時表頭保持可見
5. **列寬調整** - 拖動調整列寬
6. **欄位自定義** - 用戶選擇顯示哪些欄位

### 長期
7. **虛擬滾動** - 支持大量記錄（1000+）
8. **批量操作** - 選擇多條記錄進行操作
9. **導出選擇** - 導出選中的記錄

## 測試檢查清單

### 視覺測試
- [ ] 表格在不同螢幕寬度下正常顯示
- [ ] Badge 顏色正確且易於區分
- [ ] 文字對齊正確（左對齊）
- [ ] 懸停效果流暢

### 功能測試
- [ ] 顯示正確的 10 筆最近記錄
- [ ] 資源類型圖標正確
- [ ] 操作類型 Badge 顏色正確（綠/藍/紅）
- [ ] 相關資訊正確組合（團隊/路徑/範圍）
- [ ] 操作者 Email 正確顯示
- [ ] 時間格式正確且易讀

### 資料測試
- [ ] Token 創建記錄顯示團隊和範圍
- [ ] Route 創建記錄顯示路徑
- [ ] 更新操作顯示 updated_by_email
- [ ] 刪除操作顯示 deleted_by_email
- [ ] 空資料時顯示 `-`

### 邊界情況
- [ ] 資源名稱過長時截斷顯示
- [ ] 相關資訊過長時截斷顯示
- [ ] 沒有操作者時顯示「系統」
- [ ] 記錄數為 0 時的處理

## 修改的檔案

1. **frontend/src/components/Dashboard/Dashboard.jsx**
   - 移除 `ActivityItem` 組件
   - 新增 `ActivityRow` 組件
   - 改用 `<table>` 結構
   - 新增 Entity Badge 和 Action Badge 邏輯

2. **frontend/src/components/Dashboard/Dashboard.css**
   - 移除卡片式樣式
   - 新增表格樣式
   - 新增 Badge 樣式
   - 優化響應式佈局

## 文檔更新

- [x] 創建本設計文檔
- [x] 更新活動日誌改進文檔
- [x] 更新測試報告

## 發布日期

2025-11-07

## 貢獻者

- AI Assistant (Claude Sonnet 4.5) - 設計與實作
- 用戶 (JL) - 需求提出與設計方向指導

