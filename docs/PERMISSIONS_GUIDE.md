# Token Manager 權限系統指南

本文檔說明 Token Manager 的權限系統架構和使用方式。

## 🏗️ 架構設計

### 權限模型：RBAC + Team Scoping

- **RBAC (Role-Based Access Control)**：基於角色的權限控制
- **Team Scoping**：團隊級別的權限隔離

這個模型在簡單和靈活之間取得平衡，適合中小型團隊使用。

---

## 👥 角色定義

### 1. ADMIN（系統管理員）👑

**權限範圍：** 全局

**可以做的事：**
- ✅ 查看和管理所有 Token
- ✅ 查看和管理所有路由
- ✅ 管理所有用戶的權限（包括跨團隊）
- ✅ 查看審計日誌
- ✅ 修改系統設定

**適用對象：** CTO、技術總監、平台負責人

**Metadata 範例：**
```javascript
{
  'tokenManager:role': 'ADMIN',
  'tokenManager:joinedAt': '2025-01-15T10:00:00Z'
}
```

---

### 2. MANAGER（團隊管理者）⭐

**權限範圍：** 團隊級別

**可以做的事：**
- ✅ 查看所有 Token 和路由（包括其他團隊的）
- ✅ 創建、編輯、刪除**自己團隊**的 Token
- ✅ 創建、編輯、刪除**自己團隊**的路由
- ✅ 管理**自己團隊**成員的權限
- ❌ 不能管理其他團隊的資源
- ❌ 不能修改系統設定

**適用對象：** Team Lead、技術經理、部門主管

**Metadata 範例：**
```javascript
{
  'tokenManager:role': 'MANAGER',
  'tokenManager:team': 'backend-team',  // 必須指定團隊
  'tokenManager:joinedAt': '2025-01-15T10:00:00Z'
}
```

---

### 3. DEVELOPER（開發者）💻

**權限範圍：** 個人級別

**可以做的事：**
- ✅ 查看所有 Token 和路由（包括其他人的）
- ✅ 創建**自己的** Token 和路由
- ✅ 編輯和刪除**自己創建的** Token 和路由
- ❌ 不能編輯或刪除別人的資源
- ❌ 不能管理用戶權限

**適用對象：** 開發工程師、實習生

**Metadata 範例：**
```javascript
{
  'tokenManager:role': 'DEVELOPER',
  'tokenManager:team': 'frontend-team',  // 必須指定團隊
  'tokenManager:joinedAt': '2025-01-15T10:00:00Z'
}
```

---

### 4. VIEWER（檢視者）👁️

**權限範圍：** 全局（只讀）

**可以做的事：**
- ✅ 查看所有 Token
- ✅ 查看所有路由
- ✅ 查看統計數據
- ❌ 不能進行任何創建、編輯、刪除操作
- ❌ 不能管理用戶權限

**適用對象：** PM、QA、Stakeholder

**Metadata 範例：**
```javascript
{
  'tokenManager:role': 'VIEWER',
  'tokenManager:joinedAt': '2025-01-15T10:00:00Z'
}
```

---

## 🏢 團隊定義

目前支援的團隊：

| 團隊 ID | 團隊名稱 | 說明 |
|---------|----------|------|
| `platform-team` | Platform Team | 平台基礎設施團隊 |
| `backend-team` | Backend Team | 後端開發團隊 |
| `frontend-team` | Frontend Team | 前端開發團隊 |
| `data-team` | Data Team | 數據工程團隊 |
| `devops-team` | DevOps Team | DevOps 團隊 |

> 💡 團隊列表可以在後端動態配置

---

## 🔐 權限矩陣

### Token 管理

| 操作 | ADMIN | MANAGER | DEVELOPER | VIEWER |
|------|-------|---------|-----------|--------|
| 查看所有 Token | ✅ | ✅ | ✅ | ✅ |
| 創建 Token | ✅ | ✅ 團隊的 | ✅ 自己的 | ❌ |
| 編輯 Token | ✅ 所有 | ✅ 團隊的 | ✅ 自己的 | ❌ |
| 刪除 Token | ✅ 所有 | ✅ 團隊的 | ✅ 自己的 | ❌ |

### 路由管理

