# Token Manager 完整系統測試指南

**日期**: 2025-11-04  
**狀態**: 準備測試  
**目的**: 端到端驗證所有功能

---

## 🧹 已完成：系統重置

```bash
✅ 清空所有路由數據（資料庫和 KV）
✅ 準備全新測試環境
```

---

## 📋 完整測試流程

### **Step 1: 創建測試路由（無認證）**

```yaml
操作:
  1. 進入「路由管理」
  2. 點擊「新增路由」
  3. 填寫:
     名稱: Test Route
     路徑: /api/test
     後端 URL: https://httpbin.org/anything
     描述: 測試用路由
     標籤: test, public（按 Enter 添加）
     後端認證: 無需認證
  4. 點擊「新增路由」

預期結果:
  ✅ 路由創建成功
  ✅ 顯示在列表中
  ✅ 認證狀態顯示「🔓 無需認證」
```

---

### **Step 2: 創建 Perplexity API 路由（Bearer Token）**

```yaml
操作:
  1. 點擊「新增路由」
  2. 填寫:
     名稱: Perplexity API
     路徑: /api/perplexity
     後端 URL: https://api.perplexity.ai
     描述: Perplexity LLM Service
     標籤: ai, llm
     
     後端服務認證方式: Bearer Token
     環境變數名稱: PERPLEXITY_API_KEY
     實際的 API Token: pplx-xxxxxxxxxxxxx（你的實際 Key）
  
  3. 點擊「新增路由」

預期結果:
  ✅ 路由創建成功
  ✅ 認證狀態顯示「🔒 bearer」
  ✅ 標籤顯示「ai」「llm」
  
後端日誌應顯示:
  ✅ Stored secret PERPLEXITY_API_KEY to Cloudflare KV

驗證 KV:
  curl "https://api.cloudflare.com/.../secret:PERPLEXITY_API_KEY"
  應該返回加密的 Token
```

---

### **Step 3: 創建 Token**

```yaml
操作:
  1. 進入「Token 管理」
  2. 點擊「創建新 Token」
  3. 填寫:
     名稱: Test Token
     所屬團隊: 選擇一個你所屬的團隊
     權限範圍: 選擇「選擇路由/標籤」
     勾選標籤: ai, llm
     過期: 勾選「永不過期」
  4. 點擊「創建 Token」
  5. 複製 Token: ntk_xxxxxxxxxxxxx

預期結果:
  ✅ Token 創建成功
  ✅ 可以複製 Token
  ✅ Scopes 顯示: tag:ai, tag:llm
```

---

### **Step 4: 測試端到端流程**

```bash
# 使用創建的 Token 調用 Perplexity API

curl -X POST https://your-worker.workers.dev/api/perplexity/chat/completions \
  -H "X-API-Key: ntk_xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-sonar-small-128k-online",
    "messages": [
      {"role": "user", "content": "Hello, test message"}
    ]
  }'

預期結果:
  ✅ Worker 驗證我們的 Token
  ✅ Worker 檢查 scopes (tag:ai 匹配)
  ✅ Worker 添加 Authorization: Bearer pplx-xxx
  ✅ 轉發到 Perplexity API
  ✅ 返回 Perplexity 的響應
```

---

## 🔍 當前系統架構檢查

讓我檢查所有關鍵文件的邏輯是否正確...

