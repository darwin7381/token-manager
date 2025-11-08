# Per-Team Roles 架構完整分析報告

## 📋 執行摘要

**結論先行：** 建議採用 Per-Team Roles 架構，預計需要 **3-4 小時**重構，可徹底解決當前所有補丁問題，並提供完美的團隊隔離。

---

## 1️⃣ 當前架構 vs Per-Team Roles 架構

### 當前架構（Global Role + Teams Scope）

**Metadata 結構：**
```json
{
  "tokenManager:role": "MANAGER",
  "tokenManager:teams": ["platform-team", "backend-team"]
}
```

**含義：** 這個人在所有地方都是 MANAGER，範圍涵蓋 platform-team 和 backend-team

**問題：**
```
Platform MANAGER 編輯 Multi-team MANAGER
→ 改變 "role": "MANAGER" → "VIEWER"
→ 影響所有團隊（platform, backend, frontend）
→ 跨團隊影響 ❌
```

---

### Per-Team Roles 架構

**Metadata 結構：**
```json
{
  "tokenManager:teamRoles": {
    "platform-team": "MANAGER",
    "backend-team": "DEVELOPER",
    "frontend-team": "VIEWER"
  }
}
```

**含義：** 這個人在 Platform 是 MANAGER，在 Backend 是 DEVELOPER，在 Frontend 是 VIEWER

**優勢：**
```
Platform MANAGER 編輯 Carla
→ 只能改 "platform-team": "MANAGER" → "VIEWER"
→ backend-team 和 frontend-team 完全不受影響
→ 完美隔離 ✅
```

---

## 2️⃣ 代碼差距分析

### 需要修改的檔案清單

| 檔案 | 當前行數 | 需要修改的部分 | 預估工作量 |
|------|---------|--------------|----------|
| `backend/user_routes.py` | 160 | 完全重寫驗證邏輯 | 1 小時 |
| `backend/clerk_auth.py` | 132 | 重寫 helper 函數 | 30 分鐘 |
| `frontend/src/hooks/usePermissions.js` | 237 | 重寫所有權限檢查 | 1 小時 |
| `frontend/src/components/UserManagement/EditUserModal.jsx` | 327 | 重新設計 UI 邏輯 | 1 小時 |
| `frontend/src/components/UserManagement/UserManagement.jsx` | 313 | 調整顯示邏輯 | 30 分鐘 |
| `frontend/src/constants/roles.js` | 197 | 無需修改 | 0 |
| **總計** | | | **~4 小時** |

---

## 3️⃣ 詳細代碼對比

### A. Metadata 結構變更

#### 當前（Global Role）
```json
{
  "tokenManager:role": "MANAGER",
  "tokenManager:teams": ["platform-team", "backend-team"]
}
```

#### 新架構（Per-Team Roles）
```json
{
  "tokenManager:teamRoles": {
    "platform-team": "MANAGER",
    "backend-team": "DEVELOPER"
  }
}
```

**差異：** 從「一個角色+多個團隊」變成「每個團隊一個角色」

---

### B. 後端驗證邏輯變更

#### 當前邏輯（~60 行，複雜）
```python
# 當前需要的檢查
1. 檢查 current_role in ["ADMIN", "MANAGER"]
2. 檢查 target_role 不是 ADMIN
3. 檢查 data.role 不是 ADMIN
4. 檢查 current_teams
5. 檢查 target_teams  
6. 檢查團隊交集（has_intersection）
7. 檢查 "all" 的特殊邏輯
8. 檢查每個 team in data.teams
9. ...一堆補丁邏輯
```

