# Core Team 路由管理實現報告

**日期**: 2025-11-03  
**版本**: v2.1  
**狀態**: ✅ 已完成

---

## 📋 概述

實現了 **Core Team** 專屬路由管理權限系統，將路由管理從無權限控制升級為基於 Core Team 角色的 RBAC 系統。

---

## 🎯 核心設計

### **什麼是 Core Team？**

```yaml
團隊 ID: core-team
團隊名稱: Core Team
圖標: ⚙️
顏色: #8b5cf6 (紫色)
描述: 核心基礎設施團隊 - 負責管理路由、系統設定等核心功能

職責範圍:
  ✅ 路由管理（Routes）
  ✅ 系統基礎設施
  🔮 未來: Rate Limiting
  🔮 未來: IP 白名單
  🔮 未來: 全局安全策略
```

### **為什麼需要 Core Team？**

```
問題: 路由是全局基礎設施，應該由誰管理？

方案 A (全局 ADMIN):
  ❌ 權力過於集中
  ❌ 單點瓶頸
  ❌ 不可擴展

方案 B (團隊擁有路由):
  ❌ 路由碎片化
  ❌ 管理混亂
  ❌ 不適合基礎設施

方案 C (Core Team): ✅
  ✅ 專業分工
  ✅ 權力分散
  ✅ 可擴展
  ✅ 職責清晰
```

---

## 🔐 權限矩陣

### **路由管理權限**

| 操作 | 全局 ADMIN | Core ADMIN | Core MANAGER | Core DEVELOPER | 其他用戶 |
|------|-----------|------------|--------------|----------------|---------|
| 創建路由 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 查看路由 | ✅ | ✅ | ✅ | ✅ | ✅ (所有已登入用戶) |
| 編輯路由 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 刪除路由 | ✅ | ✅ | ❌ | ❌ | ❌ |

### **權限邏輯**

```python
檢查順序:
  1. 是否是全局 ADMIN？ → 允許所有操作
  2. 是否是 Core Team 成員？ → 否 → 拒絕
  3. Core Team 角色是什麼？
     - 創建: ADMIN, MANAGER, DEVELOPER 可以
     - 編輯: ADMIN, MANAGER 可以
     - 刪除: ADMIN only
```

---

## 🔄 實施內容

### **1. 數據庫自動初始化**

**位置**: `backend/database.py` (L187-215)

```python
async def init_system_teams(self, conn):
    """
    初始化系統必需的團隊
    
    執行時機: 每次應用啟動時
    邏輯: 檢查 core-team 是否存在，不存在則創建
    """
    core_team_exists = await conn.fetchval("""
        SELECT EXISTS (
            SELECT 1 FROM teams WHERE id = 'core-team'
        )
    """)
    
    if not core_team_exists:
        await conn.execute("""
            INSERT INTO teams (id, name, description, color, icon, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
        """, 
            'core-team',
            'Core Team',
            '核心基礎設施團隊 - 負責管理路由、系統設定等核心功能',
            '#8b5cf6',
            '⚙️',
            'system'
        )
        print("✅ Core Team created successfully")
```

**優點**:
- ✅ 自動創建，無需手動操作
- ✅ 冪等性（多次執行不會重複創建）
- ✅ 確保系統啟動後 core-team 一定存在

---

### **2. 後端權限檢查函數**

**位置**: `backend/main.py` (L126-160)

```python
async def check_core_team_permission(user: dict, action: str):
    """
    檢查用戶是否有 Core Team 權限來管理路由
    """
    # 1. 全局 ADMIN 優先
    global_role = user.get("public_metadata", {}).get("tokenManager:globalRole")
    if global_role == "ADMIN":
        return
    
    # 2. 檢查 Core Team 角色
    role = get_user_role_in_team(user, "core-team")
    
    if not role:
        raise HTTPException(403, "需要 Core Team 權限才能管理路由")
    
    # 3. 根據操作檢查角色
    if action == "create":
        if role not in ["ADMIN", "MANAGER", "DEVELOPER"]:
            raise HTTPException(403, "需要 ADMIN, MANAGER 或 DEVELOPER 角色")
    elif action == "edit":
        if role not in ["ADMIN", "MANAGER"]:
            raise HTTPException(403, "需要 ADMIN 或 MANAGER 角色")
    elif action == "delete":
        if role != "ADMIN":
            raise HTTPException(403, "只有 ADMIN 可以刪除路由")
```