| 操作 | ADMIN | MANAGER | DEVELOPER | VIEWER |
|------|-------|---------|-----------|--------|
| 查看所有路由 | ✅ | ✅ | ✅ | ✅ |
| 創建路由 | ✅ | ✅ 團隊的 | ✅ 自己的 | ❌ |
| 編輯路由 | ✅ 所有 | ✅ 團隊的 | ✅ 自己的 | ❌ |
| 刪除路由 | ✅ 所有 | ✅ 團隊的 | ✅ 自己的 | ❌ |

### 用戶管理

| 操作 | ADMIN | MANAGER | DEVELOPER | VIEWER |
|------|-------|---------|-----------|--------|
| 查看所有用戶 | ✅ | ✅ | ❌ | ❌ |
| 管理用戶角色 | ✅ 所有人 | ✅ 團隊成員 | ❌ | ❌ |
| 變更團隊 | ✅ | ❌ | ❌ | ❌ |

---

## 💻 使用範例

### 前端：使用 usePermissions Hook

```jsx
import { usePermissions } from '../hooks/usePermissions';

function TokenList() {
  const { 
    userRole, 
    userTeam, 
    canCreate, 
    canUpdate, 
    canDelete 
  } = usePermissions();
  
  const tokens = useTokens();
  
  return (
    <div>
      {/* 顯示當前角色和團隊 */}
      <div>
        角色: {userRole}
        {userTeam && ` | 團隊: ${userTeam}`}
      </div>
      
      {/* 根據權限顯示創建按鈕 */}
      {canCreate('tokens') && (
        <button onClick={handleCreate}>創建 Token</button>
      )}
      
      {/* 列表 */}
      {tokens.map(token => (
        <div key={token.id}>
          <span>{token.name}</span>
          
          {/* 根據資源權限顯示操作按鈕 */}
          {canUpdate(token) && (
            <button onClick={() => handleEdit(token)}>編輯</button>
          )}
          
          {canDelete(token) && (
            <button onClick={() => handleDelete(token)}>刪除</button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 根據角色顯示不同 UI

```jsx
import { usePermissions } from '../hooks/usePermissions';

function Sidebar() {
  const { isAdmin, isAtLeast } = usePermissions();
  
  return (
    <nav>
      <MenuItem to="/dashboard">儀表板</MenuItem>
      <MenuItem to="/tokens">Token 管理</MenuItem>
      <MenuItem to="/routes">路由管理</MenuItem>
      
      {/* 只有 Manager 以上可以看到 */}
      {isAtLeast('MANAGER') && (
        <MenuItem to="/team">團隊管理</MenuItem>
      )}
      
      {/* 只有 Admin 可以看到 */}
      {isAdmin && (
        <>
          <MenuItem to="/users">用戶管理</MenuItem>
          <MenuItem to="/audit-logs">審計日誌</MenuItem>
          <MenuItem to="/settings">系統設定</MenuItem>
        </>
      )}
    </nav>
  );
}
```

### 檢查具體權限

```jsx
import { usePermissions } from '../hooks/usePermissions';

function TokenDetail({ token }) {
  const { hasPermission, canUpdate } = usePermissions();
  
  // 檢查具體的權限
  const canViewAuditLog = hasPermission('view:audit-logs');
  
  // 檢查是否可以編輯這個特定的 token
  const canEdit = canUpdate(token);
  
  return (
    <div>
      <h1>{token.name}</h1>
      
      {canEdit && (
        <button>編輯</button>
      )}
      
      {canViewAuditLog && (
        <section>
          <h2>變更記錄</h2>
          {/* 顯示審計日誌 */}
        </section>
      )}
    </div>
  );
}
```

---

## 🔧 設定用戶角色

### 方法 1: 使用 Clerk Dashboard（推薦）

1. 前往 [Clerk Dashboard](https://dashboard.clerk.com)
2. 選擇你的 Application
3. 點擊左側 **"Users"**
4. 選擇要設定的用戶
5. 點擊 **"Metadata"** tab
6. 在 **"Public metadata"** 中添加：

```json
{
  "tokenManager:role": "MANAGER",
  "tokenManager:team": "backend-team",
  "tokenManager:joinedAt": "2025-01-15T10:00:00Z"
}
```

7. 點擊 **"Save"**

### 方法 2: 使用 Clerk API（後端）

```python
from clerk_backend_api import Clerk

clerk = Clerk(bearer_auth="your_secret_key")