#### 新架構邏輯（~30 行，清晰）
```python
@router.put("/{user_id}/team-role")
async def update_team_role(
    user_id: str,
    team_id: str,  # ← 明確指定要改哪個團隊
    new_role: str,
    current_user = Depends(verify_clerk_token)
):
    # 1. 獲取當前用戶在該團隊的角色
    my_role_in_team = get_user_role_in_team(current_user, team_id)
    
    # 2. 我必須在這個團隊
    if not my_role_in_team:
        raise HTTPException(403, "You are not in this team")
    
    # 3. 我必須是 ADMIN 或 MANAGER
    if my_role_in_team not in ["ADMIN", "MANAGER"]:
        raise HTTPException(403, "Only ADMIN/MANAGER can manage team members")
    
    # 4. 獲取目標用戶在該團隊的角色
    target_role_in_team = get_user_role_in_team(target_user, team_id)
    
    # 5. MANAGER 不能編輯 ADMIN 或 MANAGER
    if my_role_in_team == "MANAGER" and new_role in ["ADMIN", "MANAGER"]:
        raise HTTPException(403, "MANAGER cannot set ADMIN/MANAGER roles")
    
    if my_role_in_team == "MANAGER" and target_role_in_team in ["ADMIN", "MANAGER"]:
        raise HTTPException(403, "MANAGER cannot edit ADMIN/MANAGER")
    
    # 6. 更新該團隊的角色
    teamRoles = target_metadata.get("tokenManager:teamRoles", {})
    teamRoles[team_id] = new_role
    updated_metadata["tokenManager:teamRoles"] = teamRoles
    
    clerk_client.users.update_metadata(user_id, public_metadata=updated_metadata)
    
    return {"success": True}
```

**代碼行數減少：60 行 → 30 行 (減少 50%)**

---

### C. 前端 Hook 變更

#### 當前邏輯（複雜）
```javascript
// 需要處理的特殊情況
1. userRole (全局)
2. userTeams (陣列)
3. hasTeamIntersection (複雜函數)
4. "all" 的特殊處理
5. canEditUser (檢查全局角色 + 團隊交集)
```

#### 新架構邏輯（簡單）
```javascript
// 獲取用戶在某團隊的角色
const getUserRoleInTeam = (teamId) => {
  const teamRoles = user?.publicMetadata?.['tokenManager:teamRoles'] || {};
  return teamRoles[teamId] || null;
};

// 檢查能否編輯某用戶在某團隊的角色
const canEditUserInTeam = (targetUser, teamId) => {
  const myRole = getUserRoleInTeam(teamId);
  const targetRole = targetUser.publicMetadata?.['tokenManager:teamRoles']?.[teamId];
  
  if (!myRole) return false;
  if (myRole !== 'ADMIN' && myRole !== 'MANAGER') return false;
  if (myRole === 'MANAGER' && (targetRole === 'ADMIN' || targetRole === 'MANAGER')) {
    return false;
  }
  
  return true;
};

// 獲取我的所有團隊
const getMyTeams = () => {
  const teamRoles = user?.publicMetadata?.['tokenManager:teamRoles'] || {};
  return Object.keys(teamRoles);
};
```

**不再需要：**
- ❌ hasTeamIntersection
- ❌ "all" 的特殊處理  
- ❌ 複雜的團隊檢查

---

### D. UI 變更

#### 當前 UI
```
編輯用戶：

角色：[▼ MANAGER]

團隊（多選）：
☑ Platform Team
☐ Backend Team  
☐ Frontend Team
```

**問題：** 改變角色會影響所有選中的團隊

#### 新 UI
```
編輯用戶：

你可以管理的團隊：

┌─ Platform Team ───────────────────┐
│ 目前角色：MANAGER                 │
│ 新角色：[▼ DEVELOPER]             │
│ [更新]                            │
└───────────────────────────────────┘

┌─ Backend Team ────────────────────┐
│ 目前角色：DEVELOPER               │
│ (你不在此團隊，無法編輯)          │
└───────────────────────────────────┘

┌─ Frontend Team ───────────────────┐
│ 目前角色：VIEWER                  │
│ (你不在此團隊，無法編輯)          │
└───────────────────────────────────┘

[+ 添加到新團隊]
```

**優勢：**
- ✅ 清楚顯示每個團隊的角色
- ✅ 只能編輯有權限的團隊
- ✅ 一目了然

---

## 4️⃣ 能解決的補丁清單