---

### **3. 路由 API 權限控制**

**所有路由 API 現在都需要認證**:

```python
# 創建路由
@app.post("/api/routes")
async def create_route(data: RouteCreate, request: Request):
    user = await verify_clerk_token(request)
    await check_core_team_permission(user, "create")
    # ...

# 查看路由列表
@app.get("/api/routes")
async def list_routes(request: Request):
    user = await verify_clerk_token(request)  # 需要登入
    # 不檢查 Core Team 權限，所有人都可以看
    # ...

# 編輯路由
@app.put("/api/routes/{route_id}")
async def update_route(route_id: int, data: RouteUpdate, request: Request):
    user = await verify_clerk_token(request)
    await check_core_team_permission(user, "edit")
    # ...

# 刪除路由
@app.delete("/api/routes/{route_id}")
async def delete_route(route_id: int, request: Request):
    user = await verify_clerk_token(request)
    await check_core_team_permission(user, "delete")
    # ...

# 獲取標籤列表
@app.get("/api/routes/tags")
async def list_tags(request: Request):
    user = await verify_clerk_token(request)  # 需要登入
    # ...
```

---

### **4. 前端權限控制**

#### **RouteForm.jsx - 權限檢查**

```jsx
// 檢查用戶是否有 Core Team 權限
const teamRoles = user?.publicMetadata?.['tokenManager:teamRoles'] || {};
const globalRole = user?.publicMetadata?.['tokenManager:globalRole'];
const coreRole = teamRoles['core-team'];

const canCreate = globalRole === 'ADMIN' || 
                  (coreRole && ['ADMIN', 'MANAGER', 'DEVELOPER'].includes(coreRole));

// 如果沒有權限，顯示提示
if (!canCreate) {
  return (
    <div className="alert alert-warning">
      只有 Core Team 的 ADMIN, MANAGER 或 DEVELOPER 可以創建路由。
      請聯繫系統管理員將你加入 Core Team。
    </div>
  );
}
```

#### **RouteList.jsx - 按鈕顯示控制**

```jsx
// 計算權限
const canEdit = globalRole === 'ADMIN' || 
                (coreRole && ['ADMIN', 'MANAGER'].includes(coreRole));
const canDelete = globalRole === 'ADMIN' || (coreRole === 'ADMIN');

// 條件渲染按鈕
{canEdit && <button onClick={handleEdit}>編輯</button>}
{canDelete && <button onClick={handleDelete}>刪除</button>}
{!canEdit && !canDelete && <span>唯讀</span>}
```

---

### **5. API 認證整合**

**所有路由 API 函數都加入認證 token**:

```javascript
// frontend/src/services/api.js

export const createRoute = async (data, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // ...
};

export const listRoutes = async (token) => { /* ... */ };
export const updateRoute = async (id, data, token) => { /* ... */ };
export const deleteRoute = async (id, token) => { /* ... */ };
export const listTags = async (token) => { /* ... */ };
```

---

## 📊 完整權限架構

### **系統角色層級**

```
├─ 全局 ADMIN (globalRole = "ADMIN")
│  └─ 可以管理所有資源
│
├─ Core Team
│  ├─ ADMIN      → 創建/編輯/刪除 路由
│  ├─ MANAGER    → 創建/編輯 路由
│  └─ DEVELOPER  → 創建 路由
│
├─ 業務團隊 (backend-team, frontend-team, etc.)
│  ├─ ADMIN      → 創建/編輯/刪除 該團隊的 Token
│  ├─ MANAGER    → 創建/編輯/刪除 該團隊的 Token
│  ├─ DEVELOPER  → 創建 該團隊的 Token
│  └─ VIEWER     → 查看 該團隊的 Token
│
└─ 資源
   ├─ Token  → 屬於業務團隊
   └─ Route  → 全局資源，由 Core Team 管理
```

---

## 🔧 database.py 詳解

### **database.py 的三大職責**

```python
"""
1. 連接管理 (Connection Management)
   - 創建 asyncpg 連接池
   - 管理連接生命週期
   - 優化性能（連接複用）

2. Schema 初始化 (Schema Initialization)
   - 創建所有表（tokens, routes, teams, audit_logs）
   - 創建索引
   - 創建約束（外鍵、唯一性等）

3. Schema 遷移 (Schema Migration)
   - 檢測舊版本 Schema
   - 自動升級到新版本
   - 確保向後兼容

4. 系統數據初始化 (System Data Initialization)  ← 新增
   - 創建系統必需的團隊（core-team）
   - 確保系統正常運作的基礎數據
"""
```

