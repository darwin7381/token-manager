# 路由測試指南

**目的**: 確保每個創建的路由都能正常工作  
**使用時機**: 每次創建或修改路由後  
**重要性**: 🔴 必須執行

---

## 📋 測試前準備

### **1. 確認路由已創建**

```bash
# 檢查資料庫
cd backend
export DATABASE_URL="postgresql://postgres:password@127.0.0.1:5433/tokenmanager"
psql "$DATABASE_URL" -c "SELECT id, name, path, backend_url, backend_auth_type FROM routes WHERE path = '/api/your-route';"

# 應該看到路由數據
```

### **2. 確認已同步到 Cloudflare KV**

```bash
cd backend
source .env

# 檢查路由配置
curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$CF_KV_NAMESPACE_ID/values/routes" \
  -H "Authorization: Bearer $CF_API_TOKEN" | python3 -m json.tool | grep -A 10 "your-route"

# 應該看到路由的 url, tags, auth 配置
```

### **3. 確認後端認證 Secret 已儲存（如果有）**

```bash
# 檢查 secret
curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$CF_KV_NAMESPACE_ID/values/secret:YOUR_SECRET_NAME" \
  -H "Authorization: Bearer $CF_API_TOKEN"

# 應該返回 {"value": "actual-api-key"}
```

### **4. 準備測試 Token**

```bash
# 確認 Token 的 scopes 允許訪問此路由
# 方法 1: 使用 tag scope (推薦)
#   路由標籤: ai, media
#   Token scopes: tag:ai
#
# 方法 2: 使用路徑 scope
#   路由: /api/openai
#   Token scopes: openai

# 使用的 Token
TEST_TOKEN="ntk_xxxxxxxxxxxxxxxxx"
```

---

## 🧪 測試步驟

### **Step 1: 基本連通性測試**

```bash
# 測試 Worker 是否能接收請求並正確路由

curl -X GET https://api-gateway.cryptoxlab.workers.dev/api/your-route/health \
  -H "X-API-Key: $TEST_TOKEN" \
  -v

預期結果:
  ✅ 不是 404 (表示路由匹配成功)
  ✅ 不是 401 (表示 Token 驗證成功)
  ✅ 不是 403 (表示 scope 檢查通過)
  
  可能是:
  - 200 (後端服務返回成功)
  - 404 (後端服務的 404，不是 Worker 的)
  - 其他後端錯誤
```

### **Step 2: 後端認證測試**

**如果路由配置了後端認證，需要驗證 Worker 是否正確添加認證 header：**

```bash
# 方法 1: 查看後端服務的錯誤訊息
# 如果後端說 "Missing API Key" 或 "Unauthorized"
# 表示 Worker 沒有正確添加認證

# 方法 2: 使用支援 echo 的測試服務
curl -X POST https://api-gateway.cryptoxlab.workers.dev/api/your-route/echo \
  -H "X-API-Key: $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# 檢查返回的 headers 是否包含後端認證
```

### **Step 3: 實際功能測試**

**根據不同的服務類型，執行實際的 API 調用：**

---

## 📚 常見服務測試範例

### **OpenAI API**

```bash
# 路由配置
路徑: /api/openai
後端 URL: https://api.openai.com/v1
認證: Bearer Token
環境變數: OPENAI_API_KEY

# 測試 Chat Completions
curl -X POST https://api-gateway.cryptoxlab.workers.dev/api/openai/chat/completions \
  -H "X-API-Key: $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Say hello in 5 words"}
    ],
    "max_tokens": 10
  }'

預期結果:
  ✅ 返回 JSON 包含 choices[0].message.content
  ✅ 不是 "You didn't provide an API key" (表示後端認證成功)

成功範例:
{
  "choices": [{
    "message": {
      "content": "Hello, how are you doing?"
    }
  }]
}
```

---

### **Perplexity AI**

```bash
# 路由配置
路徑: /api/perplexity
後端 URL: https://api.perplexity.ai
認證: Bearer Token
環境變數: PERPLEXITY_API_KEY

# 測試
curl -X POST https://api-gateway.cryptoxlab.workers.dev/api/perplexity/chat/completions \
  -H "X-API-Key: $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-sonar-small-128k-online",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ]
  }'

預期結果:
  ✅ 返回 JSON 包含 choices
  ✅ 不是認證錯誤
```

---

### **CloudConvert**