| # | 當前補丁邏輯 | Per-Team 架構 |
|---|------------|--------------|
| 1 | "all" 的特殊處理（多處 if 判斷）| ❌ 不需要！"all" 只是 UI 便利 |
| 2 | hasTeamIntersection 函數 | ❌ 不需要！直接看團隊 |
| 3 | MANAGER with "all" 的特殊邏輯 | ❌ 不需要！ |
| 4 | 團隊交集檢查 | ❌ 不需要！ |
| 5 | 跨團隊影響的錯誤訊息 | ❌ 不會發生！ |
| 6 | "你不在 backend-team" 的奇怪錯誤 | ❌ 不會發生！ |
| 7 | MANAGER 能否用 "all" 的爭議 | ❌ 不需要討論！ |
| 8 | 全局角色 vs 團隊角色的概念混亂 | ❌ 只有團隊角色！ |

**移除的補丁代碼行數：~150 行**

---

## 5️⃣ 未來擴展性分析

### 當前架構的擴展限制

| 需求 | 當前架構 | 難度 |
|------|---------|------|
| 一個人在不同團隊有不同角色 | ❌ 做不到 | 無法實現 |
| 細粒度的團隊權限控制 | ⚠️ 需要大量補丁 | 非常困難 |
| 添加子團隊（嵌套團隊）| ❌ 架構不支持 | 需要重構 |
| 臨時權限（時限角色）| ⚠️ 需要額外欄位 | 中等 |
| 跨團隊協作（一個資源多團隊）| ⚠️ 複雜 | 困難 |

### Per-Team Roles 的擴展能力

| 需求 | Per-Team 架構 | 難度 |
|------|--------------|------|
| 一個人在不同團隊有不同角色 | ✅ 原生支持 | 零成本 |
| 細粒度的團隊權限控制 | ✅ 直接實現 | 簡單 |
| 添加子團隊（嵌套團隊）| ✅ 容易擴展 | 中等 |
| 臨時權限（時限角色）| ✅ 每團隊獨立設定 | 簡單 |
| 跨團隊協作 | ✅ 資源可屬於多團隊 | 簡單 |

**未來可能的需求：**
```json
// 子團隊支持
{
  "tokenManager:teamRoles": {
    "backend-team": "MANAGER",
    "backend-team/api-squad": "DEVELOPER"  // 子團隊
  }
}

// 時限角色
{
  "tokenManager:teamRoles": {
    "platform-team": {
      "role": "MANAGER",
      "expiresAt": "2025-12-31T23:59:59Z"
    }
  }
}

// 多角色（未來）
{
  "tokenManager:teamRoles": {
    "platform-team": ["MANAGER", "SECURITY_AUDITOR"]
  }
}
```

---

## 6️⃣ 重構工作量詳細分解

### Phase 1: 後端重構（1.5 小時）

#### 檔案 1: `backend/clerk_auth.py` (30 分鐘)
```python
# 新增函數
def get_user_role_in_team(user: Dict[str, Any], team_id: str) -> Optional[str]:
    """獲取用戶在特定團隊的角色"""
    team_roles = user.get("public_metadata", {}).get(f"{NAMESPACE}:teamRoles", {})
    return team_roles.get(team_id)

def get_user_teams(user: Dict[str, Any]) -> list[str]:
    """獲取用戶所在的所有團隊"""
    team_roles = user.get("public_metadata", {}).get(f"{NAMESPACE}:teamRoles", {})
    return list(team_roles.keys())

def get_highest_role(user: Dict[str, Any]) -> str:
    """獲取用戶的最高角色（用於頁面訪問控制）"""
    team_roles = user.get("public_metadata", {}).get(f"{NAMESPACE}:teamRoles", {})
    roles = team_roles.values()
    
    hierarchy = ["VIEWER", "DEVELOPER", "MANAGER", "ADMIN"]
    highest = "VIEWER"
    
    for role in roles:
        if role in hierarchy:
            if hierarchy.index(role) > hierarchy.index(highest):
                highest = role
    
    return highest
```

