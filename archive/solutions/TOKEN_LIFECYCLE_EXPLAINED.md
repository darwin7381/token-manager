# Token 生命週期完整解析

**日期**: 2025-11-03  
**目的**: 詳細說明 Token 的產生、儲存、使用和安全機制

---

## 🔑 問題 2: Token 是怎麼產生的？

### **Token 生成流程**

```python
# backend/main.py (L70-77)

def generate_token() -> str:
    """生成安全的 API Token"""
    return f"ntk_{secrets.token_urlsafe(32)}"

# 實際執行:
secrets.token_urlsafe(32)
  ↓ 生成 32 bytes 的隨機數據
  ↓ Base64-URL-safe 編碼
  ↓ 產生 43 個字符的隨機字串
  ↓ 加上前綴 "ntk_"
  ↓ 最終 Token: "ntk_cwpwHGVxqRx7G7hzZhWIIv5nlP1pjWehqaJz2ORnckg"
```

### **為什麼用 secrets 模組？**

```python
import secrets  # ← 加密安全的隨機數生成器

# ❌ 不安全
import random
token = random.random()  # 可預測，不安全！

# ✅ 安全
import secrets
token = secrets.token_urlsafe(32)  # 不可預測，安全

secrets 模組:
  ✅ 使用作業系統的 /dev/urandom (Unix) 或 CryptGenRandom (Windows)
  ✅ 加密安全的隨機數生成
  ✅ 適用於密碼、Token、API Key
  ✅ 符合 OWASP 安全標準
```

### **Token 格式**

```
ntk_cwpwHGVxqRx7G7hzZhWIIv5nlP1pjWehqaJz2ORnckg
 ↑   ↑
 |   └─ 43 個字符的隨機字串 (Base64-URL-safe)
 |
 └─ 前綴 "ntk_" (代表 "n8n token" 或自訂意義)

總長度: 47 個字符
熵值: 32 bytes = 256 bits
安全性: 2^256 種可能 (天文數字，暴力破解不可行)
```

---

## 💾 Token 儲存在哪裡？

### **儲存層級**

```yaml
第 1 層: PostgreSQL (主資料庫)
  位置: tokens 表
  儲存內容:
    ✅ token_hash (SHA256 hash)
    ❌ token 明文 (不儲存)
  
  用途: 管理、審計、權限控制

第 2 層: Cloudflare KV (邊緣快取)
  位置: Key-Value 儲存
  Key: "token:{hash}"
  Value: { name, team_id, scopes, expires_at }
  
  用途: Worker 快速驗證（全球分佈）

第 3 層: 用戶手中 (實際使用)
  位置: n8n workflow 配置
  用途: 調用 API
```

### **PostgreSQL 詳細結構**

```sql
tokens 表:
  id              SERIAL PRIMARY KEY
  token_hash      VARCHAR(64)        -- SHA256 hash
  name            VARCHAR(255)       -- Token 名稱
  team_id         VARCHAR(50)        -- 所屬團隊
  created_by      VARCHAR(100)       -- 創建者
  description     TEXT               -- 描述/筆記 (新增)
  scopes          TEXT[]             -- 權限範圍
  created_at      TIMESTAMP          -- 創建時間
  expires_at      TIMESTAMP          -- 過期時間
  last_used       TIMESTAMP          -- 最後使用時間
  is_active       BOOLEAN            -- 是否啟用

範例數據:
  id: 11
  token_hash: "a3f2b1c9d8e7f6..."  ← SHA256("ntk_cwpw...")
  name: "n8n-workflow-token"
  team_id: "backend-team"
  description: "用於處理圖片上傳的 n8n 工作流"
  scopes: ["*"]
  created_at: "2025-11-03 10:00:00"
  expires_at: NULL                   ← 永不過期
  is_active: TRUE
```

### **Cloudflare KV 結構**

```javascript
// Key
"token:a3f2b1c9d8e7f6..."

// Value
{
  "name": "n8n-workflow-token",
  "team_id": "backend-team",
  "scopes": ["*"],
  "created_at": "2025-11-03T10:00:00Z",
  "expires_at": null
}

// Worker 驗證流程
1. 收到請求，提取 X-API-Key header
2. 計算 SHA256 hash
3. 查詢 KV: `token:{hash}`
4. 如果找到 → 檢查過期時間 → 檢查 scopes → 允許
5. 如果沒找到 → 返回 401
```

---

## ⏰ Token 過期時間控制

### **三個層級的時間控制**

