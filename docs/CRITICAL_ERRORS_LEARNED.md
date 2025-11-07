# 🚨 嚴重錯誤記錄與教訓

> **目的**: 記錄開發過程中遇到的嚴重錯誤，避免重蹈覆轍

---

## ❌ 錯誤 #1: PostgreSQL JSONB 欄位處理錯誤（2025-11-07）

### 嚴重程度
🔴 **極度嚴重** - 導致整個 Dashboard API 崩潰，用戶完全無法訪問

### 問題描述

在修改 Dashboard 活動日誌顯示時，嘗試修改從資料庫查詢返回的 JSONB 欄位，導致運行時錯誤。

### 錯誤代碼

```python
# backend/main.py - get_dashboard_overview()

# ❌ 錯誤的做法
for log in recent_logs_raw:
    log_dict = dict(log)  # 淺複製
    details = log_dict.get('details') or {}  # details 仍然是 asyncpg 的 JSONB 物件
    
    # 嘗試修改 JSONB 物件
    if not details.get('name'):
        details['name'] = log_dict['token_name']  # ❌ 崩潰！
    
    log_dict['details'] = details  # ❌ 傳遞了被修改的 JSONB 物件
    recent_logs.append(log_dict)
```

### 錯誤現象

```
瀏覽器 Console:
  ❌ Failed to fetch
  ❌ TypeError: Failed to fetch
  
前端顯示:
  ❌ 載入失敗
  ❌ Failed to load dashboard data

後端日誌:
  可能無明確錯誤（取決於 asyncpg 版本）
  但 API 返回異常或超時
```

### 根本原因

**asyncpg 從 PostgreSQL 查詢 JSONB 欄位時，返回的是特殊的物件，不是純 Python dict。**

- 可以讀取：`details.get('name')` ✅
- 不能修改：`details['name'] = 'xxx'` ❌
- 不能直接序列化為 JSON ❌

### 正確做法

```python
# ✅ 正確的做法
import json

for log in recent_logs_raw:
    # 1. 手動構建新的 dict（不要用 dict(log)）
    log_dict = {
        'action': log['action'],
        'entity_type': log['entity_type'],
        'entity_id': log['entity_id'],
        'created_at': log['created_at']
    }
    
    # 2. 將 JSONB 轉換為真正的 Python dict
    if log['details']:
        details = dict(log['details']) if isinstance(log['details'], dict) else json.loads(log['details'])
    else:
        details = {}
    
    # 3. 現在可以安全地修改
    if not details.get('name'):
        details['name'] = log['token_name']  # ✅ 正確！
    
    # 4. 賦值回去
    log_dict['details'] = details  # ✅ 這是純 Python dict
    recent_logs.append(log_dict)
```

### 關鍵點

1. **永遠不要直接修改 asyncpg 返回的 JSONB 物件**
2. **先轉換成 Python dict**：`dict(jsonb_value)` 或 `json.loads()`
3. **檢查類型**：`isinstance(log['details'], dict)`
4. **手動構建返回物件**：不要用 `dict(row)`，會保留 JSONB 引用

### 影響範圍

這個錯誤影響了：
- ❌ Dashboard 完全無法載入
- ❌ 所有依賴 Dashboard API 的功能
- ❌ 用戶體驗嚴重受損
- ❌ 生產環境部署後立即崩潰

### 檢測方法

```python
# 測試 API 是否正常
curl https://tapi.blocktempo.ai/api/dashboard/overview \
  -H "Authorization: Bearer $CLERK_TOKEN"

# 應返回完整的 JSON，不應該超時或錯誤
```

### 預防措施

1. **代碼審查檢查清單**：
   - [ ] 是否有修改 JSONB 欄位？
   - [ ] 是否先轉換成 Python dict？
   - [ ] 是否手動構建返回物件？

2. **本地測試**：
   - 修改涉及 JSONB 的代碼後，立即測試 API
   - 使用真實資料庫數據測試
   - 檢查返回的 JSON 是否正確

3. **部署前驗證**：
   - 本地測試通過後才部署
   - 部署後立即測試健康檢查
   - 監控錯誤日誌

### 修復時間軸

| 時間 | 事件 |
|------|------|
| 16:00 | 修改後端，添加 LEFT JOIN 邏輯 |
| 16:05 | 提交並推送到生產 |
| 16:10 | 用戶報告 Dashboard 崩潰 |
| 16:15 | 發現 JSONB 處理錯誤 |
| 16:20 | 修復並重新部署 |
| 16:25 | 驗證修復成功 |

**總耗時**: 25 分鐘的服務中斷

### 相關文檔

- [Dashboard 表格重設計](./DASHBOARD_ACTIVITY_TABLE_REDESIGN.md)
- [PostgreSQL JSONB 官方文檔](https://www.postgresql.org/docs/current/datatype-json.html)
- [asyncpg JSONB 處理](https://magicstack.github.io/asyncpg/current/usage.html#type-conversion)

---

## 📋 其他嚴重錯誤（待記錄）

（未來如有其他嚴重錯誤，記錄在此）

---

**文件建立日期**: 2025-11-07  
**最後更新**: 2025-11-07  
**維護者**: 開發團隊

