# 用戶管理功能設定指南

## 🐛 問題修正

### 問題 1：編輯按鈕樣式不統一 ✅
**已修正**：使用統一的 `btn btn-secondary btn-small` 樣式，移除了 Edit2 圖標

### 問題 2：用戶列表只顯示自己 ✅
**已修正**：前端改為調用後端 API，後端從 Clerk 獲取所有用戶

---

## 🚀 快速設定步驟

### 1. 獲取 Clerk Secret Key

1. 前往 [Clerk Dashboard](https://dashboard.clerk.com)
2. 選擇你的 Application
3. 點擊左側 **"API Keys"**
4. 複製 **Secret Key**（以 `sk_test_` 或 `sk_live_` 開頭）

### 2. 設定後端環境變數

編輯 `backend/.env`：

```bash
# 在檔案末尾加入（或更新）
CLERK_SECRET_KEY=sk_test_你的密鑰
```

### 3. 啟動後端服務

```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

### 4. 啟動前端服務

```bash
cd frontend
npm run dev
```

---

## ✅ 測試功能

### 1. 用 ADMIN 帳號登入

- Email: joey@cryptoxlab.com（你的帳號）
- 應該可以在側邊欄看到「用戶管理」選項

### 2. 進入用戶管理頁面

- 點擊「用戶管理」
- 應該可以看到所有在 Clerk 註冊的用戶
- 包括你自己和其他用戶

### 3. 測試編輯權限

- 點擊「編輯」按鈕
- 選擇角色和團隊
- 點擊「保存」
- 用戶的 metadata 應該會更新

### 4. 測試權限控制

- 用非 ADMIN 帳號登入
- 應該看不到「用戶管理」選項（如果是 VIEWER 或 DEVELOPER）
- MANAGER 可以看到並編輯自己團隊的成員

---

## 📝 API 端點

### GET /api/users
獲取所有用戶列表

**權限**：MANAGER 以上

**響應範例**：
```json
[
  {
    "id": "user_xxx",
    "email_addresses": [
      {
        "email_address": "joey@cryptoxlab.com"
      }
    ],
    "first_name": "Joey",
    "last_name": "Chen",
    "image_url": "https://...",
    "public_metadata": {
      "tokenManager:role": "ADMIN",
      "tokenManager:joinedAt": "2025-01-15T..."
    }
  }
]
```

### PUT /api/users/:id/role
更新用戶角色

**權限**：
- ADMIN：可以更新所有人
- MANAGER：只能更新自己團隊的成員

**請求範例**：
```json
{
  "role": "DEVELOPER",
  "team": "backend-team"
}
```

**響應範例**：
```json
{
  "success": true,
  "user_id": "user_xxx",
  "role": "DEVELOPER",
  "team": "backend-team"
}
```

---

## 🔧 後端實現細節

### 檔案結構

```
backend/
├── main.py              # 主應用，已加入 user_router
├── clerk_auth.py        # Clerk 認證和權限驗證（新增）
├── user_routes.py       # 用戶管理 API（新增）
├── requirements.txt     # 已包含 httpx
└── .env                 # 需要加入 CLERK_SECRET_KEY
```

### 權限檢查流程

```python
# 1. 驗證 Clerk token
user = await verify_clerk_token(authorization_header)

# 2. 檢查權限
if not check_permission(user, "MANAGER"):
    raise HTTPException(403, "Permission denied")

# 3. 執行操作
...
```

---

## 🐛 常見問題排查

### 問題：用戶列表顯示錯誤訊息

**可能原因：**
1. 後端沒有啟動
2. CLERK_SECRET_KEY 沒有設定
3. CLERK_SECRET_KEY 不正確

**解決方法：**
1. 確認後端正在運行：`curl http://localhost:8000/health`
2. 檢查 `backend/.env` 是否有 CLERK_SECRET_KEY
3. 前往 Clerk Dashboard 確認 Secret Key 正確

### 問題：403 Permission denied

**可能原因：**
- 當前用戶沒有足夠權限

**解決方法：**
- 確認你的帳號在 Clerk 的 metadata 中設定為 ADMIN
- 檢查 `tokenManager:role` 是否為 "ADMIN"

### 問題：編輯用戶時失敗

**可能原因：**
1. MANAGER 只能編輯自己團隊的成員
2. Role 或 Team 設定不正確

**解決方法：**
1. 確認目標用戶和你在同一個團隊（如果你是 MANAGER）
2. 確認 MANAGER/DEVELOPER 角色有設定團隊

---

## 📊 測試場景

### 場景 1：ADMIN 管理所有用戶

```
1. 用 ADMIN 帳號登入
2. 進入「用戶管理」
3. 應該看到所有用戶
4. 點擊任何用戶的「編輯」
5. 可以更改為任何角色和團隊
6. 保存成功
```

### 場景 2：MANAGER 管理團隊成員

```
1. 用 MANAGER 帳號登入（例如 backend-team）
2. 進入「用戶管理」
3. 看到所有用戶
4. 只能編輯 backend-team 的成員
5. 嘗試編輯其他團隊的成員 → 403 錯誤
```

### 場景 3：DEVELOPER 無法訪問

```
1. 用 DEVELOPER 帳號登入
2. 側邊欄看不到「用戶管理」選項
3. 直接訪問 /api/users → 403 錯誤
```

---

## ✅ 完成檢查清單

- [ ] 已設定 CLERK_SECRET_KEY
- [ ] 後端服務正常啟動
- [ ] 前端服務正常啟動
- [ ] 用 ADMIN 可以看到所有用戶
- [ ] 用 ADMIN 可以編輯任何用戶
- [ ] 編輯按鈕樣式統一
- [ ] MANAGER 只能編輯自己團隊
- [ ] DEVELOPER/VIEWER 無法訪問用戶管理

---

## 🎉 下一步

完成用戶管理後，建議實現：

1. **TokenManager 權限整合**
   - 根據 `canCreate/canUpdate/canDelete` 顯示按鈕
   - 後端 API 加入權限驗證

2. **RouteManager 權限整合**
   - 同上

3. **審計日誌**
   - 記錄所有權限變更
   - 記錄敏感操作

---

**設定完成後，你的 Token Manager 就有完整的多用戶權限管理功能了！** 🚀


