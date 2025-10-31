# Token Manager 權限系統實現總結

## ✅ 已完成的功能

### 1. 權限架構設計
- ✅ **RBAC + Team Scoping** 模式
- ✅ 四個角色：ADMIN、MANAGER、DEVELOPER、VIEWER
- ✅ 團隊級別權限隔離
- ✅ 命名空間：`tokenManager:*`（不影響其他專案）

### 2. 前端實現
```
frontend/src/
├── constants/
│   └── roles.js              # 角色和權限定義
├── hooks/
│   └── usePermissions.js     # 權限檢查 Hook
├── utils/
│   └── clerkMetadata.js      # Metadata 工具函數
└── components/
    ├── Auth/
    │   ├── SignIn.jsx
    │   ├── SignUp.jsx
    │   └── ProtectedRoute.jsx
    ├── UserManagement/
    │   ├── UserManagement.jsx    # 用戶管理頁面
    │   └── EditUserModal.jsx     # 編輯權限 Modal
    └── Layout/
        ├── Header.jsx            # 更新：顯示真實用戶資訊
        └── Sidebar.jsx           # 更新：根據權限顯示選單
```

### 3. 文檔
- ✅ `PERMISSIONS_GUIDE.md` - 完整權限指南
- ✅ `PERMISSIONS_QUICK_REFERENCE.md` - 快速參考
- ✅ `AUTO_ASSIGN_VIEWER_ROLE.md` - 自動賦予角色指南
- ✅ `IMPLEMENTATION_SUMMARY.md` - 實現總結（本文件）

### 4. 工具腳本
- ✅ `scripts/set-user-role.js` - 設定用戶角色輔助腳本

---

## 🎯 權限設計

### 角色定義

| 角色 | 範圍 | 需要團隊 | 可以做什麼 |
|------|------|---------|-----------|
| 👑 ADMIN | 全局 | ❌ | 管理一切（包括所有用戶和資源） |
| ⭐ MANAGER | 團隊 | ✅ | 管理團隊資源和團隊成員 |
| 💻 DEVELOPER | 個人 | ✅ | 管理自己創建的資源 |
| 👁️ VIEWER | 全局 | ❌ | 只能查看，不能修改 |

### Metadata 結構

```javascript
// ADMIN 範例
{
  "tokenManager:role": "ADMIN",
  "tokenManager:joinedAt": "2025-01-15T10:00:02Z"
}

// MANAGER 範例
{
  "tokenManager:role": "MANAGER",
  "tokenManager:team": "backend-team",
  "tokenManager:joinedAt": "2025-01-15T10:00:02Z"
}

// DEVELOPER 範例
{
  "tokenManager:role": "DEVELOPER",
  "tokenManager:team": "frontend-team",
  "tokenManager:joinedAt": "2025-01-15T10:00:02Z"
}

// VIEWER 範例
{
  "tokenManager:role": "VIEWER",
  "tokenManager:joinedAt": "2025-01-15T10:00:02Z"
}
```

---

## 🔄 完整工作流程

### 1. 初始設定（管理員）

```
1. 在 Clerk Dashboard 手動設定第一個 ADMIN
   └─ Public Metadata 加入：
      {
        "tokenManager:role": "ADMIN",
        "tokenManager:joinedAt": "2025-01-15T..."
      }

2. ADMIN 登入 Token Manager

3. 在「用戶管理」頁面管理其他用戶權限
```

### 2. 新用戶註冊流程

```
用戶註冊
    ↓
Clerk Webhook 觸發（自動）
    ↓
後端自動賦予 VIEWER 角色
    ↓
用戶登入
    ↓
前端檢查角色：
  - 有角色 → 正常訪問（根據權限）
  - 無角色 → 顯示「等待管理員分配」提示
```

### 3. 權限管理流程

```
ADMIN/MANAGER 在用戶管理頁面
    ↓
點擊「編輯」按鈕
    ↓
在 Modal 中選擇：
  - 角色（ADMIN/MANAGER/DEVELOPER/VIEWER）
  - 團隊（如果需要）
    ↓
前端調用 API: PUT /api/users/:id/role
    ↓
後端驗證權限
    ↓
後端調用 Clerk API 更新 metadata
    ↓
✅ 用戶下次登入/刷新時獲得新權限
```

### 4. 權限檢查流程

```
用戶執行操作（如：刪除 Token）
    ↓
前端 usePermissions.canDelete(token)
    ↓
檢查：
  - ADMIN? → ✅ 允許
  - MANAGER? → 檢查 token.team === user.team
  - DEVELOPER? → 檢查 token.createdBy === user.id
  - VIEWER? → ❌ 拒絕
    ↓
顯示/隱藏按鈕（UX）
    ↓
（用戶點擊後）
    ↓
發送 API 請求到後端
    ↓
後端再次驗證權限（重要！）
    ↓
執行或拒絕操作
```

---

## 🚀 下一步實現

### Phase 1: 後端 API（必須）

```python
# 1. 用戶管理 API
GET  /api/users              # 列出所有用戶
PUT  /api/users/:id/role     # 更新用戶角色

# 2. Webhook Handler
POST /api/webhooks/clerk     # 接收 Clerk webhook

# 3. 權限驗證中間件
def require_permission(permission: str)
def require_role(role: str)
```