```bash
# 路由配置
路徑: /api/cloudconvert
後端 URL: https://api.cloudconvert.com/v2
認證: Bearer Token
環境變數: CLOUDCONVERT_API_KEY

# 測試 GIF → MP4 轉換
curl -X POST https://api-gateway.cryptoxlab.workers.dev/api/cloudconvert/jobs \
  -H "X-API-Key: $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": {
      "import-gif": {
        "operation": "import/url",
        "url": "https://files.blocktempo.ai/giphy-3.gif"
      },
      "convert-to-mp4": {
        "operation": "convert",
        "input": "import-gif",
        "output_format": "mp4"
      },
      "export-mp4": {
        "operation": "export/url",
        "input": "convert-to-mp4"
      }
    }
  }'

返回:
  Job ID: xxx-xxx-xxx
  Status: waiting

# 查詢處理狀態
JOB_ID="返回的 job id"
curl -X GET https://api-gateway.cryptoxlab.workers.dev/api/cloudconvert/jobs/$JOB_ID \
  -H "X-API-Key: $TEST_TOKEN"

預期結果:
  ✅ status: finished
  ✅ 包含下載 URL
  
提取下載連結:
  | python3 -m json.tool | grep -o 'https://.*\.mp4[^"]*'
```

---

### **AWS S3（範例）**

```bash
# 路由配置
路徑: /api/s3
後端 URL: https://s3.amazonaws.com
認證: API Key
Header: X-Amz-Security-Token
環境變數: AWS_ACCESS_KEY

# 測試 List Buckets
curl -X GET https://api-gateway.cryptoxlab.workers.dev/api/s3/ \
  -H "X-API-Key: $TEST_TOKEN"

預期結果:
  ✅ XML 格式的 bucket 列表
  ✅ 不是 AccessDenied
```

---

### **自建服務（無需認證）**

```bash
# 路由配置
路徑: /api/internal
後端 URL: https://internal.company.com
認證: 無需認證

# 測試
curl -X GET https://api-gateway.cryptoxlab.workers.dev/api/internal/status \
  -H "X-API-Key: $TEST_TOKEN"

預期結果:
  ✅ 返回後端服務的響應
```

---

## ⚠️ 常見問題和解決方案

### **問題 1: 路徑重複（v2/v2/xxx）**

```yaml
症狀:
  後端返回 404，路徑包含重複的部分

原因:
  後端 URL 包含了版本號，但請求路徑也包含

錯誤範例:
  後端 URL: https://api.service.com/v2
  請求: /api/service/v2/endpoint
  結果: https://api.service.com/v2/v2/endpoint ❌

解決:
  選項 A: 後端 URL 不含版本號
    https://api.service.com
  
  選項 B: 請求時不含版本號
    /api/service/endpoint
```

### **問題 2: Token 驗證失敗（401）**

```yaml
症狀:
  "Invalid API Key" 或 "Token not found"

檢查清單:
  1. Token 是否在 KV 中？
     curl KV token:hash
  
  2. Token 是否過期？
     檢查 expires_at
  
  3. Token hash 計算是否正確？
     echo -n "ntk_xxx" | shasum -a 256
```

### **問題 3: Scope 權限不足（403）**

```yaml
症狀:
  "Permission Denied" 或 "Token does not have permission"

檢查:
  1. Token 的 scopes 包含什麼？
  2. 路由的 path 和 tags 是什麼？
  3. 是否匹配？

範例:
  路由: /api/image, tags: [media, premium]
  
  Token scopes 有效:
    ✅ ["*"]
    ✅ ["image"]
    ✅ ["tag:media"]
    ✅ ["tag:premium"]
  
  Token scopes 無效:
    ❌ ["video"]
    ❌ ["tag:public"]
```

### **問題 4: 後端認證失敗**

```yaml
症狀:
  後端服務返回 "Missing API Key" 或 "Unauthorized"

檢查:
  1. Secret 是否在 KV 中？
     curl KV secret:YOUR_KEY_NAME
  
  2. 環境變數名稱是否正確？
     路由配置中的 token_ref 要與 KV 中的 secret 名稱一致
  
  3. Worker 是否最新版本？
     wrangler deploy

調試:
  查看 Worker 日誌:
    wrangler tail
  
  然後執行測試請求，觀察日誌
```

---

## 📝 測試記錄模板

### **路由測試記錄**

```markdown
# 路由: /api/openai

## 配置
- 名稱: OpenAI API
- 路徑: /api/openai
- 後端 URL: https://api.openai.com/v1
- 標籤: ai, llm
- 後端認證: Bearer Token (OPENAI_API_KEY)
- 創建時間: 2025-11-04
- 創建者: Joey Luo

## 測試結果

### Test 1: Chat Completions
日期: 2025-11-04
Token: ntk_Q9AFxV1p2gbE1WyCZntA0cVG_FUTQ52Rdh36KmbQ2LA
請求:
```bash
curl -X POST .../api/openai/chat/completions \
  -H "X-API-Key: $TOKEN" \
  -d '{"model":"gpt-4","messages":[...]}'