### **何時執行？**

```python
# main.py
@app.on_event("startup")
async def startup():
    await db.connect()  # ← 觸發 database.py 的所有初始化邏輯
    
執行順序:
  1. 連接到 PostgreSQL
  2. 創建/檢查所有表
  3. 執行 Schema 遷移（如果需要）
  4. 初始化系統團隊（core-team）
  5. 應用就緒 ✅
```

### **為什麼要在 database.py 中創建 core-team？**

```yaml
優點:
  ✅ 自動化：每次部署都自動確保 core-team 存在
  ✅ 冪等性：不會重複創建
  ✅ 依賴保證：應用啟動後 core-team 一定存在
  ✅ 零人工介入：不需要手動執行 SQL
  ✅ 環境一致性：開發/測試/生產環境都自動創建

手動創建的問題:
  ❌ 容易忘記
  ❌ 環境不一致
  ❌ 部署失敗風險
  ❌ 需要額外文檔說明

結論: database.py 是正確的位置！
```

---

## 📝 使用流程

### **1. 系統初始化**

```bash
# 啟動後端
cd backend
uvicorn main:app --reload

# 控制台輸出
✅ Database connected
🔄 Creating system team: core-team...
✅ Core Team created successfully
✅ Database tables initialized
```

### **2. 添加用戶到 Core Team**

```
方法 1: 用戶管理界面
  1. 以全局 ADMIN 身份登入
  2. 進入「用戶管理」
  3. 找到目標用戶，點擊「編輯」
  4. 添加團隊角色: core-team → ADMIN/MANAGER/DEVELOPER
  5. 保存

方法 2: 邀請新用戶時直接分配
  1. 點擊「邀請用戶」
  2. 選擇團隊: ☑ Core Team → ADMIN
  3. 發送邀請
```

### **3. 管理路由**

```
Core Team 成員登入後:

創建路由:
  1. 進入「路由管理」
  2. 點擊「新增路由」（如果看到此按鈕表示有權限）
  3. 填寫路由信息
  4. 創建成功

編輯路由:
  - ADMIN, MANAGER 可以看到「編輯」按鈕
  - DEVELOPER 只能查看

刪除路由:
  - 只有 ADMIN 可以看到「刪除」按鈕
```

### **4. 非 Core Team 成員**

```
其他用戶登入後:

查看路由:
  ✅ 可以看到所有路由列表
  ✅ 可以在 Token 創建時選擇路由/標籤

創建路由:
  ❌ 看到提示: "需要 Core Team 權限"
  ❌ 創建表單不顯示

編輯/刪除路由:
  ❌ 按鈕不顯示
  ❌ 顯示「唯讀」標籤
```

---

## 🔧 技術實現

### **後端變更**

```
檔案: backend/database.py
  + init_system_teams() 函數
  + 自動創建 core-team

檔案: backend/main.py
  + check_core_team_permission() 函數
  + 所有路由 API 添加權限檢查
  + 所有路由 API 需要 Request 參數（認證）
```

### **前端變更**

```
檔案: frontend/src/services/api.js
  + 所有路由 API 函數添加 token 參數
  + 在 headers 中發送 Authorization

檔案: RouteForm.jsx
  + 權限檢查邏輯
  + 無權限時顯示提示訊息
  + 使用 useAuth 獲取 token

檔案: RouteList.jsx
  + 權限檢查（canEdit, canDelete）
  + 條件渲染按鈕
  + 使用 useAuth 獲取 token

檔案: EditRouteModal.jsx
  + 使用 useAuth 獲取 token

檔案: ScopeSelector.jsx
  + 使用 useAuth 獲取 token
```

---

## 🎨 UI 變化

### **有 Core Team 權限的用戶**

```
路由管理頁面:
  ┌────────────────────────────────┐
  │ [+ 新增路由]                   │ ← 按鈕可見
  ├────────────────────────────────┤
  │ ID | 名稱 | 路徑 | 操作        │
  │ 1  | API  | /api | [編輯][刪除]│ ← 按鈕可見
  └────────────────────────────────┘
```

