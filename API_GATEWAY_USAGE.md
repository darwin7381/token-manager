# API Gateway 使用指南

**目標讀者**：其他微服務的開發者  
**目的**：了解如何接入 Token Manager API Gateway

---

## 🎯 Token Manager 是什麼？

**Token Manager = 讓你的微服務不用管理 API Key 的系統**

你只要：
1. 註冊你的服務網址（1 分鐘）
2. 拿一個 Token
3. n8n/curl/Postman 就能調用你的服務

**系統網址**：
- 管理界面：https://token.blocktempo.ai
- API Gateway：https://api-gateway.cryptoxlab.workers.dev
- 後端 API：https://tapi.blocktempo.ai

**好處**：
- ✅ 不用在 n8n 裡存你的 API Key（安全）
- ✅ 隨時可以撤銷 Token（即時生效）
- ✅ 知道誰在用、用了幾次（監控）
- ✅ 一個 Token 訪問所有微服務（方便）

---

## ⚡ 5 分鐘快速開始

**最簡單的接入方式**（不需要懂細節）：

### 👉 如果你不是 Core Team

把以下資訊給 Core Team，他們會幫你設定（5 分鐘內）：
```
服務名稱: Image Processor
服務 URL: https://your-service.railway.app
需要認證: 有（提供你的 API Key: img-secret-key-12345）
         或 沒有
```

Core Team 會給你一個 Token：`ntk_xxxxx`

然後在 n8n 中：
```
URL: https://api-gateway.cryptoxlab.workers.dev/api/你的路徑
Headers:
  X-API-Key: ntk_xxxxx
```

**就這樣！** 下面是自己操作的詳細步驟。

---

### 👉 如果你是 Core Team

繼續閱讀 Part A 和 Part B 的詳細步驟。

---

## 💡 為什麼需要這個系統？

**之前的問題**：
- 30-100 個 n8n workflows 各自管理不同微服務的 API Key
- API Key 散落各處，難以管理和撤銷
- 無法知道哪個 Key 被誰用了

**現在的方案**：
- 一個 Token 訪問所有微服務
- Web UI 集中管理，撤銷立即生效
- 完整的使用監控和權限控制

---

## 🏗️ 架構說明

```
HTTP 客戶端（n8n / curl / Postman / 其他）
    ↓ X-API-Key: ntk_xxxxx（統一 Token）
Cloudflare Worker (API Gateway)
    ↓ 1. 驗證 Token
    ↓ 2. 檢查 Scopes 權限
    ↓ 3. 自動添加你的微服務 API Key
你的微服務
    ↓ 處理請求
    ↓ 返回結果
HTTP 客戶端
```

---

## 📋 接入流程總覽

### Part A：註冊路由（每個微服務只需做一次）
- **由誰執行**：Core Team 成員
- **做什麼**：告訴系統「你的微服務在哪裡」
- **頻率**：每個微服務只註冊一次

### Part B：取得 Token（可以創建多個）
- **由誰執行**：任何團隊成員
- **做什麼**：創建 Token 在 n8n 中使用
- **頻率**：可以創建多個（不同權限、不同團隊、不同用途）

---

## 📍 Part A：註冊你的微服務路由

**路由管理頁面**：https://token.blocktempo.ai/routes

**需要權限**：Core Team 成員（ADMIN/MANAGER/DEVELOPER）

**👉 如果你不是 Core Team**：
- 把你的服務資訊（名稱、URL、是否需要認證）給 Core Team
- 他們會幫你創建（5 分鐘內完成）
- 然後直接跳到 Part B

**👉 如果你是 Core Team**：
- 繼續以下步驟

---

### 創建路由（範例：圖片處理服務）

點擊「新增路由」，填入：

```
名稱: Image Processor
路徑: /api/image（前綴路徑，只需註冊一次）
後端 URL: https://image-processor.railway.app
描述: 圖片處理微服務
標籤: image, media, processing
```

💡 **重要**：只需註冊**前綴路徑**（如 `/api/image`），所有子路徑會自動轉發：
- `/api/image/create` → 自動轉發到你的服務
- `/api/image/read` → 自動轉發
- `/api/image/任何路徑` → 自動轉發

**不需要**為每個端點創建路由！

**如果你的微服務需要認證**（例如需要 Bearer Token）：
```
後端服務認證方式: Bearer Token
環境變數名稱: IMAGE_PROCESSOR_KEY

實際的 API Token: img-secret-key-12345
（⚠️ 這裡輸入你的微服務的真實 API Key）
```