```

結果: ✅ 成功
回應: {"choices": [{"message": {"content": "Hello..."}}]}
延遲: ~2s
備註: 正常運作

### Test 2: Embeddings
...

## 問題記錄
- 無

## 最後更新: 2025-11-04
```

---

## 🔄 完整測試流程（SOP）

### **新路由創建後的標準流程**

```yaml
1. 創建路由（UI 操作）
   → 填寫所有必要資訊
   → 如有後端認證，填入環境變數名稱和實際 Key
   → 點擊保存

2. 驗證儲存（30秒內）
   → 檢查資料庫是否有此路由
   → 檢查 KV 是否同步
   → 檢查 secret 是否儲存（如果有）

3. 創建測試 Token（如果沒有）
   → Scopes 包含此路由的標籤或路徑
   → 永不過期（測試用）
   → 記錄 Token 值

4. 基本測試
   → curl 簡單的 GET 請求
   → 確認不是 404/401/403

5. 功能測試
   → 執行實際的 API 調用
   → 驗證返回結果正確
   → 記錄測試結果

6. 記錄文檔
   → 更新測試記錄
   → 記錄任何問題或注意事項
```

---

## 🎯 測試命令快速參考

### **通用測試模板**

```bash
# 設定變數
WORKER_URL="https://api-gateway.cryptoxlab.workers.dev"
TEST_TOKEN="ntk_your_token_here"
ROUTE_PATH="/api/service"

# GET 測試
curl -X GET $WORKER_URL$ROUTE_PATH/endpoint \
  -H "X-API-Key: $TEST_TOKEN"

# POST 測試
curl -X POST $WORKER_URL$ROUTE_PATH/endpoint \
  -H "X-API-Key: $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# 查看詳細資訊（調試用）
curl -X POST $WORKER_URL$ROUTE_PATH/endpoint \
  -H "X-API-Key: $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}' \
  -v  # verbose 模式，顯示所有 headers
```

---

## 📊 測試檢查清單

### **每個新路由必須驗證**

```
路由: ___________________

□ 路由已創建（資料庫中存在）
□ 路由已同步到 KV
□ 後端認證 Secret 已儲存（如果有）
□ Token 的 scopes 包含此路由
□ Worker 能匹配此路由（不是 404）
□ Worker Token 驗證通過（不是 401）
□ Worker Scope 檢查通過（不是 403）
□ 後端認證正確添加（不是後端的 Unauthorized）
□ 實際功能測試通過
□ 測試記錄已更新

測試者: _______________
日期: _________________
狀態: ✅ 通過 / ❌ 失敗
```

---

## 🛠️ 調試工具

### **查看 Worker 即時日誌**

```bash
cd worker
wrangler tail --format pretty

# 然後在另一個終端機執行測試請求
# 可以看到 Worker 的 console.log 和錯誤
```

### **檢查 KV 中的所有 Keys**

```bash
cd backend
source .env

# 列出所有 keys
curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$CF_KV_NAMESPACE_ID/keys" \
  -H "Authorization: Bearer $CF_API_TOKEN" | python3 -m json.tool

# 查看特定 key
curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$CF_KV_NAMESPACE_ID/values/KEY_NAME" \
  -H "Authorization: Bearer $CF_API_TOKEN"
```

### **手動同步路由到 KV**

```bash
cd backend
uv run python -c "
import asyncio
import sys
sys.path.insert(0, '.')
from main import sync_routes_to_kv, db

async def main():
    await db.connect()
    await sync_routes_to_kv()
    print('✅ Routes synced to KV')
    await db.disconnect()

asyncio.run(main())
"
```

---

## 📖 測試案例庫

### **測試案例 1: OpenAI Chat**

```bash
服務: OpenAI GPT-4
路由: /api/openai
測試時間: 2025-11-04
Token: ntk_Q9AFxV1p2gbE1WyCZntA0cVG_FUTQ52Rdh36KmbQ2LA

命令:
curl -X POST https://api-gateway.cryptoxlab.workers.dev/api/openai/chat/completions \
  -H "X-API-Key: ntk_Q9AFxV1p2gbE1WyCZntA0cVG_FUTQ52Rdh36KmbQ2LA" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Say hello"}]}'

結果: ✅ 成功
回應: "Hello, how are you doing today?"
延遲: 約 2 秒
```

### **測試案例 2: CloudConvert GIF→MP4**

