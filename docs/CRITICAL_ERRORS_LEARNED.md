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

## ❌ 錯誤 #3: 前端批量操作混合物件與 ID（2025-11-07）

### 嚴重程度
🔴 **極度嚴重** - 導致批量設置功能完全失效

### 問題描述

在用戶管理的批量設置功能中，混合使用了 team 物件和 team ID，導致後端收到物件而非字串，Pydantic 驗證失敗。

### 錯誤代碼

```javascript
// frontend/src/components/UserManagement/EditUserModal.jsx

// ❌ 錯誤的做法
const userTeams = Object.keys(userTeamRoles);  // ['labubu', 'core-team'] ← 字串陣列

const availableTeamsToAdd = allTeams.filter(team => {
  // allTeams 是物件陣列：[{id: 'data-team', name: 'Data Team', ...}, ...]
  return myRole === 'ADMIN' && !userTeams.includes(team.id);
});  // ← 返回的是物件陣列！

// 混合物件和字串
const allManageableTeams = [
  ...userTeams,              // ['labubu', 'core-team'] ← 字串
  ...availableTeamsToAdd     // [{id: 'data-team', ...}, ...] ← 物件！
];

// 批量設置
for (const teamId of allManageableTeams) {
  await onSave(user.id, {
    action: 'add',
    teamId,  // ← 可能是物件！
    role: bulkRole
  });
}
```

### 錯誤現象

```
前端錯誤訊息:
  ❌ 操作失敗：[{"type":"string_type","loc":["body","team_id"],"msg":"Input should be a valid string","input":{"id":"data-team","name":"Data Team",...}]

後端錯誤:
  422 Unprocessable Content
  Pydantic validation error: team_id should be string, got object

瀏覽器 Console:
  POST /api/users/{user_id}/team-membership 422
  Error: Input should be a valid string
```

### 根本原因

**JavaScript 陣列操作時，沒有統一資料類型。**

- `userTeams` 是從 `Object.keys()` 來的 → 字串陣列
- `availableTeamsToAdd` 是從 `allTeams.filter()` 來的 → 物件陣列
- 使用展開運算符混合兩者 → 陣列中同時包含字串和物件
- 傳遞物件給後端 API → Pydantic 驗證失敗

### 正確做法

```javascript
// ✅ 正確的做法
const userTeams = Object.keys(userTeamRoles);  // 字串陣列

const availableTeamsToAdd = allTeams.filter(team => {
  const myRole = myTeamRoles[team.id];
  return ['ADMIN', 'MANAGER'].includes(myRole) && !userTeams.includes(team.id);
});  // 物件陣列

// 統一轉換為 ID 字串陣列
const allManageableTeams = [...new Set([
  ...userTeams.filter(t => {
    const myRole = myTeamRoles[t];
    return myRole === 'ADMIN' || myRole === 'MANAGER';
  }),
  ...availableTeamsToAdd.map(team => team.id)  // ← 提取 ID！
])];

// 現在全部都是字串
for (const teamId of allManageableTeams) {
  await onSave(user.id, {
    action: isNewTeam ? 'add' : 'update',
    teamId,  // ← 保證是字串
    role: bulkRole
  });
}
```

### 關鍵點

1. **陣列操作時注意資料類型一致性**
2. **物件陣列要提取 ID：`.map(item => item.id)`**
3. **混合不同來源的資料時，統一格式**
4. **TypeScript 可以預防此類錯誤（建議未來遷移）**

### 影響範圍

- ❌ 批量設置功能完全失效
- ❌ 只有在批量操作時才會出現（單個操作正常）
- ❌ 用戶體驗嚴重受損
- ❌ 錯誤訊息不清楚（需要改進後端錯誤處理才能看到）

### 診斷過程

1. **初始錯誤**：`[object Object]` - 完全看不出問題
2. **改進錯誤處理後**：看到 Pydantic 驗證錯誤
3. **錯誤顯示**：`Input should be a valid string, got object`
4. **定位問題**：前端混合了物件和字串
5. **修復**：統一使用 `.map(team => team.id)`

### 預防措施

1. **代碼審查檢查清單**：
   - [ ] 陣列中的元素類型是否一致？
   - [ ] 是否有混合物件和原始類型？
   - [ ] API 調用的參數類型是否正確？

2. **測試要點**：
   - 測試批量操作（不只單個操作）
   - 檢查 Network 請求的 payload
   - 驗證傳遞的資料格式