**後端會自動**：
- 存環境變數名稱到資料庫（`IMAGE_PROCESSOR_KEY`）
- 存實際 Key 到 Cloudflare KV Secrets（`img-secret-key-12345`）
- 同步路由配置到 KV（60 秒內生效）

**安全機制**：
- 實際 Key 加密存在 Cloudflare KV
- 資料庫只存環境變數名稱
- Worker 運行時才讀取並添加到請求

---

### 複製 cURL 並測試

**在路由列表中**：
- 找到你剛創建的路由
- 點擊「📋 Copy cURL」按鈕

**得到的 cURL**（可直接在 n8n 匯入）：
```bash
curl -X POST https://api-gateway.cryptoxlab.workers.dev/api/image/process \
  -H "X-API-Key: YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://example.com/img.jpg", "width": 800}'
```

**在 n8n 中使用**：
1. 創建 HTTP Request 節點
2. 點擊「⋯」→「Import cURL」
3. 貼上上面的 cURL
4. 替換 `YOUR_TOKEN_HERE` 為你的 Token（從 Part B 取得）
5. 完成！

---

### 步驟 5：在 n8n 中使用（推薦）

**方式 A：直接匯入 cURL**（最快）

1. 在 n8n 中創建 HTTP Request 節點
2. 點擊節點右上角「⋯」→「Import cURL」
3. 貼上剛才複製的 cURL 命令
4. n8n 自動解析並填入所有欄位
5. 只需替換 `YOUR_TOKEN_HERE` 為實際 Token

**方式 B：手動配置**

```
HTTP Request 節點:

URL: https://api-gateway.cryptoxlab.workers.dev/api/image/process
Method: POST
Headers:
  X-API-Key: ntk_xxxxxxxxxxxxx
  Content-Type: application/json
Body: {"image_url": "https://..."}
```

**完成！** 你的 n8n workflow 現在可以調用你的微服務了。

---

## 🔑 Part B：取得和管理 Token

**Token 管理頁面**：https://token.blocktempo.ai/tokens

---

### 創建新 Token（範例：圖片服務用）

點擊「創建新 Token」，填入：

```
名稱: Image Service Token
所屬團隊: 選擇你的團隊
權限範圍（這個 Token 可以訪問哪些服務）: 
  ☑ 選擇路由/標籤
    → 勾選你剛註冊的服務標籤（例如 "image" 或 "tag:media"）

💡 不確定？選「全部權限 (*)」

過期: ☑ 永不過期（或設定天數）

點擊「創建 Token」
```

**創建成功後**：
- 彈窗顯示：`ntk_cwpwHGVxqRx7G7hzZhWIIv5nlP1pjWehqaJz2ORnckg`
- 點擊「📋 複製」

⚠️ **Token 可隨時複製**：點擊 Token 列表中的「複製」按鈕

---

### 使用 Token

**在 n8n 中**（推薦用環境變數）：
```
n8n Settings → Variables
  Name: API_GATEWAY_TOKEN
  Value: ntk_cwpwHGVxqRx7G7hzZhWIIv5nlP1pjWehqaJz2ORnckg

HTTP Request 節點 → Headers:
  X-API-Key: {{$env.API_GATEWAY_TOKEN}}
```

**在 curl/Postman 中**：
```
Headers:
  X-API-Key: ntk_cwpwHGVxqRx7G7hzZhWIIv5nlP1pjWehqaJz2ORnckg
```

---

## 📊 權限控制說明

### Scopes 系統

Token 可以限制訪問哪些路由：

**通配符**：
```
scopes: ["*"]
→ 可以訪問所有路由
```

**服務名稱**：
```
scopes: ["image", "data"]
→ 可以訪問 /api/image/* 和 /api/data/*
```

**標籤匹配**：
```
scopes: ["tag:media", "tag:public"]
→ 可以訪問所有標記為 media 或 public 的路由
```

### 如何設定你的路由權限

**公開服務**：
```
標籤: public
→ 任何有 ["*"] 或 ["tag:public"] 的 Token 都能訪問
```

**受限服務**：
```
標籤: internal, premium
→ 只有特定 Token 能訪問
```

---

## 🔒 後端認證說明

### 如果你的微服務需要 API Key

**不要**在 n8n 中管理你的 API Key！

**正確做法**：
1. 在創建路由時設定後端認證
2. 環境變數名稱：`YOUR_SERVICE_KEY`
3. 在 Worker 設定實際 Key：`wrangler secret put YOUR_SERVICE_KEY`
4. Worker 會自動添加到請求中