#### 檔案 2: `backend/user_routes.py` (1 小時)
```python
class UpdateTeamRoleRequest(BaseModel):
    team_id: str  # ← 明確指定要改哪個團隊
    role: str

@router.put("/{user_id}/team-role")
async def update_team_role(
    user_id: str,
    data: UpdateTeamRoleRequest,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """更新用戶在特定團隊的角色"""
    
    # 1. 獲取當前用戶在該團隊的角色
    my_role = get_user_role_in_team(current_user, data.team_id)
    
    if not my_role:
        raise HTTPException(403, f"You are not a member of {data.team_id}")
    
    if my_role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(403, "Only ADMIN/MANAGER can manage team members")
    
    # 2. 獲取目標用戶在該團隊的角色
    target_user = clerk_client.users.get(user_id)
    target_role = get_user_role_in_team(dict(target_user.public_metadata), data.team_id)
    
    # 3. MANAGER 限制
    if my_role == "MANAGER":
        if data.role in ["ADMIN", "MANAGER"]:
            raise HTTPException(403, "MANAGER cannot assign ADMIN/MANAGER roles")
        if target_role in ["ADMIN", "MANAGER"]:
            raise HTTPException(403, "MANAGER cannot edit ADMIN/MANAGER")
    
    # 4. 更新該團隊的角色
    teamRoles = dict(target_user.public_metadata or {}).get("tokenManager:teamRoles", {})
    teamRoles[data.team_id] = data.role
    
    updated_metadata = dict(target_user.public_metadata or {})
    updated_metadata["tokenManager:teamRoles"] = teamRoles
    
    clerk_client.users.update_metadata(user_id, public_metadata=updated_metadata)
    
    return {"success": True, "team_id": data.team_id, "role": data.role}

# 新增：添加用戶到團隊
@router.post("/{user_id}/team-membership")
async def add_to_team(user_id, team_id, role, current_user):
    # 檢查當前用戶在該團隊的權限
    # 添加用戶到該團隊
    pass

# 新增：從團隊移除用戶
@router.delete("/{user_id}/team-membership/{team_id}")
async def remove_from_team(user_id, team_id, current_user):
    # 移除用戶在該團隊的角色
    pass
```

**變更：**
- ✅ 邏輯從 60 行 → 30 行
- ✅ 不再需要團隊交集檢查
- ✅ 不再需要 "all" 特殊處理
- ✅ 每個操作明確指定團隊

---

### C. 前端 Hook 變更

#### 當前 Hook（複雜）
```javascript
const userRole = user?.publicMetadata?.['tokenManager:role'];  // 全局
const userTeams = user?.publicMetadata?.['tokenManager:teams']; // 陣列
const hasTeamIntersection = (teams1, teams2) => { /* 複雜邏輯 */ };
const canEditUser = (targetUser) => { /* 檢查全局角色+團隊交集 */ };
```

#### 新 Hook（簡單）
```javascript
const getUserRoleInTeam = (teamId) => {
  const teamRoles = user?.publicMetadata?.['tokenManager:teamRoles'] || {};
  return teamRoles[teamId] || null;
};

const getMyTeams = () => {
  const teamRoles = user?.publicMetadata?.['tokenManager:teamRoles'] || {};
  return Object.keys(teamRoles);
};

const getHighestRole = () => {
  const teamRoles = user?.publicMetadata?.['tokenManager:teamRoles'] || {};
  const roles = Object.values(teamRoles);
  const hierarchy = ['VIEWER', 'DEVELOPER', 'MANAGER', 'ADMIN'];
  
  let highest = 'VIEWER';
  roles.forEach(role => {
    if (hierarchy.indexOf(role) > hierarchy.indexOf(highest)) {
      highest = role;
    }
  });
  
  return highest;
};

const canEditUserInTeam = (targetUser, teamId) => {
  const myRole = getUserRoleInTeam(teamId);
  const targetRole = targetUser.publicMetadata?.['tokenManager:teamRoles']?.[teamId];
  
  if (!myRole || !['ADMIN', 'MANAGER'].includes(myRole)) return false;
  if (myRole === 'MANAGER' && ['ADMIN', 'MANAGER'].includes(targetRole)) return false;
  
  return true;
};
```