```bash
服務: CloudConvert
路由: /api/cloudconvert
測試時間: 2025-11-04
Token: ntk_Q9AFxV1p2gbE1WyCZntA0cVG_FUTQ52Rdh36KmbQ2LA

命令:
curl -X POST https://api-gateway.cryptoxlab.workers.dev/api/cloudconvert/jobs \
  -H "X-API-Key: ntk_Q9AFxV1p2gbE1WyCZntA0cVG_FUTQ52Rdh36KmbQ2LA" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": {
      "import-gif": {
        "operation": "import/url",
        "url": "https://files.blocktempo.ai/giphy-3.gif"
      },
      "convert-to-mp4": {
        "operation": "convert",
        "input": "import-gif",
        "output_format": "mp4"
      },
      "export-mp4": {
        "operation": "export/url",
        "input": "convert-to-mp4"
      }
    }
  }'

結果: ✅ 成功
Job ID: 23655d9c-5aa9-4edf-a004-bf89b0615153
處理時間: 1 秒
輸出: giphy-3.mp4 (188 KB，原始 2.3 MB)
下載連結: https://us-east.storage.cloudconvert.com/tasks/...
```

---

## 🔍 故障排查指南

### **錯誤：404 Route Not Found**

```
可能原因:
  1. 路由路徑不匹配
  2. KV 中沒有此路由
  3. Worker 版本過舊

解決:
  1. 檢查路由路徑拼寫
  2. 重新同步到 KV
  3. 重新部署 Worker: wrangler deploy
```

### **錯誤：401 Invalid API Key**

```
可能原因:
  1. Token 不在 KV 中
  2. Token 已過期
  3. Token hash 計算錯誤

解決:
  1. 檢查 KV: curl token:hash
  2. 檢查過期時間
  3. 重新創建 Token
```

### **錯誤：403 Permission Denied**

```
可能原因:
  1. Token scopes 不包含此路由
  2. 路由標籤不匹配

解決:
  1. 編輯 Token，添加正確的 scope
  2. 或使用 ["*"] 全部權限測試
```

### **錯誤：後端服務的 Unauthorized**

```
可能原因:
  1. Secret 沒有儲存到 KV
  2. 環境變數名稱不匹配
  3. Worker 沒有讀取 secret

解決:
  1. curl 檢查 KV secret:KEY_NAME
  2. 對比路由配置的 token_ref
  3. 查看 Worker 日誌
  4. 重新部署 Worker
```

---

## 📝 最佳實踐

### **測試順序建議**

```
1. 先測試無認證的路由（簡單）
   → 確保基本路由功能正常

2. 再測試有認證的路由
   → 驗證後端認證功能

3. 最後測試複雜的多步驟流程
   → 確保完整功能
```

### **Token 管理**

```
測試用 Token:
  - 名稱: Test Token
  - Scopes: ["*"] (測試時全部權限)
  - 永不過期
  - 記錄在安全的地方

生產用 Token:
  - 最小權限原則
  - 設定過期時間
  - 定期輪換
```

### **文檔記錄**

```
每個路由都應該有:
  □ API 文檔連結
  □ 測試成功的 curl 命令
  □ 預期的回應範例
  □ 常見錯誤和解決方案
  □ 最後測試日期和測試者
```

---

## 🎓 學習資源

### **理解 Worker 的路徑處理**

```javascript
請求: https://worker.dev/api/service/endpoint?param=value
路由: /api/service
後端: https://backend.com/v1

Worker 處理:
  1. 匹配路由: /api/service ✅
  2. 提取剩餘路徑: /endpoint
  3. 保留 query: ?param=value
  4. 拼接: https://backend.com/v1/endpoint?param=value
  5. 轉發
```

### **理解 Scope 檢查**

```javascript
路由: /api/image/upload
標籤: [media, premium]

Token scopes 檢查:
  1. 有 "*"? → 允許
  2. 有 "image"? → 提取 /api/image → image → 允許
  3. 有 "tag:media"? → 路由有 media 標籤 → 允許
  4. 有 "tag:premium"? → 路由有 premium 標籤 → 允許
  5. 都沒有 → 拒絕
```

---

## 🚀 快速測試腳本

```bash
#!/bin/bash
# test-route.sh

WORKER_URL="https://api-gateway.cryptoxlab.workers.dev"
TOKEN="ntk_your_token"
ROUTE_PATH="/api/service"
METHOD="GET"
DATA=""

echo "測試路由: $ROUTE_PATH"
echo "使用 Token: ${TOKEN:0:20}..."
echo ""

if [ "$METHOD" = "POST" ]; then
  curl -X POST $WORKER_URL$ROUTE_PATH \
    -H "X-API-Key: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$DATA" \
    -w "\n\nHTTP Status: %{http_code}\nTime: %{time_total}s\n"
else
  curl -X GET $WORKER_URL$ROUTE_PATH \
    -H "X-API-Key: $TOKEN" \
    -w "\n\nHTTP Status: %{http_code}\nTime: %{time_total}s\n"
fi
```

---

**文件版本**: 1.0  
**最後更新**: 2025-11-04  
**維護者**: AI Team

