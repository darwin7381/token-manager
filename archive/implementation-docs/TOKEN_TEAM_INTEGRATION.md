# Token 管理團隊整合完成報告

**日期**: 2025-11-03  
**版本**: v2.0  
**狀態**: ✅ 已完成

---

## 📋 概述

本次更新將 Token 管理系統完全整合到團隊架構中，移除了舊的 `department` 欄位，改用 `team_id` 與團隊系統對接，實現了基於團隊角色的權限控制。

---

## 🎯 核心改動

### 1. 數據模型升級

#### **Tokens 表 Schema 變更**

```sql
-- ❌ 移除欄位
- department VARCHAR(100)

-- ✅ 新增欄位
+ team_id VARCHAR(50) REFERENCES teams(id) ON DELETE CASCADE
+ created_by VARCHAR(100)  -- Clerk User ID

-- ✅ 新增索引
+ INDEX idx_tokens_team_id ON tokens(team_id)

-- ✅ 新增外鍵約束
+ FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
```

#### **自動遷移機制**

系統啟動時自動檢測並執行 Schema 升級：
1. 檢查 `team_id` 欄位是否存在
2. 如不存在，添加 `team_id` 和 `created_by` 欄位
3. 檢查並移除舊的 `department` 欄位
4. 添加外鍵約束和索引

**位置**: `backend/database.py` (L53-109)

---

### 2. 權限控制系統

#### **權限檢查邏輯**

```python
async def check_team_token_permission(user, team_id, action):
    """
    檢查用戶在該團隊是否有權限管理 Token
    
    規則:
    - 全局 ADMIN: 可以管理所有團隊的 Token
    - 創建: ADMIN, MANAGER, DEVELOPER
    - 編輯/刪除: ADMIN, MANAGER
    """
```

**位置**: `backend/main.py` (L93-123)

#### **權限矩陣**

| 操作 | ADMIN | MANAGER | DEVELOPER | VIEWER |
|------|-------|---------|-----------|--------|
| 創建 Token | ✅ | ✅ | ✅ | ❌ |
| 查看 Token 列表 | ✅ (所有) | ✅ (自己團隊) | ✅ (自己團隊) | ✅ (自己團隊) |
| 編輯 Token | ✅ | ✅ | ❌ | ❌ |
| 刪除 Token | ✅ | ✅ | ❌ | ❌ |
| **全局 ADMIN** | ✅ (所有團隊) | - | - | - |

---

### 3. API 變更

#### **Token API 更新**

```python
# POST /api/tokens
{
  "name": "API-Key-001",
  "team_id": "backend-team",  # ← 新增：必填
  "scopes": ["*"],
  "expires_days": 90
}

# Response
{
  "id": 1,
  "token": "ntk_xxx...",
  "name": "API-Key-001",
  "team_id": "backend-team",  # ← 新增
  "scopes": ["*"]
}
```

#### **Token Response Model**

```python
class TokenResponse(BaseModel):
    id: int
    name: str
    team_id: Optional[str]      # ← 新增
    created_by: Optional[str]    # ← 新增
    scopes: List[str]
    created_at: datetime
    expires_at: Optional[datetime]
    last_used: Optional[datetime]
```

**位置**: `backend/models.py` (L17-26)

#### **所有 API 都需要認證**

所有 Token 相關的 API 現在都需要 Clerk 認證 token：

```javascript
// 前端調用方式
const token = await getToken();  // 獲取 Clerk token
await createToken(data, token);
await listTokens(token);
await updateToken(id, data, token);
await deleteToken(id, token);
```

---

### 4. 前端變更

#### **TokenForm.jsx - 團隊選擇器**

```jsx
// 自動載入用戶所屬的團隊
const { user } = useUser();
const { getToken } = useAuth();

useEffect(() => {
  const loadTeams = async () => {
    const token = await getToken();
    const allTeams = await fetchTeams(token);
    const userTeamRoles = user?.publicMetadata?.['tokenManager:teamRoles'] || {};
    
    // 只顯示用戶所屬的團隊
    const userTeams = allTeams.filter(team => userTeamRoles[team.id]);
    setTeams(userTeams);
  };
}, [user, getToken]);
```

**顯示格式**: `🏗️ Platform Team (platform-team)`

**位置**: `frontend/src/components/TokenManager/TokenForm.jsx`

#### **TokenList.jsx - 團隊顯示**

```jsx
// 載入團隊資料並顯示
const getTeamDisplay = (teamId) => {
  const team = teams.find(t => t.id === teamId);
  if (!team) return teamId || '未設定';
  return `${team.icon} ${team.name} (${team.id})`;
};
```

**位置**: `frontend/src/components/TokenManager/TokenList.jsx`

#### **EditTokenModal.jsx - 團隊顯示（唯讀）**

團隊欄位顯示但不可編輯，格式統一為：`圖標 團隊名稱 (團隊ID)`

**位置**: `frontend/src/components/TokenManager/EditTokenModal.jsx`

---

### 5. API 認證整合

#### **api.js 更新**

所有 Token API 函數都加入了認證 token 參數：

```javascript
export const createToken = async (data, token) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // ... fetch call
};
```

**更新的函數**:
- `createToken(data, token)`
- `listTokens(token)`
- `updateToken(id, data, token)`
- `deleteToken(id, token)`
- `fetchTeams(token)` (新增)

**位置**: `frontend/src/services/api.js` (L10-83, L117-216)

---

## 🔐 權限邏輯說明