**變更：**
- ✅ 移除 hasTeamIntersection
- ✅ 移除 "all" 處理
- ✅ 邏輯更清晰直接

---

### D. UI 組件變更

#### 當前 UI（單一角色選擇器）
```jsx
<select value={role} onChange={setRole}>
  <option>ADMIN</option>
  <option>MANAGER</option>
  ...
</select>

<div>團隊（多選）</div>
{teams.map(team => <checkbox />)}

<button onClick={save}>保存</button>  // 一次保存角色+所有團隊
```

#### 新 UI（每團隊獨立管理）
```jsx
{myTeams.map(teamId => {
  const canEdit = canEditUserInTeam(user, teamId);
  const currentRole = user.publicMetadata.teamRoles[teamId];
  
  return (
    <TeamRoleEditor
      teamId={teamId}
      currentRole={currentRole}
      canEdit={canEdit}
      onUpdate={(newRole) => updateTeamRole(user.id, teamId, newRole)}
    />
  );
})}

<button onClick={() => addUserToTeam()}>添加到新團隊</button>
```

**UI 工作量：**
- 需要重新設計 EditUserModal 組件
- 需要創建 TeamRoleEditor 子組件
- 預估：1 小時

---

## 7️⃣ "all" 的處理方式

### 當前架構的 "all" 問題
```
"all" 作為一個團隊 ID 存在
→ 需要特殊判斷
→ 需要展開邏輯
→ 需要互斥邏輯
→ 複雜
```

### Per-Team 架構的 "all" 處理

**方案 A：UI 便利功能（推薦）**
```javascript
// 當用戶在 UI 選擇 "全選所有團隊" 時
const handleSelectAll = () => {
  const allTeamIds = ['platform-team', 'backend-team', 'frontend-team', 'data-team', 'devops-team'];
  const roleForAllTeams = selectedRole;
  
  const teamRoles = {};
  allTeamIds.forEach(teamId => {
    teamRoles[teamId] = roleForAllTeams;
  });
  
  // 存成每個團隊都有該角色
  // 不存 "all"，而是展開成實際的團隊列表
};
```

**存儲結果：**
```json
{
  "tokenManager:teamRoles": {
    "platform-team": "MANAGER",
    "backend-team": "MANAGER",
    "frontend-team": "MANAGER",
    "data-team": "MANAGER",
    "devops-team": "MANAGER"
  }
}
```

**優勢：**
- ✅ 不需要任何特殊處理
- ✅ 邏輯一致
- ✅ "all" 只是 UI 的便利功能

**方案 B：保留 "all" 標記**
```json
{
  "tokenManager:globalRole": "MANAGER",  // 標記為全局
  "tokenManager:teamRoles": {}  // 空 = 使用全局角色
}
```

- ⚠️ 又回到了全局角色概念
- ❌ 不推薦

**推薦：方案 A（UI 展開，不存 "all"）**

---

## 8️⃣ 遷移計劃

### 第一步：數據遷移腳本
```python
async def migrate_to_per_team_roles():
    """將現有用戶遷移到 Per-Team Roles"""
    users = clerk_client.users.list()
    
    for user in users:
        metadata = user.public_metadata or {}
        
        # 獲取舊數據
        old_role = metadata.get('tokenManager:role')
        old_teams = metadata.get('tokenManager:teams', [])
        
        if not old_role or not old_teams:
            continue
        
        # 轉換為新結構
        team_roles = {}
        for team in old_teams:
            if team == 'all':
                # "all" 展開為所有團隊
                all_teams = ['platform-team', 'backend-team', 'frontend-team', 'data-team', 'devops-team']
                for t in all_teams:
                    team_roles[t] = old_role
            else:
                team_roles[team] = old_role
        
        # 更新 metadata
        new_metadata = metadata.copy()
        new_metadata['tokenManager:teamRoles'] = team_roles
        
        # 移除舊欄位
        new_metadata.pop('tokenManager:role', None)
        new_metadata.pop('tokenManager:teams', None)
        new_metadata.pop('tokenManager:team', None)
        
        clerk_client.users.update_metadata(user.id, public_metadata=new_metadata)
        print(f"✅ Migrated {user.id}")
```