### Phase 2: Token/Route 權限整合

- 更新 TokenManager 和 RouteManager 使用 `usePermissions`
- 根據權限顯示/隱藏操作按鈕
- 後端 API 加入權限驗證

### Phase 3: 審計日誌

- 記錄所有權限變更
- 記錄所有敏感操作（創建/編輯/刪除）
- ADMIN 可查看審計日誌

---

## 📝 使用範例

### 前端：檢查權限

```jsx
import { usePermissions } from '../hooks/usePermissions';

function TokenManager() {
  const { 
    canCreate,    // 檢查是否可以創建
    canUpdate,    // 檢查是否可以編輯特定資源
    canDelete,    // 檢查是否可以刪除特定資源
    isAdmin,      // 是否是 ADMIN
    isAtLeast     // 是否至少是某個角色
  } = usePermissions();

  return (
    <div>
      {/* 創建按鈕：ADMIN/MANAGER/DEVELOPER 可見 */}
      {canCreate('tokens') && (
        <button onClick={handleCreate}>創建 Token</button>
      )}

      {/* 列表 */}
      {tokens.map(token => (
        <div key={token.id}>
          <span>{token.name}</span>
          
          {/* 編輯按鈕：根據資源權限顯示 */}
          {canUpdate(token) && (
            <button onClick={() => handleEdit(token)}>編輯</button>
          )}
          
          {/* 刪除按鈕：根據資源權限顯示 */}
          {canDelete(token) && (
            <button onClick={() => handleDelete(token)}>刪除</button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 後端：驗證權限

```python
from fastapi import HTTPException, Depends
from clerk_backend_api import Clerk

async def get_current_user(token: str = Header()):
    # 驗證 Clerk token
    session = clerk.sessions.verify(token)
    user = clerk.users.get(session.user_id)
    return user

async def require_role(required_role: str):
    async def checker(user = Depends(get_current_user)):
        role = user.public_metadata.get('tokenManager:role')
        
        hierarchy = ['VIEWER', 'DEVELOPER', 'MANAGER', 'ADMIN']
        user_level = hierarchy.index(role)
        required_level = hierarchy.index(required_role)
        
        if user_level < required_level:
            raise HTTPException(403, "Permission denied")
        
        return user
    return checker

# 使用範例
@app.delete("/api/tokens/{token_id}")
async def delete_token(
    token_id: str,
    user = Depends(require_role('MANAGER'))  # 至少需要 MANAGER
):
    token = db.get_token(token_id)
    
    # 進一步檢查：MANAGER 只能刪除自己團隊的
    if user.role == 'MANAGER':
        if token.team != user.team:
            raise HTTPException(403, "Can only delete your team's tokens")
    
    db.delete(token_id)
    return {"success": True}
```

---

## 🔐 安全性檢查清單

### 前端
- [ ] 使用 `usePermissions` hook 控制 UI
- [ ] 根據權限顯示/隱藏按鈕和頁面
- [ ] 在 Sidebar 根據權限顯示選單項目

### 後端
- [ ] **所有敏感 API 都驗證權限**（重要！）
- [ ] 驗證 Clerk token
- [ ] 檢查用戶角色和團隊
- [ ] 記錄審計日誌

### Clerk
- [ ] 設定 Webhook 自動賦予新用戶 VIEWER 角色
- [ ] 驗證 Webhook 簽名
- [ ] 使用命名空間 `tokenManager:*`

---

## 📊 測試計劃

### 測試場景

| 場景 | ADMIN | MANAGER | DEVELOPER | VIEWER |
|------|-------|---------|-----------|--------|
| 查看所有 Token | ✅ | ✅ | ✅ | ✅ |
| 創建 Token | ✅ | ✅ | ✅ | ❌ |
| 編輯自己的 Token | ✅ | ✅ | ✅ | ❌ |
| 編輯別人的 Token | ✅ | ✅ 團隊的 | ❌ | ❌ |
| 刪除任何 Token | ✅ | ✅ 團隊的 | ✅ 自己的 | ❌ |
| 管理用戶 | ✅ | ✅ 團隊成員 | ❌ | ❌ |
| 查看用戶管理頁面 | ✅ | ✅ | ❌ | ❌ |

---

## 🎉 完成狀態

### 已完成 ✅
- [x] 角色和權限定義
- [x] `usePermissions` Hook
- [x] Metadata 工具函數
- [x] 用戶管理 UI（前端）
- [x] Sidebar 權限控制
- [x] Header 用戶資訊顯示
- [x] 完整文檔

### 待實現 🔲
- [ ] 後端用戶管理 API
- [ ] 後端權限驗證中間件
- [ ] Clerk Webhook Handler
- [ ] TokenManager 權限整合
- [ ] RouteManager 權限整合
- [ ] 審計日誌功能

---

## 📞 聯繫資訊

如有問題，請參考：
- `docs/PERMISSIONS_GUIDE.md` - 完整指南
- `docs/PERMISSIONS_QUICK_REFERENCE.md` - 快速參考
- `docs/AUTO_ASSIGN_VIEWER_ROLE.md` - 自動賦予角色

---

**實現完成日期：** 2025-01-15  
**版本：** v1.0  
**狀態：** 前端完成，後端待實現