**支援的認證方式**：
- Bearer Token：`Authorization: Bearer xxx`
- API Key：`X-API-Key: xxx`（可自訂 header 名稱）
- Basic Auth：`Authorization: Basic xxx`

**優勢**：
- n8n 不需要知道你的真實 API Key
- 集中管理所有微服務的 Key
- 可以獨立更換 Key

---

## 🧪 測試你的路由

### 測試步驟

```bash
# 1. 確認路由已創建
curl https://tapi.blocktempo.ai/api/routes \
  -H "Authorization: Bearer $CLERK_TOKEN" | jq '.[] | select(.path=="/api/image")'

# 2. 確認已同步到 KV（等待 60 秒）

# 3. 測試調用
curl https://api-gateway.cryptoxlab.workers.dev/api/image/test \
  -H "X-API-Key: ntk_your_test_token" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# 預期：
# - 不是 404（路由匹配成功）
# - 不是 401（Token 驗證成功）
# - 不是 403（權限檢查通過）
# - 返回你的微服務的響應
```

**常見錯誤**：
- 404 Route Not Found → 檢查路徑是否正確
- 401 Invalid Token → 檢查 Token 是否有效
- 403 Permission Denied → 檢查 Token 的 scopes
- 後端 Unauthorized → 檢查後端認證設定

**詳細測試指南**：`docs/ROUTE_TESTING_GUIDE.md`

---


---

## 🔄 路徑轉發規則（重要！）

### 一個路由 = 所有子路徑

**只需註冊前綴路徑**，例如註冊 `/api/hedgedoc`：

```
註冊的路由: /api/hedgedoc
後端 URL: https://md.blocktempo.ai

自動支援所有子路徑:
  ✅ /api/hedgedoc/create → 轉發到 md.blocktempo.ai/create
  ✅ /api/hedgedoc/read → 轉發到 md.blocktempo.ai/read  
  ✅ /api/hedgedoc/new → 轉發到 md.blocktempo.ai/new
  ✅ /api/hedgedoc/任何路徑 → 自動轉發

不需要為 /create、/read、/new 分別創建路由！
```

### Worker 轉發邏輯

```
請求: https://api-gateway.cryptoxlab.workers.dev/api/hedgedoc/create?title=test
        
路由配置:
  路徑: /api/hedgedoc
  後端: https://md.blocktempo.ai

Worker 處理:
  1. 匹配路由: /api/hedgedoc ✅
  2. 去除前綴，提取: /create
  3. 保留 query: ?title=test
  4. 拼接: https://md.blocktempo.ai/create?title=test
  5. 轉發（保留 method、headers、body）
```

---

## 📞 需要協助？

### 找 Core Team 幫忙

**什麼時候需要找他們**：
- 你不是 Core Team，需要註冊新路由
- 需要修改路由設定
- 需要加入某個團隊（才能創建 Token）

**如何聯繫**：
- 用戶管理頁面：https://token.blocktempo.ai/users
- 查看 Core Team 成員並聯繫

### 查看系統狀態

- Dashboard：https://token.blocktempo.ai/dashboard
- 系統健康：https://token.blocktempo.ai/system-health
- 路由列表：https://token.blocktempo.ai/routes
- Token 列表：https://token.blocktempo.ai/tokens
- API 文檔：https://tapi.blocktempo.ai/docs

### 技術文檔

- 權限系統：`docs/PERMISSION_RULES.md`
- 後端認證：`docs/ROUTE_BACKEND_AUTH.md`
- 測試指南：`docs/ROUTE_TESTING_GUIDE.md`

---

## 🎯 最佳實踐

### 路由命名

```
✅ 好的路徑:
/api/image
/api/data/transform
/api/video/convert

❌ 不好的路徑:
/image（缺少 /api 前綴）
/api/v1/v2/image（版本號重複）
```

### 權限設定

```
✅ 推薦:
使用標籤: image, media, public, internal, premium
Token 使用 tag:xxx 匹配

❌ 避免:
所有 Token 都用 ["*"]（過度授權）
```

### API Key 管理

```
✅ 安全:
環境變數名稱: UPPERCASE_WITH_UNDERSCORES
實際 Key: 存在 Cloudflare Secrets
定期輪換

❌ 危險:
環境變數名稱填實際 Key
Key 寫在代碼或文檔中
長期不更換
```

---

**Token Manager 讓你專注在業務邏輯，我們處理認證、路由和監控。** 🚀

