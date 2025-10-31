# 權限系統快速參考

## 🎯 角色總覽

| 角色 | 權限範圍 | 需要團隊 | 適用對象 |
|------|---------|---------|---------|
| 👑 ADMIN | 全局 | ❌ | CTO、技術總監 |
| ⭐ MANAGER | 團隊級別 | ✅ | Team Lead、技術經理 |
| 💻 DEVELOPER | 個人級別 | ✅ | 開發工程師 |
| 👁️ VIEWER | 全局（只讀）| ❌ | PM、QA、Stakeholder |

---

## 📊 權限對照表

### 可以做什麼？

| 操作 | ADMIN | MANAGER | DEVELOPER | VIEWER |
|------|:-----:|:-------:|:---------:|:------:|
| **查看** |
| 查看所有資源 | ✅ | ✅ | ✅ | ✅ |
| **創建** |
| 創建資源 | ✅ 所有 | ✅ 團隊的 | ✅ 自己的 | ❌ |
| **編輯** |
| 編輯資源 | ✅ 所有 | ✅ 團隊的 | ✅ 自己的 | ❌ |
| **刪除** |
| 刪除資源 | ✅ 所有 | ✅ 團隊的 | ✅ 自己的 | ❌ |
| **管理** |
| 管理用戶 | ✅ 所有人 | ✅ 團隊成員 | ❌ | ❌ |
| 系統設定 | ✅ | ❌ | ❌ | ❌ |

---

## 🏢 團隊列表

| 團隊 ID | 團隊名稱 |
|---------|----------|
| `platform-team` | Platform Team |
| `backend-team` | Backend Team |
| `frontend-team` | Frontend Team |
| `data-team` | Data Team |
| `devops-team` | DevOps Team |

---

## 🔧 Metadata 格式

### ADMIN
```json
{
  "tokenManager:role": "ADMIN",
  "tokenManager:updatedAt": "2025-01-15T10:00:00Z"
}
```

### MANAGER
```json
{
  "tokenManager:role": "MANAGER",
  "tokenManager:team": "backend-team",
  "tokenManager:updatedAt": "2025-01-15T10:00:00Z"
}
```

### DEVELOPER
```json
{
  "tokenManager:role": "DEVELOPER",
  "tokenManager:team": "frontend-team",
  "tokenManager:updatedAt": "2025-01-15T10:00:00Z"
}
```

### VIEWER
```json
{
  "tokenManager:role": "VIEWER",
  "tokenManager:updatedAt": "2025-01-15T10:00:00Z"
}
```

---

## 💻 代碼範例

### 檢查權限
```jsx
const { canCreate, canUpdate, canDelete } = usePermissions();

// 創建
if (canCreate('tokens')) {
  // 顯示創建按鈕
}

// 編輯/刪除
tokens.map(token => {
  if (canUpdate(token)) {
    // 顯示編輯按鈕
  }
  if (canDelete(token)) {
    // 顯示刪除按鈕
  }
});
```

### 根據角色顯示 UI
```jsx
const { isAdmin, isAtLeast } = usePermissions();

// 只有 Admin
{isAdmin && <AdminPanel />}

// Manager 以上
{isAtLeast('MANAGER') && <TeamManagement />}
```

---

## 🎬 實際案例

### 案例 1：我能編輯這個 Token 嗎？

| 我的角色 | Token 擁有者 | 我的團隊 | Token 團隊 | 結果 |
|---------|-------------|---------|-----------|------|
| ADMIN | Alice | - | backend | ✅ |
| MANAGER | Alice | backend | backend | ✅ |
| MANAGER | Alice | frontend | backend | ❌ |
| DEVELOPER | **我自己** | backend | backend | ✅ |
| DEVELOPER | Alice | backend | backend | ❌ |
| VIEWER | 任何人 | - | 任何團隊 | ❌ |

### 案例 2：我能管理誰的權限？

| 我的角色 | 目標用戶角色 | 我的團隊 | 目標團隊 | 結果 |
|---------|-------------|---------|---------|------|
| ADMIN | 任何角色 | - | 任何團隊 | ✅ |
| MANAGER | DEVELOPER | backend | backend | ✅ |
| MANAGER | MANAGER | backend | backend | ✅ |
| MANAGER | DEVELOPER | backend | frontend | ❌ |
| DEVELOPER | 任何角色 | 任何團隊 | 任何團隊 | ❌ |

---

## 📝 常用命令

### 設定用戶角色
```bash
# ADMIN
node scripts/set-user-role.js user_xxx ADMIN

# MANAGER
node scripts/set-user-role.js user_yyy MANAGER backend-team

# DEVELOPER
node scripts/set-user-role.js user_zzz DEVELOPER frontend-team

# VIEWER
node scripts/set-user-role.js user_www VIEWER
```

---

## ⚠️ 重要提醒

1. **MANAGER 和 DEVELOPER 必須指定團隊**
2. **前端權限檢查不是安全措施，後端必須驗證**
3. **命名空間是 `tokenManager:`，不要搞錯**
4. **不會影響其他專案的 metadata（如 `blog:role`）**

---

詳細文檔請參考：[PERMISSIONS_GUIDE.md](./PERMISSIONS_GUIDE.md)