3. **改進建議**：
   - 使用 TypeScript（會在編譯時發現類型錯誤）
   - 添加 prop-types 驗證
   - 後端返回更清晰的錯誤訊息

### 修復時間軸

| 時間 | 事件 |
|------|------|
| 17:00 | 用戶報告批量設置失敗，`[object Object]` 錯誤 |
| 17:10 | 改進前端錯誤顯示邏輯 |
| 17:15 | 改進後端錯誤提取邏輯 |
| 17:20 | 看到真實錯誤：Pydantic validation error |
| 17:25 | 發現前端混合物件和 ID |
| 17:30 | 修復：`.map(team => team.id)` |
| 17:35 | 部署並驗證修復成功 |

**總耗時**: 35 分鐘的功能中斷

### 學到的教訓

1. **JavaScript 的動態類型是雙刃劍**
   - 優點：靈活
   - 缺點：容易混合類型導致 runtime 錯誤

2. **展開運算符不會進行類型轉換**
   ```javascript
   [...strings, ...objects]  // ← 不會自動統一類型！
   ```

3. **後端 Pydantic 驗證是最後防線**
   - 前端應該傳遞正確類型
   - 但後端驗證能捕獲錯誤
   - 錯誤訊息要清晰

4. **錯誤處理的重要性**
   - 初始：`[object Object]` - 完全無用
   - 改進後：清楚的 Pydantic 錯誤 - 立即定位問題

### 相關文檔