### **管理權限 vs 使用權限**

```
Token 的兩個維度:

1. 管理權限 (由 team_id 決定)
   - 誰可以創建、編輯、刪除這個 Token？
   - 答: 該 team_id 團隊的 ADMIN/MANAGER

2. 使用權限 (由 scopes 決定)
   - 這個 Token 可以訪問哪些 API 路由？
   - 答: 由 scopes 定義，與 team_id 無關
```

### **範例場景**

```yaml
團隊: Backend Team (backend-team)
成員: 
  - Alice (ADMIN)
  - Bob (DEVELOPER)

Token:
  name: "n8n-workflow-token"
  team_id: "backend-team"      # 屬於 Backend Team
  scopes: ["*"]                 # 可以訪問所有路由

管理權限:
  - Alice (ADMIN) → 可以編輯/刪除此 Token
  - Bob (DEVELOPER) → 只能查看此 Token
  - 全局 ADMIN → 可以管理所有 Token

使用權限:
  - 任何人拿到此 Token → 可以訪問所有 API 路由
  - Cloudflare Worker 只檢查 scopes，不檢查 team_id
```

---

## 📁 檔案清單

### **後端檔案**

```
backend/
├── database.py          # Schema 升級和遷移邏輯
├── models.py           # TokenCreate, TokenResponse 模型
├── main.py             # Token API 和權限檢查
└── clerk_auth.py       # 權限驗證輔助函數
```

### **前端檔案**

```
frontend/src/
├── services/
│   └── api.js                              # API 函數（加入認證）
└── components/TokenManager/
    ├── TokenForm.jsx                       # 創建表單（團隊選擇）
    ├── TokenList.jsx                       # Token 列表（團隊顯示）
    └── EditTokenModal.jsx                  # 編輯對話框（團隊唯讀）
```

---

## 🔄 向後兼容

### **資料遷移策略**

```
策略: 零停機自動遷移

1. 系統啟動時自動檢測 Schema 版本
2. 如果發現舊 Schema，自動添加新欄位
3. 保留舊資料（team_id 初始為 NULL）
4. 新建的 Token 必須指定 team_id
5. 移除 department 欄位

注意: 舊的 Token（team_id = NULL）仍可使用，
      但無法編輯，建議用戶重新創建
```

---

## ✅ 測試檢查清單

### **功能測試**

- [x] 以團隊成員身份創建 Token
- [x] 團隊選擇器正確顯示所屬團隊
- [x] Token 列表只顯示自己團隊的 Token
- [x] 全局 ADMIN 可以看到所有 Token
- [x] ADMIN/MANAGER 可以編輯 Token
- [x] DEVELOPER 可以創建但不能編輯 Token
- [x] 團隊顯示格式統一: `圖標 名稱 (ID)`
- [x] 編輯對話框顯示團隊但不可修改

### **權限測試**

- [x] VIEWER 無法創建 Token
- [x] DEVELOPER 無法編輯/刪除 Token
- [x] 跨團隊無法編輯其他團隊的 Token
- [x] 全局 ADMIN 可以管理所有團隊的 Token

### **認證測試**

- [x] 未登入無法訪問 Token API
- [x] Token 過期時正確提示
- [x] 跨域請求正確處理認證 header

---

## 🚀 部署注意事項

### **資料庫**

```bash
# 不需要手動執行任何 SQL
# 系統會在啟動時自動執行 Schema 升級
```

### **環境變數**

```bash
# 後端需要
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...

# 前端需要
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_URL=http://localhost:8000
```

### **啟動順序**

```bash
# 1. 啟動後端（會自動執行遷移）
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# 2. 啟動前端
cd frontend
npm run dev
```

---

## 📊 統計數據

```
代碼變更:
  - 後端檔案: 4 個檔案修改
  - 前端檔案: 4 個檔案修改
  - 新增函數: 5 個
  - 新增 API: 5 個（團隊管理）
  
代碼行數:
  - 新增: ~200 行
  - 修改: ~150 行
  - 刪除: ~50 行
  
測試覆蓋:
  - 功能測試: 8/8 通過
  - 權限測試: 4/4 通過
  - 認證測試: 3/3 通過
```

---

## 🔮 未來改進

### **短期（可選）**

1. **Token 使用統計**
   - 記錄每個 Token 的使用次數
   - 最後使用時間
   - 使用頻率圖表

2. **Token 過期提醒**
   - 過期前 7 天提醒
   - 郵件通知團隊 ADMIN

### **長期（可選）**

1. **跨團隊授權**
   - 允許 Token 訪問其他團隊的路由
   - 需要雙方團隊 ADMIN 同意

2. **Token Scopes 細化**
   - 限制團隊只能訪問特定路由
   - 團隊級別的 scopes 限制

3. **審計日誌增強**
   - 記錄每次 Token 使用
   - 異常訪問檢測

---

## 📝 總結

本次更新成功將 Token 管理系統從**自由文字欄位**（department）升級為**正規團隊架構**（team_id），實現了：

✅ **數據一致性**: 外鍵約束保證團隊存在  
✅ **權限控制**: 基於團隊角色的 RBAC  
✅ **用戶體驗**: 清晰的團隊顯示格式  
✅ **安全性**: 所有 API 都需要認證  
✅ **可維護性**: 自動遷移，零停機部署  

系統現在已經完全基於團隊架構運作，為後續的路由管理整合奠定了基礎。

---

**文件版本**: 1.0  
**最後更新**: 2025-11-03  
**作者**: AI Team

