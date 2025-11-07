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

---

## ❌ 錯誤 #2: Clerk API public_metadata 物件轉換錯誤（2025-11-07）

### 嚴重程度
🔴 **極度嚴重** - 導致用戶管理功能完全失效，錯誤訊息 `[object Object]`

### 問題描述

在用戶管理頁面，當嘗試編輯用戶權限或批量設置角色時，出現 `[object Object]` 錯誤，導致操作失敗。

### 錯誤代碼

```python
# backend/user_routes.py, team_routes.py

# ❌ 錯誤的做法
target_user = clerk_client.users.get(user_id=user_id)
target_metadata = dict(target_user.public_metadata or {})  # ❌ Clerk 物件可能無法直接 dict()
team_roles = target_metadata.get(f"{NAMESPACE}:teamRoles", {})

updated_metadata[f"{NAMESPACE}:teamRoles"] = team_roles
clerk_client.users.update_metadata(
    user_id=user_id,
    public_metadata=updated_metadata  # ❌ 傳遞了未正確轉換的物件
)
```

### 錯誤現象

```
前端錯誤訊息:
  ❌ 批量設置失敗：[object Object]
  ❌ 操作失敗：[object Object]

瀏覽器 Console:
  ❌ Error: [object Object]
  ❌ Failed to bulk set role: Error: [object Object]

後端可能返回:
  422 Unprocessable Entity
  或其他 Clerk API 錯誤
```

### 根本原因

**Clerk SDK 返回的 `user.public_metadata` 可能是特殊的物件，不是純 Python dict。**

使用 `dict()` 直接轉換可能：
1. 無法正確轉換（保留了內部引用）
2. 轉換後的物件無法序列化為 JSON
3. 傳遞給 Clerk API 時被拒絕

### 正確做法

```python
# ✅ 正確的做法
import json

target_user = clerk_client.users.get(user_id=user_id)

# 安全地轉換 public_metadata
if target_user.public_metadata:
    if isinstance(target_user.public_metadata, dict):
        target_metadata = dict(target_user.public_metadata)
    else:
        # 通過 JSON 序列化/反序列化確保是純 dict
        target_metadata = json.loads(json.dumps(target_user.public_metadata))
else:
    target_metadata = {}

team_roles = target_metadata.get(f"{NAMESPACE}:teamRoles", {})
# ... 修改 team_roles ...

updated_metadata = target_metadata.copy()
updated_metadata[f"{NAMESPACE}:teamRoles"] = team_roles

clerk_client.users.update_metadata(
    user_id=user_id,
    public_metadata=updated_metadata  # ✅ 純 Python dict
)
```

### 受影響的檔案

1. **backend/user_routes.py**（3 處）
   - `update_user_team_role()` - 更新用戶團隊角色
   - `add_user_to_team()` - 添加用戶到團隊
   - `remove_user_from_team()` - 從團隊移除用戶

2. **backend/team_routes.py**（1 處）
   - `create_team()` - 創建團隊時添加創建者為 ADMIN

### 關鍵點

1. **永遠檢查物件類型**：`isinstance(obj, dict)`
2. **使用 JSON 序列化確保純淨**：`json.loads(json.dumps(obj))`
3. **不要假設 SDK 返回的是 Python 原生類型**
4. **Clerk API 對 metadata 格式要求嚴格**

### 影響範圍

- ❌ 無法編輯用戶權限
- ❌ 無法批量設置角色
- ❌ 無法添加用戶到團隊
- ❌ 無法從團隊移除用戶
- ❌ 無法創建新團隊

### 預防措施

1. **代碼審查檢查清單**：
   - [ ] 是否使用了第三方 SDK 返回的物件？
   - [ ] 是否先驗證物件類型？
   - [ ] 是否安全地轉換為 Python 原生類型？

2. **測試要點**：
   - 測試用戶權限編輯功能
   - 測試批量操作
   - 檢查錯誤訊息是否清晰（不是 `[object Object]`）

### 修復時間軸

| 時間 | 事件 |
|------|------|
| 16:30 | 用戶報告權限編輯功能出現 `[object Object]` 錯誤 |
| 16:35 | 定位到 public_metadata 轉換問題 |
| 16:40 | 修復所有受影響的函數（4 處）|
| 16:45 | 提交並部署 |

**總耗時**: 15 分鐘的功能中斷

### 相關錯誤

這個錯誤與 **錯誤 #1（JSONB 處理）** 類似，都是：
- ✅ 從外部來源（PostgreSQL / Clerk API）獲取的物件
- ✅ 不能直接當作 Python dict 修改
- ✅ 需要安全地轉換為純 Python 類型

### 通用原則

**處理任何外部 API 或資料庫返回的物件時：**

```python
import json

# 1. 檢查類型
if isinstance(obj, dict):
    safe_dict = dict(obj)
else:
    # 2. 通過 JSON 確保純淨
    safe_dict = json.loads(json.dumps(obj))

# 3. 現在可以安全修改
safe_dict['key'] = 'value'
```

### 延伸問題：嵌套 dict 的深層複製

**即使外層已經轉換，嵌套的 dict 仍然可能是引用！**

```python
# ❌ 錯誤：淺複製
target_metadata = dict(user.public_metadata)
team_roles = target_metadata.get('teamRoles', {})  # ← 仍是引用！
team_roles['new-team'] = 'ADMIN'  # ← 修改了原始物件！

# ✅ 正確：深層複製
target_metadata = dict(user.public_metadata)
team_roles = dict(target_metadata.get('teamRoles', {}))  # ← 複製一份！
team_roles['new-team'] = 'ADMIN'  # ← 修改副本
```

**影響：**
- 批量操作時，第一次修改會污染原始物件
- 後續操作會失敗或產生 `[object Object]` 錯誤

---

## 📋 其他嚴重錯誤（待記錄）

（未來如有其他嚴重錯誤，記錄在此）

---

**文件建立日期**: 2025-11-07  
**最後更新**: 2025-11-07  
**維護者**: 開發團隊