```python
# 1. 創建時設定
POST /api/tokens
{
  "expires_days": 90    → 90 天後過期
  "expires_days": null  → 永不過期
}

# 2. 資料庫儲存
expires_at = NOW() + INTERVAL '90 days'  → 2026-02-01
expires_at = NULL                         → 永不過期

# 3. Worker 驗證
if (tokenData.expires_at) {
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt < new Date()) {
    return 401 "Token Expired";
  }
}
```

### **過期處理**

```yaml
Token 過期後:
  ✅ Worker 會拒絕請求 (401)
  ✅ 資料庫中仍保留記錄（用於審計）
  ✅ 可以查看但無法使用

清理過期 Token (可選):
  # 定期清理腳本
  DELETE FROM tokens 
  WHERE expires_at < NOW() 
  AND created_at < NOW() - INTERVAL '1 year';
```

---

## 📋 問題 4: Perplexity 的做法正規嗎？

### **業界實際做法對比**

經過調查，我發現**兩種做法都是正規的**，取決於安全等級需求：

#### **方案 A: 只顯示一次（高安全性）**

```yaml
採用平台:
  - GitHub Personal Access Token
  - AWS IAM Access Keys
  - Stripe API Keys (部分)

做法:
  ✅ 創建時顯示一次
  ❌ 之後無法查看
  ✅ 資料庫只儲存 hash

優點:
  ✅ 最高安全性
  ✅ 資料庫洩漏也無法取得 Token
  
缺點:
  ❌ 用戶忘記就只能重新創建
  ❌ 用戶體驗稍差
```

#### **方案 B: 可事後複製（平衡安全性與便利性）**

```yaml
採用平台:
  - Perplexity AI
  - Anthropic Claude
  - Vercel
  - Supabase

做法:
  ✅ 創建時顯示
  ✅ 之後可以複製（但不完整顯示）
  ✅ 資料庫儲存加密的 Token

優點:
  ✅ 用戶體驗好
  ✅ 不怕忘記
  ✅ 實用性高
  
缺點:
  ❌ 需要管理加密金鑰
  ❌ 資料庫洩漏 + 加密金鑰洩漏 = Token 洩漏
  ❌ 稍微降低安全性
```

### **我的建議：採用方案 B**

**理由：**
1. ✅ Perplexity、Anthropic、Vercel 等現代 SaaS 都這樣做
2. ✅ 用戶體驗更好（你的團隊會感謝你）
3. ✅ 符合「Token Manager」的定位（管理方便）
4. ✅ 仍然有足夠的安全性（加密儲存）

---

## 🔐 加密儲存實施方案

### **使用 PostgreSQL pgcrypto**

```sql
-- 1. 啟用擴展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. 加密儲存
INSERT INTO tokens (token_encrypted) 
VALUES (
  pgp_sym_encrypt('ntk_actual_token', 'your-encryption-key')
);

-- 3. 解密讀取
SELECT pgp_sym_decrypt(token_encrypted::bytea, 'your-encryption-key') 
FROM tokens WHERE id = 1;
```

### **加密金鑰管理**

```python
# 方案 1: 環境變數 (推薦)
ENCRYPTION_KEY = os.getenv("TOKEN_ENCRYPTION_KEY")

# 方案 2: 從 Secrets 服務讀取
# (AWS Secrets Manager, Cloudflare Workers Secret, etc.)

安全措施:
  ✅ 加密金鑰不出現在代碼中
  ✅ 使用環境變數或 Secrets Manager
  ✅ 定期輪換加密金鑰
  ✅ 限制誰可以訪問加密金鑰
```

---

## 🎯 完整實施方案

### **後端修改**

```python
# 1. database.py - 添加欄位
CREATE TABLE tokens (
    ...
    token_encrypted BYTEA,  -- 加密的 Token 明文
    ...
)

# 2. main.py - 加密邏輯
import os
from cryptography.fernet import Fernet

ENCRYPTION_KEY = os.getenv("TOKEN_ENCRYPTION_KEY")
cipher = Fernet(ENCRYPTION_KEY)

def encrypt_token(token: str) -> bytes:
    return cipher.encrypt(token.encode())

def decrypt_token(encrypted: bytes) -> str:
    return cipher.decrypt(encrypted).decode()

# 3. 創建 Token 時
token_encrypted = encrypt_token(token)
INSERT INTO tokens (..., token_encrypted) VALUES (..., $8)

# 4. 新增 API: 複製 Token
@app.get("/api/tokens/{token_id}/reveal")
async def reveal_token(token_id: int, request: Request):
    user = await verify_clerk_token(request)
    
    # 獲取 Token
    token_row = await conn.fetchrow("SELECT * FROM tokens WHERE id = $1", token_id)
    
    # 檢查權限
    await check_team_token_permission(user, token_row['team_id'], "view")
    
    # 解密並返回
    decrypted = decrypt_token(token_row['token_encrypted'])
    return {"token": decrypted}
```