### **沒有 Core Team 權限的用戶**

```
路由管理頁面:
  ┌────────────────────────────────┐
  │ ⚠️ 需要 Core Team 權限          │
  │ 只有 Core Team 的 ADMIN,       │
  │ MANAGER 或 DEVELOPER           │
  │ 可以創建路由                    │
  ├────────────────────────────────┤
  │ ID | 名稱 | 路徑 | 操作        │
  │ 1  | API  | /api | 唯讀        │ ← 顯示唯讀
  └────────────────────────────────┘
```

---

## ✅ 測試檢查清單

### **權限測試**

- [x] Core Team ADMIN 可以創建/編輯/刪除路由
- [x] Core Team MANAGER 可以創建/編輯路由（不能刪除）
- [x] Core Team DEVELOPER 可以創建路由（不能編輯/刪除）
- [x] 非 Core Team 成員無法創建/編輯/刪除路由
- [x] 所有已登入用戶都可以查看路由
- [x] 未登入用戶無法訪問任何路由 API

### **系統測試**

- [x] 首次啟動自動創建 core-team
- [x] 再次啟動不會重複創建 core-team
- [x] core-team 在團隊列表中可見
- [x] 可以將用戶添加到 core-team
- [x] 全局 ADMIN 可以管理所有路由（無需 Core Team 角色）

### **UI 測試**

- [x] 有權限的用戶看到「新增路由」按鈕
- [x] 無權限的用戶看到權限提示訊息
- [x] 編輯/刪除按鈕根據權限顯示/隱藏
- [x] 無權限時顯示「唯讀」標籤

---

## 🚀 部署注意事項

### **首次部署**

```bash
1. 部署新版本後端
   - database.py 會自動創建 core-team
   - 檢查控制台輸出確認創建成功

2. 添加初始 Core Team 成員
   - 以全局 ADMIN 身份登入
   - 將自己或指定人員加入 core-team
   - 分配適當角色（ADMIN/MANAGER/DEVELOPER）

3. 測試權限
   - 以 Core Team 成員身份登入
   - 測試創建/編輯/刪除路由
   - 確認權限正確
```

### **現有環境升級**

```
無需任何手動操作！

系統啟動時自動:
  1. 檢查 core-team 是否存在
  2. 不存在則創建
  3. 繼續正常啟動

注意:
  - 原有路由不受影響
  - 只是添加了權限控制
  - 舊用戶需要加入 core-team 才能管理路由
```

---

## 📊 與 Token 管理的對比

| 特性 | Token 管理 | 路由管理 |
|------|-----------|---------|
| **資源所有權** | 屬於業務團隊 | 全局資源 |
| **管理權限** | 團隊 ADMIN/MANAGER | Core Team ADMIN/MANAGER |
| **創建權限** | 團隊 ADMIN/MANAGER/DEVELOPER | Core Team ADMIN/MANAGER/DEVELOPER |
| **刪除權限** | 團隊 ADMIN/MANAGER | Core Team ADMIN only |
| **查看權限** | 只能看所屬團隊的 | 所有人都可以看 |
| **team_id 欄位** | ✅ 必填 | ❌ 不需要 |

---

## 🔮 未來擴展

### **Core Team 可管理的其他功能**

```yaml
已實現:
  ✅ 路由管理

未來可擴展:
  🔮 系統設定
     - API Rate Limiting
     - 全局 IP 白名單
     - 系統維護模式
  
  🔮 安全策略
     - Token 過期策略
     - 密碼複雜度要求
     - 登入安全設定
  
  🔮 監控告警
     - 系統健康監控
     - 異常流量告警
     - 錯誤日誌管理
```

---

## 📝 總結

### **設計優勢**

✅ **職責分離**: Core Team 管理基礎設施，業務團隊管理業務資源  
✅ **權限清晰**: 基於角色的多層級權限控制  
✅ **可擴展**: Core Team 概念可擴展到其他系統功能  
✅ **自動化**: 系統自動創建和初始化  
✅ **安全性**: 所有操作都需要認證和授權  

### **架構正規性**

這是**企業級 RBAC 系統**的標準實踐：
1. ✅ 基於角色的訪問控制
2. ✅ 最小權限原則
3. ✅ 職責分離原則
4. ✅ 審計追蹤能力

---

**文件版本**: 1.0  
**最後更新**: 2025-11-03  
**實施者**: AI Team