### 第二步：分階段部署
1. 部署新後端（支援兩種格式）
2. 執行遷移腳本
3. 部署新前端
4. 驗證
5. 移除舊代碼

---

## 9️⃣ 風險評估

| 風險 | 嚴重度 | 緩解措施 |
|------|--------|---------|
| 數據遷移失敗 | 高 | 備份 + 分批遷移 + 回滾計劃 |
| 用戶體驗變化太大 | 中 | UI 清晰說明 + 文檔 |
| 開發時間超出預期 | 中 | 詳細的實現計劃 |
| 新 Bug | 中 | 完整測試計劃 |

---

## 🔟 實現時間表

| 階段 | 任務 | 時間 |
|------|------|------|
| 1 | 後端 Helper 函數 | 30 分鐘 |
| 2 | 後端 API 重寫 | 1 小時 |
| 3 | 前端 Hook 重寫 | 1 小時 |
| 4 | 前端 UI 重新設計 | 1 小時 |
| 5 | 測試 + 修復 | 30 分鐘 |
| 6 | 數據遷移腳本 | 30 分鐘 |
| **總計** | | **4.5 小時** |

---

## 1️⃣1️⃣ 最終對比表

| 維度 | 當前架構 | Per-Team Roles |
|------|---------|---------------|
| **核心概念** | 全局角色+團隊範圍 | 每團隊獨立角色 |
| **代碼複雜度** | 高（補丁多） | 低（邏輯清晰）|
| **跨團隊影響** | ❌ 存在 | ✅ 完全隔離 |
| **"all" 處理** | 需要特殊邏輯 | UI 展開，無特殊處理 |
| **擴展性** | 受限 | 優秀 |
| **維護成本** | 高（持續打補丁）| 低（邏輯穩定）|
| **學習曲線** | 中（概念混亂）| 低（概念清晰）|
| **業界標準** | ⚠️ 混合模式 | ✅ 標準模式 |
| **重構成本** | - | 4.5 小時 |

---

## 1️⃣2️⃣ 建議

### 如果採用 Per-Team Roles：

**優點：**
- ✅ 一勞永逸解決所有問題
- ✅ 不再需要打補丁
- ✅ 未來擴展容易
- ✅ 代碼清晰易維護
- ✅ 符合 90% SaaS 的標準做法

**缺點：**
- ⚠️ 需要 4.5 小時重構
- ⚠️ UI 變化較大
- ⚠️ 需要數據遷移

### 如果不採用：

**需要接受：**
- ❌ Platform MANAGER 降級 Carla 會影響所有團隊
- ❌ 需要添加 "MANAGER 不能編輯 MANAGER" 規則
- ❌ "all" 仍需特殊處理
- ❌ 代碼會繼續累積補丁
- ⚠️ 未來擴展困難

**小修補方案（30 分鐘）：**
```python
# 只加一行
if current_role == "MANAGER" and target_role == "MANAGER":
    raise HTTPException(403, "MANAGER cannot edit MANAGER")
```

但這只是治標，根本問題（跨團隊影響）仍存在。

---

## 1️⃣3️⃣ 我的建議

**採用 Per-Team Roles 架構。**

**理由：**
1. 4.5 小時的投資換來長期的清晰架構
2. 徹底解決跨團隊影響問題
3. 移除所有補丁邏輯
4. 未來擴展性優秀
5. 符合業界標準（90% SaaS 都這樣做）

**您已經花了 10+ 小時在打補丁上，再花 4.5 小時徹底解決值得。**

---

**決策權在您，請告訴我：**
- [ ] A. 採用 Per-Team Roles（4.5 小時重構）
- [ ] B. 不採用，加簡單限制（30 分鐘）

我等您的決定。

