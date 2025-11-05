# 後端微服務認證使用指南

**⚠️ 重要：請務必正確理解本指南，避免洩漏 API Key！**

---

## 🎯 核心概念

### **什麼是「環境變數名稱」？**

```yaml
環境變數名稱（Variable Name）:
  - 這是一個「代號」或「別名」
  - 例如: OPENAI_API_KEY, AWS_SECRET, BACKEND_TOKEN
  - 這個名稱會儲存在資料庫中
  - 這是安全的，可以公開

實際的 API Key（Secret Value）:
  - 這是真正的密鑰
  - 例如: sk-proj-xxxxxxxxxxxxx
  - 這個值儲存在 Cloudflare Worker Secrets 中
  - 這是機密的，絕不能洩漏
```

### **為什麼要分離？**

```
錯誤做法（直接儲存）:
  資料庫 → 儲存 sk-proj-xxxxx
  ❌ 資料庫洩漏 = API Key 洩漏
  ❌ 所有有權限的人都能看到
  ❌ 難以更換金鑰

正確做法（引用）:
  資料庫 → 儲存 "OPENAI_API_KEY"（名稱）
  Cloudflare → 儲存實際值（加密）
  Worker → 讀取 env.OPENAI_API_KEY
  ✅ 資料庫洩漏也沒事
  ✅ 只有 Worker 能讀取實際值
  ✅ 可以獨立更換金鑰
```

---

## 📖 完整操作步驟

### **範例：設定 OpenAI API 路由**

#### **Step 1: 設定 Cloudflare Worker Secret（實際金鑰）**

```bash
# 1. 進入 worker 目錄
cd /Users/JL/Development/microservice-system/token-manager/worker

# 2. 使用 wrangler 設定 secret
wrangler secret put OPENAI_API_KEY

# 3. 系統會提示輸入（輸入實際的 API Key）
? Enter a secret value: sk-proj-TCTGBcWbsPaRTq0oZAWzxZK5U1NLkX984bhZTMXbLy...
# 按 Enter

# 4. 確認成功
✅ Creating the secret for the Worker "api-gateway" 
✅ Success! Uploaded secret OPENAI_API_KEY

# 重要：這個值現在儲存在 Cloudflare，加密且安全
```

#### **Step 2: 在管理系統創建路由（填入引用名稱）**

```
登入系統 → 路由管理 → 點擊「新增路由」

表單填寫:
  名稱: OpenAI Chat API
  路徑: /api/openai
  後端 URL: https://api.openai.com/v1
  
  後端服務認證方式: Bearer Token
  
  Token 環境變數名稱: OPENAI_API_KEY  ← 只填名稱！不是實際值！
  
[新增路由]
```

#### **Step 3: 系統自動同步**

```
系統會自動:
  1. 儲存到資料庫
  2. 同步到 Cloudflare KV:
     {
       "/api/openai": {
         "url": "https://api.openai.com/v1",
         "auth": {
           "type": "bearer",
           "config": {
             "token_ref": "OPENAI_API_KEY"  ← 只有名稱
           }
         }
       }
     }
```

#### **Step 4: Worker 運行時**

```javascript
// Worker 收到請求
const authConfig = route.auth.config;
const actualToken = env[authConfig.token_ref];  
// env.OPENAI_API_KEY = "sk-proj-xxx..."

// 添加到請求
backendHeaders.set('Authorization', `Bearer ${actualToken}`);

// 轉發給 OpenAI
```

---

## ❌ 常見錯誤

### **錯誤 1: 填入實際 API Key**

```yaml
❌ 錯誤:
  Token 環境變數名稱: sk-proj-TCTGBcWbsPaRTq0o...
  
問題:
  - 實際金鑰儲存在資料庫（明文）
  - 所有人都能在 UI 看到
  - 極度危險！

✅ 正確:
  Token 環境變數名稱: OPENAI_API_KEY
  
  然後在 Worker 設定:
  wrangler secret put OPENAI_API_KEY
  輸入實際值: sk-proj-xxx...
```

### **錯誤 2: 沒有在 Worker 設定 Secret**

```yaml
❌ 錯誤流程:
  1. 在 UI 填入: OPENAI_API_KEY
  2. 直接使用
  3. Worker 找不到 env.OPENAI_API_KEY
  4. 請求失敗

✅ 正確流程:
  1. 先在 Worker 設定: wrangler secret put OPENAI_API_KEY
  2. 再在 UI 填入: OPENAI_API_KEY
  3. Worker 能讀取到實際值
  4. 請求成功
```

