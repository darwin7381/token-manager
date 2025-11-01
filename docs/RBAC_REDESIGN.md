# Token Manager 權限系統設計 - Per-Team Roles 架構

## 🎯 核心概念

**Per-Team Roles = 每個團隊有獨立的角色系統**

```
一個用戶在不同團隊可以有不同角色
Platform Team: MANAGER
Backend Team: DEVELOPER  
Frontend Team: VIEWER

角色綁定在 (user_id, team_id) 的組合上
```

---

## 📐 Metadata 結構

```json
{
  "tokenManager:teamRoles": {
    "platform-team": "MANAGER",
    "backend-team": "DEVELOPER",
    "frontend-team": "VIEWER"
  }
}
```

**就這麼簡單！**

---

## 🔐 權限規則

### 規則 1：團隊成員管理

```
只能管理你所在團隊的成員
Platform MANAGER 只能編輯 Platform Team 的角色
不能碰 Backend/Frontend
```

### 規則 2：角色層級

```
ADMIN > MANAGER > DEVELOPER > VIEWER

在每個團隊內：
- ADMIN 可以設置任何角色
- MANAGER 不能設置/編輯 ADMIN 或 MANAGER
```

### 規則 3：頁面訪問

```
基於最高角色：
- 如果在任一團隊是 ADMIN/MANAGER → 可訪問用戶管理頁面
- 否則 → 不行
```

---

## 💻 API 端點

### 1. 更新團隊角色
```
PUT /api/users/{user_id}/team-role
Body: { "team_id": "platform-team", "role": "DEVELOPER" }
```

### 2. 添加到團隊
```
POST /api/users/{user_id}/team-membership  
Body: { "team_id": "platform-team", "role": "DEVELOPER" }
```

### 3. 從團隊移除
```
DELETE /api/users/{user_id}/team-membership/{team_id}
```

---

## 🎨 UI 設計

### 編輯用戶 Modal

```
┌────────────────────────────────────────┐
│ 編輯用戶權限                           │
├────────────────────────────────────────┤
│                                         │
│ Carla Hung                             │
│ carla@example.com                      │
│                                         │
│ 團隊角色：                             │
│                                         │
│ ┌─ Platform Team ───────────────────┐ │
│ │ 目前角色：DEVELOPER                │ │
│ │ 新角色：[▼ VIEWER]      [更新]    │ │
│ └───────────────────────────────────┘ │
│                                         │
│ ┌─ Backend Team ────────────────────┐ │
│ │ 目前角色：MANAGER                  │ │
│ │ (你不在此團隊，無法編輯)           │ │
│ └───────────────────────────────────┘ │
│                                         │
│ [+ 添加到新團隊]                       │
│                                         │
│                          [完成]        │
└────────────────────────────────────────┘
```

---

## 📊 權限矩陣

| 操作 | ADMIN | MANAGER | DEVELOPER | VIEWER |
|------|-------|---------|-----------|--------|
| 訪問用戶管理頁面 | ✅ | ✅ | ❌ | ❌ |
| 編輯該團隊的 DEV/VIEWER | ✅ | ✅ | ❌ | ❌ |
| 編輯該團隊的 MANAGER | ✅ | ❌ | ❌ | ❌ |
| 編輯該團隊的 ADMIN | ✅ | ❌ | ❌ | ❌ |
| 設置為 ADMIN/MANAGER | ✅ | ❌ | ❌ | ❌ |
| 添加用戶到該團隊 | ✅ | ✅ | ❌ | ❌ |
| 從該團隊移除用戶 | ✅ | ✅ | ❌ | ❌ |

---

## ✅ 解決的所有問題

| 問題 | 當前架構 | Per-Team 架構 |
|------|---------|--------------|
| 跨團隊影響 | ❌ 存在 | ✅ 完全隔離 |
| "all" 特殊處理 | ❌ 複雜 | ✅ 不需要 |
| 團隊交集檢查 | ❌ 複雜 | ✅ 不需要 |
| 錯誤訊息混亂 | ❌ 是 | ✅ 清晰 |
| 補丁邏輯 | ❌ 150+ 行 | ✅ 0 行 |
| 代碼複雜度 | ❌ 高 | ✅ 低 |
| 擴展性 | ❌ 受限 | ✅ 優秀 |

---

## 🚀 未來擴展

### 輕鬆實現的功能

```json
// 1. 時限角色
{
  "teamRoles": {
    "platform-team": {
      "role": "MANAGER",
      "expiresAt": "2025-12-31T23:59:59Z"
    }
  }
}

// 2. 子團隊
{
  "teamRoles": {
    "backend-team": "MANAGER",
    "backend-team/api-squad": "DEVELOPER"
  }
}

// 3. 多角色
{
  "teamRoles": {
    "platform-team": ["MANAGER", "SECURITY_AUDITOR"]
  }
}

// 4. 權限細化
{
  "teamRoles": {
    "platform-team": {
      "role": "MANAGER",
      "permissions": ["read:*", "write:tokens", "delete:own"]
    }
  }
}
```

---

**版本：** v3.0 Per-Team Roles  
**日期：** 2025-10-31  
**架構：** 正規、清晰、無補丁