- [用戶管理功能文檔](./PERMISSIONS_GUIDE.md)
- [Pydantic 驗證錯誤](https://docs.pydantic.dev/latest/errors/validation_errors/)

---

## ❌ 錯誤 #4: 後端 API Key 明文儲存錯誤（2025-11-08）

### 嚴重程度
🔴 **極度嚴重** - 導致 API Key 洩漏，嚴重安全漏洞

### 問題描述

在實施路由後端服務認證時，錯誤地將實際的 API Key 直接儲存在資料庫中，而不是儲存環境變數的引用名稱。

### 錯誤代碼

```python
# backend/main.py - create_route()

# ❌ 極度危險的做法
@app.post("/api/routes")
async def create_route(data: RouteCreate):
    # 用戶在 UI 填入實際的 API Key
    route = {
        "path": "/api/openai",
        "backend_url": "https://api.openai.com/v1",
        "backend_auth_type": "bearer",
        "backend_auth_config": {
            "token": "sk-proj-xxxxxxxxxxxxx"  # ❌ 明文儲存實際金鑰！
        }
    }
    
    # 儲存到資料庫
    await conn.execute("""
        INSERT INTO routes (path, backend_url, backend_auth_type, backend_auth_config)
        VALUES ($1, $2, $3, $4)
    """, route['path'], route['backend_url'], route['backend_auth_type'], route['backend_auth_config'])
```

### 錯誤現象

```
安全風險:
  ❌ 資料庫洩漏 = API Key 洩漏
  ❌ 所有有資料庫權限的人都能看到實際金鑰
  ❌ 資料庫備份也包含明文金鑰
  ❌ 日誌可能記錄了金鑰
  ❌ 前端 API 返回也會包含金鑰
  
潛在影響:
  ❌ OpenAI / AWS / 其他服務的 API Key 被盜用
  ❌ 巨額費用產生
  ❌ 數據洩漏
  ❌ 帳號被封禁
```

### 根本原因

**混淆了「環境變數名稱」與「實際的 API Key」**

用戶可能在 UI 填入：
- ❌ 錯誤：`sk-proj-xxxxxxxxxxxxx`（實際金鑰）
- ✅ 正確：`OPENAI_API_KEY`（環境變數名稱）

系統沒有驗證或提示，直接儲存到資料庫。

### 正確做法

```python
# ✅ 正確的做法 - 引用環境變數

# 1. 資料庫只儲存引用名稱
route = {
    "path": "/api/openai",
    "backend_url": "https://api.openai.com/v1",
    "backend_auth_type": "bearer",
    "backend_auth_config": {
        "token_ref": "OPENAI_API_KEY"  # ✅ 只儲存變數名稱
    }
}

# 2. 實際金鑰儲存在 Cloudflare Worker Secrets
# 使用 wrangler CLI 設定:
# wrangler secret put OPENAI_API_KEY
# 輸入: sk-proj-xxxxxxxxxxxxx

# 3. Worker 運行時從環境變數讀取
# worker.js
const actualToken = env[authConfig.token_ref];  // env.OPENAI_API_KEY
backendHeaders.set('Authorization', `Bearer ${actualToken}`);
```

### 架構設計

```yaml
分離原則:
  資料庫/KV: 儲存配置（引用名稱）
  Cloudflare Secrets: 儲存實際金鑰（加密）
  Worker: 運行時連接兩者

優點:
  ✅ 資料庫洩漏不會洩漏金鑰
  ✅ 可以獨立更換金鑰
  ✅ 權限分離（開發者看配置，DevOps 管金鑰）
  ✅ 符合業界標準（12-Factor App）
```

### 關鍵點

1. **永遠不要在資料庫儲存明文密鑰**
2. **使用環境變數引用模式**：`token_ref` 而非 `token`
3. **前端 UI 必須清楚標示**：「填入環境變數名稱，不是實際金鑰」
4. **後端驗證**：檢查是否誤填了實際金鑰（例如檢查是否以 `sk-` 開頭）

### 影響範圍

- ❌ 所有使用後端認證的路由
- ❌ OpenAI, AWS, 其他第三方服務的金鑰
- ❌ 可能已經洩漏的金鑰需要立即撤銷

---

## ❌ 錯誤 #5: 瀏覽器剪貼簿 API 異步操作限制（2025-11-08）

### 嚴重程度
🟡 **中等** - 導致複製功能失效，但有標準解決方案

### 問題描述

在異步操作後使用 `navigator.clipboard.writeText()` 會失敗，因為瀏覽器的「用戶手勢上下文」在 await 後失效。

### 錯誤代碼

```javascript
// ❌ 錯誤
onClick={async () => {
  const data = await fetch('/api/reveal');
  await navigator.clipboard.writeText(data.token);  // NotAllowedError
}}
```

### 根本原因

瀏覽器安全機制：用戶點擊 → 同步代碼 ✅ → await → **上下文失效** → clipboard API ❌

### 正確做法

```javascript
// ✅ 兩階段操作
// 第一次點擊：獲取並存 state
onClick={async () => {
  const data = await fetch('/api/reveal');
  setState(data.token);
}}

// 第二次點擊：同步複製（新的用戶手勢）
onClick={() => {
  navigator.clipboard.writeText(state.token);  // ✅ 成功
}}
```

### 關鍵點

1. 異步操作會失去用戶手勢上下文
2. 解決方案：分離「獲取」和「複製」為兩次點擊
3. 或者預先載入所有數據（降低安全性）

### 影響範圍

類似限制的 API：`window.open()`, `requestFullscreen()`, `focus()`, 檔案下載

### 相關文檔

- [完整解決方案](./CLIPBOARD_API_SOLUTION.md)

---

## ❌ 錯誤 #6: Wrangler CLI 命令格式變更（2025-11-08）

### 嚴重程度
🟡 **中等** - 導致部署命令失敗，但錯誤訊息明確

### 問題描述

Wrangler v3.x 改變了命令格式，從冒號分隔改為空格分隔，複製舊文檔的命令會失敗。

### 錯誤代碼

```bash
# ❌ 錯誤（v2.x 舊格式）
wrangler kv:namespace create "TOKENS"

# 錯誤訊息
Unknown command: kv:namespace
Did you mean kv namespace?
```

### 根本原因

Wrangler CLI 版本升級改變了命令格式。

### 正確做法

```bash
# ✅ 正確（v3.x 新格式）
wrangler kv namespace create "TOKENS"
wrangler kv key put --binding=TOKENS "key" "value"
wrangler kv key list --binding=TOKENS
```

### 關鍵點

1. v3.x 使用**空格**：`kv namespace`, `kv key`
2. v2.x 使用**冒號**：`kv:namespace`, `kv:key`
3. 檢查版本：`wrangler --version`

### 影響範圍

多個文檔需要統一更新為新格式（但不影響功能理解）。

---

## ❌ 錯誤 #7: 環境變數名稱修改導致 KV Secret 孤兒問題（2025-11-08）

### 嚴重程度
🟡 **中等** - 導致 API 調用失敗，KV 資源洩漏

### 問題描述

在路由後端認證中，如果編輯路由時修改了環境變數名稱，會導致 KV 中的舊 Secret 成為孤兒（未被刪除），新名稱的 Secret 不存在，API 調用失敗。

### 錯誤場景

```yaml
# 初始創建
路由配置:
  backend_auth_config: { "token_ref": "PERPLEXITY_API_KEY" }
KV 中:
  secret:PERPLEXITY_API_KEY = "pplx-xxxxx"

# 用戶編輯路由，修改環境變數名稱
修改為:
  backend_auth_config: { "token_ref": "PPLX_KEY" }

# 結果
資料庫: token_ref = "PPLX_KEY"  ← 已更新
KV 中:
  secret:PERPLEXITY_API_KEY = "pplx-xxxxx"  ← 孤兒，沒被刪除
  secret:PPLX_KEY = ???  ← 不存在！

# Worker 運行時
env.PPLX_KEY = undefined  ← 找不到
後端 API 調用失敗: "Missing Authorization"
```

### 根本原因

**缺少 Secret 生命週期管理**

- 創建路由時：創建 Secret ✅
- 更新路由時：更新配置，但沒有刪除舊 Secret ❌
- 刪除路由時：沒有刪除對應的 Secret ❌

### 正確做法

**方案 A：鎖定環境變數名稱不可修改（推薦）**

```javascript
// 前端編輯表單
<input 
  value={authConfig.token_ref}
  disabled={true}  // ← 鎖定，不可修改
/>
<small>環境變數名稱創建後不可修改</small>
```

**方案 B：自動管理 Secret 生命週期**

```python
# 後端更新路由時
@app.put("/api/routes/{id}")
async def update_route(id, data):
    old_route = await get_route(id)
    
    # 檢查環境變數名稱是否改變
    old_ref = old_route.backend_auth_config.get('token_ref')
    new_ref = data.backend_auth_config.get('token_ref')
    
    if old_ref and new_ref and old_ref != new_ref:
        # 刪除舊 secret
        await cf_kv.delete(f"secret:{old_ref}")
        # 創建新 secret（需要用戶提供新值）
        await cf_kv.put(f"secret:{new_ref}", new_secret_value)
```

### 關鍵點

1. **環境變數名稱是 Secret 的 key**，修改會導致找不到
2. **KV Secret 需要明確的生命週期管理**
3. **最簡單的方案**：創建後不允許修改名稱
4. **如果要支持修改**：需要提示用戶重新輸入實際 Key

### 影響範圍

- ❌ 修改後的路由無法正常工作
- ❌ KV 中累積孤兒 Secrets（資源洩漏）
- ❌ 難以排查（沒有明確錯誤提示）

### 預防措施

1. **前端 UI**：
   - 環境變數名稱欄位設為 `disabled`
   - 說明文字：「環境變數名稱創建後不可修改」

2. **後端驗證**：
   ```python
   if old_ref != new_ref:
       raise HTTPException(
           400, 
           "環境變數名稱不可修改。如需更換，請刪除後重新創建路由。"
       )
   ```

3. **刪除路由時清理 Secret**：
   ```python
   @app.delete("/api/routes/{id}")
   async def delete_route(id):
       route = await get_route(id)
       
       # 刪除對應的 secret
       if route.backend_auth_config:
           token_ref = route.backend_auth_config.get('token_ref')
           if token_ref:
               await cf_kv.delete(f"secret:{token_ref}")
       
       await delete_route_from_db(id)
   ```

### 相關文檔

- [路由後端認證指南](./ROUTE_BACKEND_AUTH.md)
- [當前狀態分析](../archive/analysis/CURRENT_STATUS_AND_ISSUES.md)

---

## ❌ 錯誤 #8: Clerk authorized_parties 硬編碼導致生產環境 401（2025-11-08）

### 嚴重程度
🔴 **高** - 導致生產環境所有 API 無法使用，本地測試正常但部署後失敗

### 問題描述

後端硬編碼 `authorized_parties=['http://localhost:5173']`，導致生產環境前端無法調用 API，返回 401 錯誤。

### 錯誤代碼

```python
# backend/clerk_auth.py

# ❌ 硬編碼本地域名
session = clerk.sessions.verify_token(
    token,
    authorized_parties=['http://localhost:5173']  # ← 只允許本地
)
```

### 錯誤現象

```
本地開發（localhost:5173）:
  ✅ 所有 API 正常工作
  
生產環境（token.blocktempo.ai）:
  ❌ 所有 API 返回 401
  ❌ 錯誤: "TOKEN_INVALID_AUTHORIZED_PARTIES"
  ❌ 前端完全無法使用
```

### 根本原因

**Clerk JWT token 包含 `azp`（authorized party）聲明**

```yaml
Token 結構:
  azp: "http://localhost:5173"        # 本地開發
  azp: "https://token.blocktempo.ai"  # 生產環境

後端驗證:
  authorized_parties = ['http://localhost:5173']  # 硬編碼
  
  本地: token.azp === 'localhost:5173' ✅ 匹配
  生產: token.azp === 'token.blocktempo.ai' ❌ 不匹配 → 401
```

### 正確做法

```python
# ✅ 從環境變數讀取
import os

allowed_origins = os.getenv(
    'ALLOWED_FRONTEND_ORIGINS', 
    'http://localhost:5173'
).split(',')

authorized_parties = [origin.strip() for origin in allowed_origins]

session = clerk.sessions.verify_token(
    token,
    authorized_parties=authorized_parties
)
```

**環境變數設置**：
```env
# Railway 後端
ALLOWED_FRONTEND_ORIGINS=http://localhost:5173,https://token.blocktempo.ai
```

### 關鍵點

1. **本地測試正常不代表生產沒問題**
2. **Clerk token 的 azp 與前端域名綁定**
3. **authorized_parties 必須包含所有前端域名**
4. **從環境變數讀取，不要硬編碼**

### 影響範圍

- ❌ 生產環境所有需要認證的 API
- ❌ 用戶無法登入和使用系統
- ❌ 錯誤訊息不明確（不會說是域名問題）

### 預防措施

1. **代碼審查檢查清單**：
   - [ ] 是否有硬編碼的域名或 URL？
   - [ ] 是否所有域名都從環境變數讀取？
   - [ ] 環境變數是否有合理的預設值？

2. **部署前測試**：
   - 使用生產域名本地測試（設置 `.env.local`）
   - 檢查所有 API 調用是否正常
   - 驗證 Clerk 認證流程

### 相關文檔

- [部署完整記錄](../archive/deployment-configs/READY_FOR_DEPLOYMENT.md)

---

## ❌ 錯誤 #9: Vite 環境變數名稱不一致導致完全失效（2025-11-08）

### 嚴重程度
🔴 **高** - 導致前端無法連接後端，但不會報錯

### 問題描述

前端代碼和配置文件使用不同的環境變數名稱，導致環境變數完全不生效，前端仍連接到錯誤的 URL。

### 錯誤代碼

```javascript
// ❌ .env 文件
VITE_API_BASE_URL=https://tapi.blocktempo.ai

// ❌ 代碼中
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
//                                ^^^^^^^^^^^^
//                                名稱不一致！
```

### 錯誤現象

```
配置了環境變數:
  VITE_API_BASE_URL=https://tapi.blocktempo.ai
  
前端仍然連接:
  http://localhost:8000  ← 使用了 fallback 預設值
  
沒有任何錯誤提示！
```

### 根本原因

**Vite 環境變數名稱必須完全匹配**

```
.env 文件:        VITE_API_BASE_URL
代碼中:           VITE_API_URL
                  ^^^^^^^^^^^^^^^^ 不匹配 → undefined → 使用預設值
```

### 正確做法

```javascript
// ✅ 統一使用同一個名稱
// .env
VITE_API_URL=https://tapi.blocktempo.ai

// 代碼
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

### 關鍵點

1. **環境變數名稱必須完全一致**（大小寫、底線數量）
2. **Vite 環境變數靜默失敗**（不匹配時返回 undefined，不報錯）
3. **全局搜索檢查所有使用處**
4. **統一命名規範**（例如都用 `VITE_API_URL`）

### 影響範圍

- ❌ 所有前端組件連接錯誤的後端
- ❌ 本地測試時發現不了（預設值是 localhost）
- ❌ 生產環境資料不一致

---

## ❌ 錯誤 #10: Vite Preview allowedHosts 阻擋自定義域名（2025-11-08）

### 嚴重程度
🟡 **中等** - 導致生產部署無法訪問，但錯誤訊息明確

### 問題描述

Vite Preview 模式會阻擋自定義域名訪問，需要明確配置 `allowedHosts`。

### 錯誤代碼

```javascript
// vite.config.js
export default defineConfig({
  preview: {
    port: 4173
    // 缺少 allowedHosts 配置
  }
})
```

### 錯誤現象

```
訪問 https://token.blocktempo.ai

錯誤訊息:
  Blocked request. This host ("token.blocktempo.ai") is not allowed.
  To allow this host, add "token.blocktempo.ai" to `preview.allowedHosts`.
```

### 根本原因

**Vite 的 DNS rebinding 攻擊防護**

Preview 模式只允許 localhost 訪問，阻擋其他域名。

### 正確做法

```javascript
// ✅ 配置允許的域名
export default defineConfig({
  preview: {
    port: 4173,
    host: '0.0.0.0',
    allowedHosts: ['token.blocktempo.ai', 'localhost']
  }
})
```

### 關鍵點

1. **preview 模式需要明確配置 allowedHosts**
2. **dev 模式沒有此限制**
3. **生產部署使用 preview 模式**

---

## ❌ 錯誤 #11: Cloudflare KV API 返回格式誤判（2025-11-08）

### 嚴重程度
🟡 **中等** - 導致 KV 同步失敗

### 問題描述

錯誤地假設 Cloudflare KV API 的 `result` 是 dict，實際是 list。

### 錯誤代碼

```python
# ❌ 錯誤假設
response = await client.get(kv_api_url)
data = response.json()
result = data.get("result", {"keys": [], "cursor": None})  # 假設是 dict
keys = result.get("keys")  # AttributeError: 'list' object has no attribute 'get'
```

### 根本原因

**未驗證 API 返回的實際結構**

Cloudflare KV list keys API 返回：
```json
{
  "result": [  ← 這是 list，不是 dict
    {"name": "token:xxx", "expiration": null},
    {"name": "token:yyy", "expiration": null}
  ],
  "result_info": {
    "cursor": "...",
    "count": 100
  }
}
```

### 正確做法

```python
# ✅ 正確處理
result = data.get("result", [])  # result 是 list
result_info = data.get("result_info", {})
return {
    "keys": result,
    "cursor": result_info.get("cursor")
}
```

### 關鍵點

1. **先在本地測試 API 調用，驗證返回格式**
2. **不要假設 API 結構，要實際驗證**
3. **第三方 API 文檔可能不完整或過時**

---

## ❌ 錯誤 #12: Clerk SDK 返回格式誤判（2025-11-08）

### 嚴重程度
🟡 **中等** - 導致用戶列表獲取失敗

### 問題描述

錯誤地假設 Clerk SDK 返回有 `.data` 屬性的對象，實際直接返回 list。

### 錯誤代碼

```python
# ❌ 錯誤
users_response = clerk.users.list(request={})
users = users_response.data  # AttributeError: list has no attribute 'data'
```

### 根本原因

**Clerk SDK 版本差異或文檔不準確**

實際返回是直接的 list，不是包裝對象。

### 正確做法

```python
# ✅ 正確
users_response = clerk.users.list(request={})
users = users_response  # 直接是 list
```

### 關鍵點

1. **SDK 返回格式可能與文檔不一致**
2. **先用小測試驗證返回值類型**
3. **不同版本的 SDK 可能有不同格式**

---

## ❌ 錯誤 #13: 前端 API 相對路徑導致生產環境資料分裂（2025-11-08）

### 嚴重程度
🔴 **極度嚴重** - 導致生產環境資料完全錯亂，問題隱蔽且花費 3 天才發現

### 問題描述

前端多個組件硬編碼 `http://localhost:8000`，導致生產環境前端連接到本地後端，造成資料分裂且極難發現。

### 錯誤代碼

```javascript
// ❌ 11 個組件硬編碼本地 URL
// TeamManagement.jsx, UserManagement.jsx, EditTeamModal.jsx 等
fetch('http://localhost:8000/api/teams', {...})  // 硬編碼！
```

### 錯誤現象

```
生產環境部署後:
  ✅ Token 管理頁面正常（使用 services/api.js）
  ✅ 路由管理頁面正常（使用 services/api.js）
  ❌ 團隊管理頁面顯示空資料
  ❌ 用戶管理頁面顯示空資料
  
更詭異的是:
  ✅ 本地測試完全正常
  ❌ 生產環境部分頁面有資料，部分沒有
  ❌ 沒有任何錯誤提示
  ❌ Network tab 顯示 200 OK（但連到本地！）
```

### 根本原因

**部分組件硬編碼 localhost，部分使用環境變數**

```javascript
// 正確的組件（TokenList.jsx）
import { listTokens } from '../../services/api';  // 使用統一 API

// 錯誤的組件（TeamManagement.jsx）
fetch('http://localhost:8000/api/teams')  // 硬編碼本地
```

**為什麼這麼隱蔽**：
- 本地開發：都連 localhost:8000 ✅ 完全正常
- 生產環境：部分連生產後端，部分連本地（失敗但無錯誤）❌

### 正確做法

```javascript
// ✅ 所有組件統一使用環境變數
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
fetch(`${API_URL}/api/teams`, {...})
```

### 關鍵點

1. **全局搜索所有 `localhost:8000` 確保無遺漏**
2. **本地測試無法發現此問題**（都是 localhost）
3. **生產環境會出現「部分正常部分異常」的詭異現象**
4. **Network tab 不會顯示錯誤**（200 OK，但連錯後端）

### 影響範圍

**受影響的 11 個組件**：
- TeamManagement.jsx, EditTeamModal.jsx
- UserManagement.jsx, EditUserModal.jsx, InviteUserModal.jsx
- Dashboard.jsx, AuditLogs.jsx, SystemHealth.jsx
- UsageAnalytics.jsx, TokenUsageDetail.jsx, RouteUsageDetail.jsx

**花費時間**：3 天 3 夜才定位問題

### 預防措施

1. **代碼審查**：
   ```bash
   # 檢查所有硬編碼
   grep -r "localhost:8000" frontend/src/
   grep -r "http://" frontend/src/ | grep -v "https://"
   ```

2. **統一 API 調用**：
   - 所有組件使用 `services/api.js`
   - 或統一使用環境變數

3. **本地測試生產配置**：
   ```bash
   # .env.local
   VITE_API_URL=https://tapi.blocktempo.ai
   npm run dev  # 連接生產後端測試
   ```

### 相關文檔

- [部署記錄](../archive/deployment-configs/READY_FOR_DEPLOYMENT.md) 第 515-700 行

---

## ❌ 錯誤 #14: Clerk SDK email_addresses 物件轉換錯誤（2025-11-08）

### 嚴重程度
🔴 **極度嚴重** - 導致所有 CRUD 操作返回 500 錯誤，功能完全失效

### 問題描述

在審計日誌記錄中，嘗試從 Clerk SDK 返回的 `user.email_addresses` 物件直接存取 `[0]`，導致 IndexError 或類型錯誤，造成創建/更新/刪除操作失敗。

### 錯誤代碼

```python
# backend/clerk_auth.py - ❌ 直接傳遞 Clerk SDK 物件
user_data = {
    "email_addresses": user.email_addresses,  # ← Clerk SDK 特殊物件！
}

# backend/main.py - ❌ 不安全的存取
created_by_email = user.get("email_addresses", [{}])[0].get("email_address", "unknown")
# 問題1: email_addresses 可能是空陣列 [] → [0] → IndexError
# 問題2: email_addresses 可能是 Clerk 物件，不是 list
```

### 錯誤現象

```
用戶操作:
  創建路由 → Failed to fetch
  創建 Token → Failed to fetch
  更新任何資源 → Failed to fetch
  
後端錯誤:
  500 Internal Server Error
  IndexError: list index out of range
  或 TypeError: object is not subscriptable
  
實際狀況:
  ✅ 資源已創建到資料庫
  ✅ 已同步到 Cloudflare KV
  ❌ 審計日誌記錄時出錯
  ❌ 前端收到 500 錯誤
  ❌ 用戶誤以為操作失敗
```

### 根本原因

**多層問題疊加：**

1. **Clerk SDK 物件不是 Python 原生類型**
   - `user.email_addresses` 是特殊物件，不是 list
   - 直接傳遞給 `user_data` 可能導致後續存取錯誤

2. **不安全的陣列存取**
   - `[{}][0]` 如果陣列是空的 `[]`，`[0]` 會失敗
   - 沒有檢查陣列長度就存取

3. **錯誤發生在審計日誌記錄階段**
   - 主要操作已完成（資料庫、KV）
   - 但審計日誌失敗導致整個請求返回 500
   - 造成「操作成功但前端報錯」的詭異現象

### 正確做法

**階段 1: clerk_auth.py - 安全轉換**

```python
# ✅ 轉換 Clerk SDK 物件為純 Python 類型
user = clerk_client.users.get(user_id=user_id)

# 安全轉換 email_addresses
email_list = []
if user.email_addresses:
    for email in user.email_addresses:
        email_list.append({
            "email_address": email.email_address if hasattr(email, 'email_address') else str(email)
        })

user_data = {
    "id": user.id,
    "email_addresses": email_list,  # ← 純 Python list of dict
    ...
}
```

**階段 2: main.py - 安全存取**

```python
# ✅ 檢查陣列是否為空再存取
email_addresses = user.get("email_addresses", [])
created_by_email = email_addresses[0].get("email_address", "unknown") if email_addresses else "unknown"

await log_audit("create", "route", route_id, {
    ...
    "created_by_email": created_by_email
})
```

### 關鍵點

1. **永遠不要假設 SDK 返回的是 Python 原生類型**
2. **陣列存取前先檢查長度**: `if arr else "default"`
3. **審計日誌失敗不應該讓整個操作失敗**（但目前會）
4. **Clerk SDK 的所有物件都需要轉換**

### 影響範圍

**受影響的所有 CRUD 操作**：
- ❌ 創建 Token (main.py 第 270 行)
- ❌ 更新 Token (main.py 第 417 行)
- ❌ 刪除 Token (main.py 第 510 行)
- ❌ 創建 Route (main.py 第 559 行) ← **這就是 fail to fetch 的根源！**
- ❌ 更新 Route (main.py 第 716 行)
- ❌ 刪除 Route (main.py 第 771 行)

### 診斷過程

1. **用戶報告**: 創建路由顯示 "Failed to fetch"
2. **觀察**: 路由實際已創建（第二次說 already exists）
3. **誤判**: 以為是 CORS 問題 ❌
4. **誤判**: 以為是 Vite proxy 問題 ❌
5. **誤判**: 以為是 KV 同步失敗 ❌
6. **定位**: 後端返回 500 錯誤
7. **發現**: email_addresses 存取問題 ✅
8. **修復**: 安全轉換和安全存取

### 修復的檔案

1. `backend/clerk_auth.py` - 轉換 email_addresses 為純 Python list
2. `backend/main.py` - 6 處安全存取 email_addresses

### 學到的教訓

1. **操作成功但返回錯誤的詭異現象**
   - 資料庫操作成功
   - 後續步驟（審計日誌）失敗
   - 前端誤以為整個操作失敗

2. **Clerk SDK 的所有物件都是「地雷」**
   - `user.email_addresses` - 特殊物件
   - `user.public_metadata` - 可能是特殊物件
   - 必須全部轉換為 Python 原生類型

3. **診斷時不要猜測，要看證據**
   - CORS 錯誤 ≠ CORS 設置錯誤
   - 可能是後端 500 導致的 CORS headers 缺失
   - 要看 Network tab 的 Status code

4. **陣列存取的防禦性編程**
   ```python
   # ❌ 危險
   arr[0]
   
   # ✅ 安全
   arr[0] if arr else default_value
   ```

### 預防措施

1. **代碼審查檢查清單**：
   - [ ] 所有陣列存取前是否檢查長度？
   - [ ] 所有第三方 SDK 物件是否已轉換？
   - [ ] 審計日誌失敗是否影響主要操作？

2. **改進建議**：
   - 審計日誌應該用 try-catch 包裝，失敗只記錄警告
   - 所有 Clerk SDK 物件在 verify_clerk_token 就轉換好
   - 添加更多防禦性檢查

### 修復時間軸

| 時間 | 事件 |
|------|------|
| 18:00 | 用戶報告創建路由 "Failed to fetch" |
| 18:05 | 誤判為 CORS 問題，調整中間件順序 |
| 18:10 | 誤判為 Vite proxy 問題（已 revert）|
| 18:15 | 誤判為 KV 同步問題（已 revert）|
| 18:20 | 發現後端返回 500 錯誤 |
| 18:25 | 定位 email_addresses 存取問題 |
| 18:30 | 修復 clerk_auth.py 轉換邏輯 |
| 18:35 | 修復 main.py 所有存取點 |
| 18:40 | 部署並驗證修復成功 |

**總耗時**: 40 分鐘，包含多次誤判和 revert

---

## 📋 其他嚴重錯誤（待記錄）

（未來如有其他嚴重錯誤，記錄在此）

---

**文件建立日期**: 2025-11-07  
**最後更新**: 2025-11-08  
**維護者**: 開發團隊

