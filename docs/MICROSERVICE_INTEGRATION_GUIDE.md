# 微服務整合指南

> **給微服務開發者**: 如何讓你的微服務接入 Token Manager 統一認證系統

---

## 📚 目錄

1. [系統概述](#系統概述)
2. [最低規格要求](#最低規格要求)
3. [安全性標準](#安全性標準)
4. [實作指引](#實作指引)
5. [提交清單](#提交清單)
6. [測試驗證](#測試驗證)
7. [常見問題](#常見問題)
8. [參考資源](#參考資源)

---

## 🎯 系統概述

### 架構圖

```
n8n Workflow
     ↓ (帶 X-API-Key header)
Cloudflare Worker (API Gateway)
     ↓ (驗證通過後,添加後端認證)
你的微服務
     ↓ (驗證後端認證)
返回結果
```

### 運作流程

1. **n8n** 發送請求到 API Gateway,帶上 `X-API-Key: ntk_xxx`
2. **API Gateway** 驗證 Token 是否有效且有權限訪問此路由
3. **API Gateway** 根據路由配置,自動添加你的微服務所需的認證 header
4. **你的微服務** 只需驗證這個認證 header,不需要知道 n8n 的 Token

### 為什麼需要後端認證？

- ✅ **雙層安全**: Gateway 驗證 + 你的微服務驗證
- ✅ **Token 隔離**: 你的 API Key 不會暴露給 n8n 用戶
- ✅ **統一管理**: Core Team 在 Token Manager 中集中管理所有 API Key
- ✅ **簡化開發**: 你的微服務不需要實作複雜的用戶權限系統

---

## 🎓 最低規格要求

> **重要**: 這是**最低標準**,你可以實作更複雜的系統,但至少要符合這些要求

### 必須實作 (Mandatory)

#### 1. API Key 驗證機制

你的微服務**必須**支援以下其中一種認證方式:

**選項 A: Bearer Token (推薦)**
```http
Authorization: Bearer YOUR_API_KEY
```

**選項 B: API Key Header**
```http
X-API-Key: YOUR_API_KEY
或
X-Service-Auth: YOUR_API_KEY
或
任何你自訂的 header 名稱
```

**選項 C: Basic Auth**
```http
Authorization: Basic base64(username:password)
```

#### 2. 驗證失敗的標準回應

當認證失敗時,**必須**返回以下格式:

```json
HTTP 401 Unauthorized

{
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

#### 3. 健康檢查端點 (選配但強烈建議)

```http
GET /health
或
GET /api/health

Response:
{
  "status": "healthy",
  "service": "your-service-name"
}
```

### 範例: 最簡實作 (FastAPI)

```python
from fastapi import FastAPI, Header, HTTPException
import os

app = FastAPI()

# 從環境變數讀取 API Key
VALID_API_KEY = os.getenv("SERVICE_API_KEY", "your-secret-key")

# 驗證函數
def verify_api_key(authorization: str = Header(None)):
    """
    驗證 Bearer Token
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing API key")
    
    # 提取 token (格式: "Bearer YOUR_KEY")
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise ValueError
    except:
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    # 驗證 token
    if token != VALID_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return token

# 健康檢查 (不需要認證)
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "my-awesome-service"}

# 受保護的端點
@app.get("/api/data")
def get_data(api_key: str = Depends(verify_api_key)):
    return {"data": "This is protected content"}

# POST 範例
@app.post("/api/process")
def process_data(payload: dict, api_key: str = Depends(verify_api_key)):
    # 處理資料
    return {"status": "success", "result": payload}
```

### 範例: 最簡實作 (Node.js/Express)

```javascript
const express = require('express');
const app = express();

const VALID_API_KEY = process.env.SERVICE_API_KEY || 'your-secret-key';

// 驗證中介軟體
function verifyApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing API key'
    });
  }
  
  const [scheme, token] = authHeader.split(' ');
  
  if (scheme.toLowerCase() !== 'bearer' || token !== VALID_API_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }
  
  next();
}

// 健康檢查 (不需要認證)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'my-service' });
});

// 受保護的端點
app.get('/api/data', verifyApiKey, (req, res) => {
  res.json({ data: 'Protected content' });
});

app.listen(3000);
```

---

## 🔒 安全性標準

### 最低安全要求 (必須遵守)

#### 1. API Key 管理

- ✅ **絕不硬編碼**: API Key 必須從環境變數讀取
- ✅ **使用強密碼**: 至少 32 字符,包含大小寫字母、數字、特殊符號
- ✅ **定期輪換**: 建議每 90 天更換一次
- ✅ **限制範圍**: 一個 API Key 只給一個服務使用

#### 2. HTTPS

- ✅ **強制 HTTPS**: 生產環境必須使用 HTTPS
- ✅ **拒絕 HTTP**: 如果收到 HTTP 請求,返回 426 Upgrade Required

#### 3. 錯誤處理

- ✅ **不洩露資訊**: 錯誤訊息不要包含內部實作細節
- ✅ **統一格式**: 使用標準的 HTTP 狀態碼

```python
# ❌ 錯誤: 洩露太多資訊
{"error": "Token 'abc123' not found in database table 'api_keys'"}

# ✅ 正確: 簡潔且安全
{"error": "Unauthorized", "message": "Invalid API key"}
```

#### 4. Rate Limiting (可選)

雖然 API Gateway 會做全域的 rate limiting,但你的微服務也應該實作:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/data")
@limiter.limit("100/minute")  # 每分鐘最多 100 次
def get_data():
    return {"data": "content"}
```

### 進階安全措施 (選配)

以下是**加分項目**,不是必須,但實作後會更安全:

- ⭐ **請求簽名驗證**: HMAC-SHA256 簽名
- ⭐ **IP 白名單**: 只允許特定 IP 訪問
- ⭐ **請求 ID 追蹤**: 每個請求都有唯一 ID,方便除錯
- ⭐ **審計日誌**: 記錄所有 API 訪問
- ⭐ **Token 過期機制**: API Key 有效期限
- ⭐ **多層級權限**: 不同的 API Key 有不同權限

---

## 🛠️ 實作指引

### Step 1: 設計你的 API

#### 1.1 決定認證方式

選擇最適合你的方式:

| 認證方式 | 適用場景 | 複雜度 |
|---------|---------|--------|
| Bearer Token | 現代 RESTful API (推薦) | ⭐ 簡單 |
| API Key Header | 簡單服務 | ⭐ 簡單 |
| Basic Auth | 傳統系統 | ⭐ 簡單 |
| OAuth 2.0 | 複雜的第三方整合 | ⭐⭐⭐ 複雜 |

**推薦**: Bearer Token,因為它是業界標準且 API Gateway 支援最好。

#### 1.2 定義 API 端點

列出你的微服務需要對外提供的所有端點:

```
GET  /api/data          # 獲取資料
POST /api/process       # 處理資料
GET  /api/status/{id}   # 查詢狀態
DELETE /api/data/{id}   # 刪除資料
```

#### 1.3 設計錯誤回應

確保你的 API 使用標準的 HTTP 狀態碼:

| 狀態碼 | 使用時機 |
|-------|---------|
| 200 | 成功 |
| 201 | 創建成功 |
| 400 | 請求參數錯誤 |
| 401 | 認證失敗 |
| 403 | 權限不足 (如果你有權限系統) |
| 404 | 資源不存在 |
| 429 | 請求太頻繁 |
| 500 | 服務器內部錯誤 |

### Step 2: 實作認證

#### 2.1 生成 API Key

```python
# 生成強密碼 API Key
import secrets

api_key = secrets.token_urlsafe(32)  # 生成 32 字節的隨機 key
print(api_key)
# 輸出: "Xg7RpK3vN2mQ8wL9-jH4bF1cT6dY5sA0"
```

#### 2.2 儲存在環境變數

```bash
# .env
SERVICE_API_KEY=Xg7RpK3vN2mQ8wL9-jH4bF1cT6dY5sA0
```

```python
# main.py
import os
from dotenv import load_dotenv

load_dotenv()
VALID_API_KEY = os.getenv("SERVICE_API_KEY")
```

#### 2.3 實作驗證邏輯

參考前面的 [最簡實作範例](#範例-最簡實作-fastapi)

### Step 3: 本地測試

#### 3.1 啟動你的服務

```bash
# FastAPI
uvicorn main:app --reload --port 8080

# Node.js
node server.js
```

#### 3.2 測試健康檢查

```bash
curl http://localhost:8080/health
# 預期: {"status":"healthy","service":"my-service"}
```

#### 3.3 測試認證失敗

```bash
# 沒有 header
curl http://localhost:8080/api/data
# 預期: 401 Unauthorized

# 錯誤的 key
curl -H "Authorization: Bearer wrong-key" http://localhost:8080/api/data
# 預期: 401 Unauthorized
```

#### 3.4 測試認證成功

```bash
# 正確的 key
curl -H "Authorization: Bearer Xg7RpK3vN2mQ8wL9-jH4bF1cT6dY5sA0" \
  http://localhost:8080/api/data
# 預期: {"data":"Protected content"}
```

### Step 4: 部署到生產環境

#### 4.1 選擇部署平台

- [Railway](https://railway.app/) - 推薦,簡單易用
- [Heroku](https://heroku.com/)
- [Google Cloud Run](https://cloud.google.com/run)
- [AWS Lambda](https://aws.amazon.com/lambda/)
- 自己的 VPS

#### 4.2 設定環境變數

在部署平台上設定:

```
SERVICE_API_KEY=你的實際API Key
DATABASE_URL=資料庫連線字串
其他必要的環境變數...
```

#### 4.3 啟用 HTTPS

大部分雲端平台都會自動提供 HTTPS,確保你的服務網址是 `https://`。

#### 4.4 記錄你的服務 URL

```
https://my-service.railway.app
或
https://my-service.your-domain.com
```

---

## 📋 提交清單

當你的微服務開發完成後,請提交以下資料給 **Token Manager Core Team**:

### 必須提供

#### 1. 服務基本資訊

```yaml
服務名稱: Image Processing Service
服務描述: 提供圖片壓縮、格式轉換、尺寸調整功能
開發負責人: Joey Luo
聯絡方式: joey@cryptoxlab.com
```

#### 2. 部署資訊

```yaml
生產環境 URL: https://image-service.railway.app
後端基礎路徑: /api/v1 (或 / 如果沒有前綴)
建議的路由路徑: /api/image (在 API Gateway 上的路徑)
```

#### 3. 認證資訊

```yaml
認證方式: Bearer Token
Header 名稱: Authorization
Header 格式: Bearer {token}
API Key: Xg7RpK3vN2mQ8wL9-jH4bF1cT6dY5sA0
環境變數名稱: IMAGE_SERVICE_API_KEY (建議命名規則: {服務名}_API_KEY)
```

#### 4. API 端點清單

```yaml
端點列表:
  - method: POST
    path: /compress
    description: 壓縮圖片
    需要認證: Yes
    
  - method: POST
    path: /convert
    description: 轉換圖片格式
    需要認證: Yes
    
  - method: GET
    path: /health
    description: 健康檢查
    需要認證: No
```

#### 5. 請求/回應範例

```json
// POST /api/image/compress
Request:
{
  "url": "https://example.com/image.jpg",
  "quality": 80
}

Response (成功):
{
  "status": "success",
  "output_url": "https://cdn.example.com/compressed.jpg",
  "size_reduction": "75%"
}

Response (失敗):
{
  "error": "InvalidFormat",
  "message": "Unsupported image format"
}
```

#### 6. 標籤建議 (用於權限控制)

```yaml
建議標籤: [image, media, processing]
用途: 讓 Token Manager 可以根據標籤分配權限
範例: Token scopes 有 "tag:image" 就可以訪問此服務
```

### 選配提供 (加分項目)

- 📖 **API 文檔連結**: 如 https://tapi.blocktempo.ai/docs (FastAPI 自動生成)
- 📊 **預期 QPS**: 如 "預計每秒 10-50 請求"
- ⏱️ **平均回應時間**: 如 "通常 500ms 內"
- 💾 **特殊需求**: 如 "需要處理大檔案,timeout 建議設為 30 秒"
- 🔧 **依賴服務**: 如 "依賴 PostgreSQL 和 Redis"

### 提交方式

**選項 A: 填寫 Google Form (推薦)**
```
https://forms.google.com/your-team-form
```

**選項 B: 發送郵件**
```
收件人: core-team@example.com
主旨: [微服務整合] Image Processing Service
內容: 按照上面的清單格式填寫
```

**選項 C: 提交 Pull Request**
```
在專案的 services/ 目錄下創建 your-service.yaml
```

---

## 🧪 測試驗證

### 階段 1: 本地測試 (你自己完成)

```bash
# 1. 測試健康檢查
curl https://your-service.railway.app/health

# 2. 測試認證失敗
curl https://your-service.railway.app/api/endpoint

# 3. 測試認證成功
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-service.railway.app/api/endpoint
```

### 階段 2: Core Team 配置 (提交後)

Core Team 會在 Token Manager 中:

1. 創建路由配置
2. 儲存你的 API Key 到 Cloudflare KV
3. 部署更新到 API Gateway

**預計時間**: 10-30 分鐘

### 階段 3: 整合測試 (你和 Core Team 一起)

```bash
# Core Team 會提供一個測試 Token
TEST_TOKEN="ntk_test_xxxxxxxxxx"

# 透過 API Gateway 測試
curl -H "X-API-Key: $TEST_TOKEN" \
  https://api-gateway.cryptoxlab.workers.dev/api/image/compress \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/test.jpg","quality":80}'
```

**預期結果**:
- ✅ API Gateway 驗證 Token 成功
- ✅ API Gateway 自動添加你的 API Key
- ✅ 你的微服務收到請求並正確處理
- ✅ 回應成功返回

### 階段 4: 生產上線

測試通過後:
- ✅ Core Team 創建正式的 Token
- ✅ 更新路由標籤和權限
- ✅ 通知所有需要使用此服務的團隊
- ✅ 監控初期的使用情況

---

## 🔍 常見問題

### Q1: 我的服務已經有自己的用戶系統,還需要整合嗎?

**A**: 分兩種情況:

1. **內部 API (n8n 使用)**: 必須整合,使用 Token Manager 統一認證
2. **對外 API (給用戶使用)**: 不需要,保持你原有的系統

你可以兩套並行:
```python
@app.post("/api/process")
def process(
    authorization: str = Header(None),  # Token Manager
    x_user_token: str = Header(None)     # 你自己的系統
):
    # Token Manager 認證 (給 n8n)
    if authorization:
        verify_token_manager(authorization)
    # 或你自己的系統 (給用戶)
    elif x_user_token:
        verify_user_token(x_user_token)
    else:
        raise HTTPException(401)
```

### Q2: 我可以使用更複雜的認證系統嗎?

**A**: 當然可以! 最低規格只是確保基本整合,你可以:

- ✅ 使用 OAuth 2.0
- ✅ 實作 JWT Token
- ✅ 加入請求簽名驗證
- ✅ 實作多層級權限

只要確保 API Gateway 發送的請求能通過你的認證即可。

### Q3: API Key 洩露了怎麼辦?

**立即行動**:

1. **通知 Core Team**: 立即告知,他們會從 Token Manager 撤銷舊 Key
2. **生成新 Key**: 使用 `secrets.token_urlsafe(32)` 生成新的
3. **更新環境變數**: 在部署平台更新 `SERVICE_API_KEY`
4. **重新提交**: 將新 Key 提交給 Core Team
5. **驗證**: 測試新 Key 是否生效

**預計停機時間**: < 5 分鐘

### Q4: 服務更新了 API 怎麼辦?

**通知 Core Team**:

- ✅ 新增端點: 不影響,直接可用
- ✅ 修改參數: 更新文檔即可
- ⚠️ 移除端點: 需要提前通知,確保沒人在用
- ⚠️ 改變認證方式: 需要重新整合

### Q5: 可以多個微服務共用一個 API Key 嗎?

**不建議**,原因:

- ❌ 安全風險: 一個 Key 洩露,所有服務受影響
- ❌ 難以追蹤: 不知道是哪個服務出問題
- ❌ 權限混亂: 無法對不同服務設定不同權限

**正確做法**: 每個微服務一個獨立的 API Key

### Q6: 我的服務需要很長的處理時間怎麼辦?

**非同步處理模式**:

```python
@app.post("/api/long-task")
async def start_task(payload: dict):
    # 立即返回 Job ID
    job_id = create_job(payload)
    return {
        "status": "processing",
        "job_id": job_id,
        "check_url": f"/api/status/{job_id}"
    }

@app.get("/api/status/{job_id}")
def check_status(job_id: str):
    status = get_job_status(job_id)
    return {
        "status": status.state,  # "processing", "completed", "failed"
        "result": status.result if status.state == "completed" else None
    }
```

並告知 Core Team 設定較長的 timeout。

### Q7: 本地開發時如何測試?

**Mock API Gateway**:

```bash
# 直接用你的 API Key 測試
curl -H "Authorization: Bearer YOUR_DEV_KEY" \
  http://localhost:8080/api/endpoint

# 或使用 ngrok 讓 Core Team 測試
ngrok http 8080
# 將 ngrok URL 提供給 Core Team
```

### Q8: 服務 URL 可以改嗎?

**可以**,但需要通知:

1. 部署到新的 URL
2. 通知 Core Team 更新路由配置
3. 測試新 URL 是否正常
4. 關閉舊服務

**建議**: 使用自己的網域,如 `api.your-company.com`,這樣就不會因為換平台而改 URL。

---

## 📚 參考資源

### Token Manager 文檔

- 🏠 [專案首頁](https://github.com/your-org/token-manager)
- 📖 [API 文檔](https://tapi.blocktempo.ai/docs) (FastAPI Swagger UI)
- 🔐 [權限系統說明](../docs/PERMISSION_RULES.md)
- 🧪 [路由測試指南](../docs/ROUTE_TESTING_GUIDE.md)

### 範例服務

- 🖼️ [Image Service 範例](https://github.com/your-org/example-image-service) (Python/FastAPI)
- 📊 [Data Service 範例](https://github.com/your-org/example-data-service) (Node.js/Express)
- 🔄 [Webhook Service 範例](https://github.com/your-org/example-webhook-service) (Go)

### 安全最佳實踐

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [FastAPI Security Documentation](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

### 部署平台文檔

- [Railway Docs](https://docs.railway.app/)
- [Heroku Docs](https://devcenter.heroku.com/)
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)

### 開發工具

- [Postman](https://www.postman.com/) - API 測試工具
- [Insomnia](https://insomnia.rest/) - API 測試工具
- [ngrok](https://ngrok.com/) - 本地測試工具
- [httpbin.org](https://httpbin.org/) - HTTP 測試服務

---

## 🆘 獲取幫助

### 遇到問題?

1. **查看文檔**: 先看看 [常見問題](#常見問題) 和其他文檔
2. **檢查範例**: 參考 [範例服務](#範例服務)
3. **聯絡 Core Team**:
   - 📧 Email: core-team@example.com
   - 💬 Slack: #token-manager-support
   - 🎫 GitHub Issues: [提交 Issue](https://github.com/your-org/token-manager/issues)

### 提交 Bug

請提供:
- 你的服務名稱和 URL
- 詳細的錯誤訊息
- 重現步驟
- 預期結果 vs 實際結果
- 相關的 log 或截圖

---

## 📝 快速檢查清單

整合前確認:

- [ ] 我的服務實作了 API Key 驗證
- [ ] 驗證失敗會返回 401 狀態碼
- [ ] API Key 儲存在環境變數,沒有硬編碼
- [ ] 生產環境使用 HTTPS
- [ ] 有健康檢查端點 `/health`
- [ ] 錯誤訊息不洩露敏感資訊
- [ ] 本地測試全部通過
- [ ] 準備好提交清單中的所有資料
- [ ] 服務已部署到穩定的生產環境
- [ ] 有 API 文檔 (至少是 README)

準備好了? [提交整合申請](#提交清單) 🚀

---

**文件版本**: 1.0  
**最後更新**: 2025-11-10  
**維護者**: Token Manager Core Team

