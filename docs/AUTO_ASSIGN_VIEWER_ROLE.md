# 自動賦予新用戶 VIEWER 角色

## 問題

當新用戶首次登入時，他們沒有任何 `tokenManager:role`，系統應該自動賦予他們 `VIEWER` 角色。

## 解決方案

### 方案 1：使用 Clerk Webhooks（推薦）

Clerk 可以在用戶創建時發送 webhook，我們在後端接收並自動設定角色。

#### 步驟 1：在 Clerk Dashboard 設定 Webhook

1. 前往 [Clerk Dashboard](https://dashboard.clerk.com)
2. 選擇你的 Application
3. 點擊左側 **"Webhooks"**
4. 點擊 **"Add Endpoint"**
5. **Endpoint URL**: `https://your-backend.com/api/webhooks/clerk`
6. **Message filtering**: 選擇 `user.created`
7. 點擊 **"Create"**
8. 複製 **Signing Secret**（用於驗證請求）

#### 步驟 2：後端實現 Webhook Handler

```python
# backend/main.py

from fastapi import FastAPI, Request, HTTPException, Header
from clerk_backend_api import Clerk
import hmac
import hashlib

app = FastAPI()
clerk = Clerk(bearer_auth="your_secret_key")

CLERK_WEBHOOK_SECRET = "your_webhook_signing_secret"

def verify_webhook(payload: bytes, svix_signature: str) -> bool:
    """驗證 Clerk webhook 簽名"""
    expected_signature = hmac.new(
        CLERK_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_signature, svix_signature)

@app.post("/api/webhooks/clerk")
async def handle_clerk_webhook(
    request: Request,
    svix_id: str = Header(None, alias="svix-id"),
    svix_timestamp: str = Header(None, alias="svix-timestamp"),
    svix_signature: str = Header(None, alias="svix-signature")
):
    # 讀取請求內容
    payload = await request.body()
    
    # 驗證簽名
    if not verify_webhook(payload, svix_signature):
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # 解析事件
    event = await request.json()
    
    # 處理 user.created 事件
    if event["type"] == "user.created":
        user_id = event["data"]["id"]
        
        # 自動賦予 VIEWER 角色
        try:
            clerk.users.update_metadata(
                user_id=user_id,
                public_metadata={
                    "tokenManager:role": "VIEWER",
                    "tokenManager:joinedAt": event["data"]["created_at"]
                }
            )
            print(f"✅ 已自動賦予用戶 {user_id} VIEWER 角色")
        except Exception as e:
            print(f"❌ 設定角色失敗: {e}")
    
    return {"status": "ok"}
```

---

### 方案 2：前端首次登入檢查

如果不想設定 webhook，可以在前端檢查用戶是否有角色，沒有則顯示提示。

#### 更新 ProtectedRoute 組件

```jsx
// frontend/src/components/Auth/ProtectedRoute.jsx

import { useAuth, useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { NAMESPACE } from '../../constants/roles';

export default function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  if (!isLoaded) {
    return <div className="loading">載入中...</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  // 檢查是否有角色
  const hasRole = user?.publicMetadata?.[`${NAMESPACE}:role`];
  
  if (!hasRole) {
    return (
      <div className="section" style={{ 
        maxWidth: '600px', 
        margin: '100px auto',
        textAlign: 'center' 
      }}>
        <h2>🎉 歡迎加入 Token Manager！</h2>
        <p style={{ 
          fontSize: '16px', 
          color: 'var(--text-secondary)',
          marginBottom: '24px' 
        }}>
          你的帳號尚未設定權限。<br/>
          請聯繫管理員為你分配角色。
        </p>
        <div style={{
          background: 'var(--bg-secondary)',
          padding: '20px',
          borderRadius: '12px',
          fontSize: '14px',
          color: 'var(--text-tertiary)'
        }}>
          <p>📧 你的 Email: {user.primaryEmailAddress?.emailAddress}</p>
          <p>🆔 User ID: {user.id}</p>
        </div>
      </div>
    );
  }

  return children;
}
```

---

### 方案 3：混合方案（最推薦）

**結合 Webhook + 前端檢查**

1. **Webhook（自動）**: 新用戶註冊時自動給 VIEWER
2. **前端檢查（保險）**: 如果 webhook 失敗，前端顯示提示

這樣可以確保：
- ✅ 大部分用戶自動獲得 VIEWER 角色
- ✅ 萬一 webhook 失敗，前端也有友好提示
- ✅ 用戶體驗最好

---

## 角色層級

```
新用戶註冊 → 自動 VIEWER
     ↓
ADMIN/MANAGER 提升為 DEVELOPER
     ↓
ADMIN/MANAGER 提升為 MANAGER
     ↓
ADMIN 提升為 ADMIN
```

---

## 測試

### 測試自動賦予角色

1. 創建一個新的測試用戶
2. 登入後檢查 Clerk Dashboard 的 Public Metadata
3. 應該看到：
```json
{
  "tokenManager:role": "VIEWER",
  "tokenManager:joinedAt": "2025-01-15T..."
}
```

### 測試前端提示

1. 手動刪除一個用戶的 `tokenManager:role`
2. 該用戶登入時應該看到「歡迎」提示頁面
3. 設定角色後，用戶可以正常訪問

---

## 安全性注意事項

1. **Webhook 必須驗證簽名**：防止偽造請求
2. **預設給最低權限（VIEWER）**：避免安全風險
3. **由 ADMIN 手動提升權限**：確保權限控制
4. **記錄所有權限變更**：用於審計

---

## 常見問題

### Q: 為什麼預設是 VIEWER 而不是 DEVELOPER？

**A:** 安全原則「最小權限」。VIEWER 只能查看，不能修改任何資源，風險最低。

### Q: 如果我想讓特定 Email domain 的用戶自動成為 DEVELOPER？

**A:** 可以在 webhook handler 中加入邏輯：

```python
@app.post("/api/webhooks/clerk")
async def handle_clerk_webhook(request: Request):
    event = await request.json()
    
    if event["type"] == "user.created":
        user_id = event["data"]["id"]
        email = event["data"]["email_addresses"][0]["email_address"]
        
        # 檢查 Email domain
        if email.endswith("@cryptoxlab.com"):
            role = "DEVELOPER"
            team = "backend-team"
        else:
            role = "VIEWER"
            team = None
        
        clerk.users.update_metadata(
            user_id=user_id,
            public_metadata={
                "tokenManager:role": role,
                "tokenManager:team": team,
                "tokenManager:joinedAt": event["data"]["created_at"]
            }
        )
```

### Q: 用戶註冊後要等多久才能獲得角色？

**A:** 
- Webhook 方式：幾秒內（幾乎即時）
- 前端檢查方式：下次登入時

---

## 總結

推薦使用 **方案 3（混合方案）**：
1. 設定 Clerk Webhook 自動賦予 VIEWER
2. 前端加入檢查和友好提示
3. ADMIN 在用戶管理頁面提升用戶權限

這樣可以確保最佳的用戶體驗和系統安全性。