### **前端修改**

```jsx
// TokenList.jsx - 添加複製按鈕
{token.scopes.map(...)}  {/* 權限顯示 */}
<button 
  className="btn btn-small"
  onClick={async () => {
    const authToken = await getToken();
    const response = await fetch(`/api/tokens/${token.id}/reveal`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();
    navigator.clipboard.writeText(data.token);
    alert('✅ Token 已複製！');
  }}
>
  📋 複製
</button>
```

---

## 📊 兩種方案對比

| 特性 | 方案 A (只顯示一次) | 方案 B (可事後複製) |
|------|-------------------|-------------------|
| **安全性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **用戶體驗** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **實施複雜度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **業界採用** | GitHub, AWS | Perplexity, Vercel |
| **適合場景** | 高安全需求 | 一般業務 |

---

## 🎯 我的最終建議

### **推薦：方案 B（可事後複製）**

**理由：**
1. ✅ Perplexity、Vercel、Supabase 都這樣做
2. ✅ 你的團隊是內部使用（不是公開服務）
3. ✅ Token Manager 的定位就是「方便管理」
4. ✅ 用戶體驗更好
5. ✅ 仍有加密保護

**實施步驟：**
1. 添加 `token_encrypted` 欄位
2. 使用 Python cryptography 庫加密
3. 添加 `/api/tokens/{id}/reveal` API
4. 前端添加「複製」按鈕
5. 權限控制：只有團隊成員可以複製自己團隊的 Token

---

## ✅ 目前已完成的改進

### **1. 複製按鈕位置** ✅

**新位置：** Token 顯示框的右側（不是左下角）

```
┌──────────────────────────────────────┐
│ ⚠️ 請立即複製此 Token！              │
│ ┌────────────────────────┬─────────┐ │
│ │ ntk_cwpw...            │ 📋 複製  │ │
│ └────────────────────────┴─────────┘ │
└──────────────────────────────────────┘
```

### **2. 描述欄位** ✅

**創建時：**
```
描述或筆記（可選）
┌──────────────────────────────────────┐
│ 用於 n8n 自動化工作流程的圖片處理服務 │
│                                      │
└──────────────────────────────────────┘
可以記錄此 Token 的用途、使用場景等資訊
```

**列表顯示：**
- 可以在 Token 列表中顯示描述
- 滑鼠懸停顯示完整描述（tooltip）

### **3. 永不過期** ✅

**UI：**
```
☑ 永不過期

過期天數
[90] ← 勾選後隱藏
```

**後端：**
```python
expires_days = None → expires_at = NULL → 永不過期
```

---

## 🔮 下一步實施

要實施「事後複製 Token」功能嗎？

**需要做的事：**
1. 添加 `token_encrypted` 欄位到 tokens 表
2. 安裝 cryptography 庫
3. 設定加密金鑰（環境變數）
4. 實施加密/解密邏輯
5. 添加 reveal API
6. 前端添加複製按鈕

**預計時間：** 30-45 分鐘

你決定吧！要現在實施，還是先測試目前的功能？


---

## 🔄 KV 反向同步機制（2025-11-06 新增）

### **為什麼需要反向同步？**

**場景：** 本地開發時創建的 Token 已同步到 Cloudflare KV，但首次部署時生產 PostgreSQL 是空的。

**後果：**
- Worker 可以驗證這些 Token（從 KV 讀取）✅
- 但前端看不到（從 PostgreSQL 讀取）❌
- 無法管理這些「幽靈」Token ❌

### **解決方案：啟動時補足**

後端啟動時自動從 KV 補足 PostgreSQL 缺失的數據：

```python
# backend/database.py
async def sync_missing_from_kv(self):
    # 只補足缺失的，不覆蓋現有的
    # PostgreSQL 優先（Source of Truth）
```

### **同步內容**

1. **Tokens**: 從 KV 的 `token:*` keys
2. **Routes**: 從 KV 的 `routes` key
3. **Teams**: 從 Clerk 用戶 metadata

### **實施細節**

參考 `READY_FOR_DEPLOYMENT.md` 中的「KV 反向同步機制」章節。

---

**文件版本**: 2.1  
**最後更新**: 2025-11-06