# 設定用戶為 MANAGER
clerk.users.update_metadata(
    user_id="user_xxx",
    public_metadata={
        "tokenManager:role": "MANAGER",
        "tokenManager:team": "backend-team",
        "tokenManager:joinedAt": "2025-01-15T10:00:00.000Z"
    }
)
```

### 方法 3: 建立用戶管理頁面（未來功能）

在 Token Manager 內建用戶管理頁面，ADMIN 可以直接在界面上設定。

---

## 📊 實際案例

### 案例 1: 跨團隊協作

**情境：**
- Alice (MANAGER, backend-team) 創建了一個 API Token
- Bob (DEVELOPER, frontend-team) 需要使用這個 Token

**結果：**
- ✅ Bob 可以「查看」這個 Token（所有人都能看）
- ❌ Bob 不能「編輯」或「刪除」這個 Token（不是他創建的）
- ✅ Alice 可以「編輯」和「刪除」（她的團隊創建的）

---

### 案例 2: 團隊管理

**情境：**
- Charlie (MANAGER, platform-team) 想管理團隊成員的權限

**結果：**
- ✅ Charlie 可以變更 platform-team 成員的角色（DEVELOPER ↔ MANAGER）
- ❌ Charlie 不能變更 backend-team 成員的角色
- ❌ Charlie 不能把成員移到其他團隊（只有 ADMIN 可以）

---

### 案例 3: 開發者的日常使用

**情境：**
- David (DEVELOPER, backend-team) 需要為他的微服務創建 Token

**結果：**
- ✅ David 可以創建 Token
- ✅ David 可以編輯和刪除「他自己創建的」Token
- ✅ David 可以查看其他人的 Token（用於參考）
- ❌ David 不能修改別人的 Token

---

## 🔒 安全性注意事項

### ⚠️ 重要：後端必須驗證權限

**前端的權限檢查只是 UX，不是安全措施！**

```python
# ❌ 錯誤：只有前端檢查
# 前端隱藏了刪除按鈕，但 API 沒有驗證
@app.delete("/api/tokens/{id}")
async def delete_token(id: str):
    return db.delete(id)  # 任何人都能調用！

# ✅ 正確：後端驗證
@app.delete("/api/tokens/{id}")
async def delete_token(id: str, user = Depends(verify_clerk_token)):
    token = db.get_token(id)
    
    # 檢查權限
    user_role = user.public_metadata.get('tokenManager:role')
    user_team = user.public_metadata.get('tokenManager:team')
    
    if user_role == 'ADMIN':
        pass  # ADMIN 可以刪除
    elif user_role == 'MANAGER' and token.team == user_team:
        pass  # MANAGER 可以刪除團隊的
    elif user_role == 'DEVELOPER' and token.created_by == user.id:
        pass  # DEVELOPER 可以刪除自己的
    else:
        raise HTTPException(403, "Permission denied")
    
    return db.delete(id)
```

---

## 🚀 未來擴展

### 階段 2：用戶管理頁面

- [ ] ADMIN 可以在 UI 上管理用戶
- [ ] MANAGER 可以管理團隊成員
- [ ] 邀請新成員功能

### 階段 3：更細緻的權限

- [ ] 環境級別權限（production vs staging）
- [ ] API Rate Limit 管理
- [ ] 審計日誌完整記錄

### 階段 4：進階功能

- [ ] 自定義角色
- [ ] 臨時權限（有時效性）
- [ ] 權限申請流程

---

## 📞 常見問題

### Q: 如果我沒有設定團隊會怎樣？

**A:** 如果你的角色是 MANAGER 或 DEVELOPER，沒有團隊就不能創建資源。系統會提示你聯繫 ADMIN 設定團隊。

### Q: 我可以同時屬於多個團隊嗎？

**A:** 目前不支援。每個用戶只能屬於一個團隊。如果需要跨團隊協作，建議使用 ADMIN 角色。

### Q: VIEWER 角色有什麼用？

**A:** 適合需要查看系統狀態但不需要操作的人，例如 PM、QA、或是外部 Stakeholder。

### Q: 如何變更自己的角色？

**A:** 你不能自己變更角色。需要聯繫 ADMIN 或你的 Team Manager（如果你在他的團隊）。

---

**文檔版本：** v1.0  
**最後更新：** 2025-01-15