---

## 🔧 問題 1 解答：Cloudflare Worker 的設定

### **為什麼需要手動設定？**

```
我們的系統:
  管理「配置」（路由、認證類型、引用名稱）
  
Cloudflare Worker:
  管理「實際密鑰」（環境變數、Secrets）
  
分離的原因:
  ✅ 安全：密鑰不經過我們的系統
  ✅ 簡單：我們不需要管理加密金鑰
  ✅ 標準：這是業界標準做法
```

### **設定位置**

```bash
方法 1: 使用 wrangler CLI（推薦）
  cd worker
  wrangler secret put KEY_NAME
  
方法 2: Cloudflare Dashboard
  登入 Cloudflare → Workers → 選擇 Worker
  → Settings → Variables → Add variable
  → Type: Secret
  → Name: OPENAI_API_KEY
  → Value: sk-proj-xxx
```

---

## 🔍 問題 2 & 3：為什麼路由遺失？

### **檢查結果**

```sql
資料庫中有 5 個路由:
  ✅ id=5: OpenAI (bearer 認證)
  ✅ id=1-4: 其他路由

Cloudflare KV 中也有 5 個路由:
  ✅ 同步成功
```

**結論：路由沒有遺失！** 可能是前端顯示問題或緩存問題。

---

## 🎯 正確的操作流程（完整）

### **設定 OpenAI API**

```bash
# === Step 1: 設定 Cloudflare Secret ===
cd /Users/JL/Development/microservice-system/token-manager/worker

wrangler secret put OPENAI_API_KEY
# 輸入你的 OpenAI API Key（以 sk-proj- 開頭的那串）
# 按 Enter

# 看到成功訊息
✅ Success! Uploaded secret OPENAI_API_KEY

# === Step 2: 在管理系統創建路由 ===
# 打開瀏覽器 http://localhost:5173
# 登入 → 路由管理 → 新增路由

表單:
  名稱: OpenAI API
  路徑: /api/openai
  後端 URL: https://api.openai.com/v1
  標籤: ai, llm（可選）
  
  後端服務認證方式: Bearer Token
  Token 環境變數名稱: OPENAI_API_KEY  ← 重要！只填名稱
  
點擊 [新增路由]

# === Step 3: 驗證 ===
# 檢查資料庫
psql $DATABASE_URL -c "SELECT id, path, backend_auth_type, backend_auth_config FROM routes WHERE path='/api/openai';"

# 應該看到:
backend_auth_type: bearer
backend_auth_config: {"token_ref": "OPENAI_API_KEY"}  ← 只有名稱

# === Step 4: 測試（需要先創建 Token）===
# 假設你的 Token 是 ntk_test123

curl -X POST https://your-worker.workers.dev/api/openai/chat/completions \
  -H "X-API-Key: ntk_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Worker 會自動:
# 1. 驗證 ntk_test123
# 2. 添加 Authorization: Bearer sk-proj-xxx（從 env 讀取）
# 3. 轉發到 OpenAI
# 4. 返回結果
```

---

## 🚨 安全警告

### **你剛才創建的路由包含明文 API Key！**

```
已刪除危險路由（id=5）

請立即:
  1. 檢查是否有人看到或複製了那個 API Key
  2. 到 OpenAI Dashboard 撤銷該 API Key
  3. 生成新的 API Key
  4. 按照上述正確流程重新設定
```

---

## 📝 UI 改進建議

為了避免用戶誤解，我應該在 UI 上添加更清楚的說明：

```jsx
<div className="form-group">
  <label>Token 環境變數名稱 *</label>
  <input
    placeholder="例如: OPENAI_API_KEY"  ← 清楚的範例
    // 不要: "例如: sk-proj-xxx"
  />
  <div style={{ 
    backgroundColor: '#fef3c7', 
    padding: '10px',
    borderRadius: '6px',
    marginTop: '8px'
  }}>
    <strong>⚠️ 重要說明：</strong>
    <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px' }}>
      <li>這裡填入「環境變數的名稱」，例如：<code>OPENAI_API_KEY</code></li>
      <li>❌ 不要填入實際的 API Key（如 sk-proj-xxx）</li>
      <li>✅ 實際的 Key 要在 Cloudflare Worker 中設定：
        <br/><code>wrangler secret put OPENAI_API_KEY</code>
      </li>
    </ol>
  </div>
</div>
```

要我添加這個改進嗎？
