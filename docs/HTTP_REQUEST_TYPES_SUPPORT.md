# HTTP 請求類型支援狀態

**文檔目的**：
- 記錄 API Gateway 對不同 HTTP 請求類型的支援狀態
- 避免將 HTTP 協議的特性誤認為 bug
- 規劃未來的優化方向

**重要心法**：
> 當遇到問題時，先檢查「這是 HTTP 請求類型的特性」還是「真的是 bug」。
> 不同類型的 HTTP 請求有不同的處理邏輯，了解這些差異能避免誤判。

---

## 📊 支援狀態總覽

| 請求類型 | 支援狀態 | 優先級 | 說明 |
|---------|---------|--------|------|
| **標準請求** (GET/POST/PUT/DELETE) | ✅ 完整支援 | P0 | 最常見，已完整測試 |
| **Redirect 請求** (3xx) | ✅ 完整支援 | P0 | Location header 重寫 |
| **OPTIONS 預檢** | ⚠️ 基本支援 | P1 | 可優化（避免轉發） |
| **大檔案上傳** (>100MB) | ⚠️ 部分支援 | P2 | 有 OOM 風險 |
| **串流響應** (SSE, video) | ⚠️ 部分支援 | P2 | 未測試 |
| **WebSocket 升級** | ❌ 不支援 | P3 | 需要架構調整 |
| **Range Requests** | ⚠️ 未測試 | P3 | 應該可以，需驗證 |
| **Chunked Encoding** | ⚠️ 未測試 | P3 | 應該可以，需驗證 |

---

## 🟢 完整支援的類型

### 1. 標準 HTTP 請求

**定義**: 返回 2xx/4xx/5xx 狀態碼的普通請求

**支援的方法**:
- ✅ GET - 獲取資源
- ✅ POST - 創建資源
- ✅ PUT - 更新資源
- ✅ PATCH - 部分更新
- ✅ DELETE - 刪除資源
- ✅ HEAD - 獲取 headers

**實現細節**:
```javascript
// worker/src/worker.js 第 211-276 行
// 1. Body buffer 化（POST/PUT/PATCH）
// 2. 轉發到後端
// 3. 直接返回 response（不修改）
```

**測試狀態**: ✅ 已測試
```bash
# GET 請求
curl https://api-gateway.../api/service/resource \
  -H "X-API-Key: ntk_xxx"

# POST 請求  
curl -X POST https://api-gateway.../api/service/create \
  -H "X-API-Key: ntk_xxx" \
  -d '{"data": "value"}'
```

**已知問題**: 無

---

### 2. Redirect 請求 (HTTP 3xx)

**定義**: 後端返回 3xx 狀態碼的 redirect 響應

**支援的狀態碼**:
- ✅ 301 Moved Permanently - 永久重定向
- ✅ 302 Found - 臨時重定向
- ✅ 303 See Other - Post-Redirect-Get
- ✅ 307 Temporary Redirect - 臨時重定向（保持方法）
- ✅ 308 Permanent Redirect - 永久重定向（保持方法）

**實現細節**:
```javascript
// worker/src/worker.js 第 231-259 行
// 1. 檢測 3xx 狀態碼
// 2. 提取 Location header
// 3. 重寫為 Gateway URL
// 4. 保留所有其他 headers
```

**Location 重寫邏輯**:
```
後端返回: https://backend.com/resource
Gateway 返回: https://api-gateway.../api/prefix/resource

後端返回: /resource
Gateway 返回: https://api-gateway.../api/prefix/resource

後端返回: https://external.com/callback
Gateway 返回: https://external.com/callback (不重寫外部 URL)
```

**測試狀態**: ✅ 已測試
```bash
# HedgeDoc 創建筆記（返回 302）
curl -X POST https://api-gateway.../api/hedgedoc/new \
  -H "X-API-Key: ntk_xxx" \
  -d "# Test"

# 驗證 Location header 正確重寫
# location: https://api-gateway.../api/hedgedoc/xxx ✅
```

**已知問題**: 
- ⚠️ Redirect chain（多次 redirect）只重寫第一次
- 風險: 低（大多數服務只 redirect 一次）

**相關文檔**: 
- `/docs/solutions/REDIRECT_HANDLING_SOLUTION.md`
- `/docs/CRITICAL_ERRORS_LEARNED.md` (錯誤 #0)

---

## ⚠️ 部分支援的類型

### 3. OPTIONS 預檢請求

**定義**: 瀏覽器在跨域請求前發送的預檢請求

**當前狀態**: ⚠️ 基本支援，但未優化

**問題**:
```javascript
// 當前實現
// OPTIONS 請求會被轉發到後端
// → 增加延遲（不必要）
// → 浪費後端資源

// 理想實現
// OPTIONS 應該在 Gateway 直接返回
// → 0 延遲
// → 不打擾後端
```

**優化方案** (P1):
```javascript
// 在驗證 Token 之前處理 OPTIONS
if (request.method === 'OPTIONS') {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }
  });
}
```

**影響**: 
- 瀏覽器使用者會有輕微延遲
- 非瀏覽器客戶端（curl, n8n）不受影響

---

### 4. 大檔案請求 (>100MB)

**定義**: Request body 超過 100MB 的請求

**當前狀態**: ⚠️ 部分支援，有 OOM 風險

**問題**:
```javascript
// 第 215 行
bodyContent = await request.arrayBuffer();
// ⚠️ 大 body (>100MB) 可能導致 Worker OOM
```

**影響的場景**:
- 視頻上傳 (可能數百 MB)
- 大數據匯入 (可能數十 MB 的 JSON/CSV)
- 大圖片上傳 (可能數十 MB)

**當前限制**:
- ⚠️ 如果遇到 redirect，大檔案會失敗
- ⚠️ 超過 Worker 記憶體限制會 OOM

**優化方案** (P2):
```javascript
// 檢測超大 body，直接轉發 stream
const contentLength = parseInt(request.headers.get('content-length') || '0');
const MAX_BUFFER_SIZE = 100 * 1024 * 1024; // 100MB

if (contentLength > MAX_BUFFER_SIZE) {
  // 直接轉發 stream（但無法處理 redirect）
  bodyContent = request.body;
} else {
  // Buffer 化（支援 redirect）
  bodyContent = await request.arrayBuffer();
}
```

**建議**:
- 目前：避免在會 redirect 的端點上傳大檔案
- 未來：實施大小檢測和 stream 直傳

---

### 5. 串流響應 (Streaming Response)

**定義**: Response body 是 ReadableStream 的響應

**常見場景**:
- Server-Sent Events (SSE) - 實時推送
- ChatGPT API - 逐字返回
- 視頻串流 - 漸進式下載
- 大檔案下載 - 分塊傳輸

**當前狀態**: ⚠️ 應該可以，但未測試

**實現分析**:
```javascript
// 當前代碼
finalResponse = new Response(backendResponse.body, {
  status: backendResponse.status,
  headers: newHeaders
});

// backendResponse.body 如果是 stream，應該可以直接轉發
// 但沒有測試過
```

**潛在問題**:
- 不確定 Cloudflare Worker 是否支援 stream 轉發
- 可能有超時限制
- 可能有大小限制

**測試計劃** (P2):
```bash
# 測試 SSE
curl -N https://api-gateway.../api/ai/chat/stream \
  -H "X-API-Key: ntk_xxx"

# 測試大檔案下載
curl https://api-gateway.../api/storage/video.mp4 \
  -H "X-API-Key: ntk_xxx" \
  -o video.mp4
```

**建議**:
- 目前：假設可以，但未經測試
- 遇到問題時：先測試串流類型是否受影響

---

## ❌ 不支援的類型

### 6. WebSocket 升級

**定義**: HTTP 升級為 WebSocket 協議

**當前狀態**: ❌ 不支援

**問題**:
```javascript
// WebSocket 升級需要特殊處理
// 當前的 Request/Response 模型不支援
```

**影響的場景**:
- 實時通訊（聊天、通知）
- 遊戲服務
- 協同編輯
- 實時儀表板

**為何不支援**:
1. Cloudflare Worker 的 WebSocket 需要特殊 API
2. Token 驗證只在連接時做一次
3. 長連接的計費和管理複雜

**替代方案**:
- 使用 Server-Sent Events (SSE) - 單向推送
- 使用 Long Polling - 較簡單的實時更新
- 直接連接後端（繞過 Gateway）

**未來可能性** (P3):
- 需要架構調整
- 需要特殊的 Token 傳遞機制
- 可能需要獨立的 WebSocket Gateway

---

## ⚪ 未測試的類型

### 7. Range Requests (部分下載)

**定義**: 使用 `Range: bytes=0-1023` header 的請求

**常見場景**:
- 視頻播放器（拖動進度條）
- 大檔案斷點續傳
- PDF 瀏覽器（只載入部分頁面）

**當前狀態**: ⚪ 未測試，應該可以

**理論分析**:
```javascript
// Range header 在 backendHeaders 中
// 會被轉發到後端
// 後端返回 206 Partial Content
// Gateway 應該能正確轉發
```

**測試計劃** (P3):
```bash
# 測試 Range request
curl https://api-gateway.../api/storage/large-file.pdf \
  -H "X-API-Key: ntk_xxx" \
  -H "Range: bytes=0-1023"

# 預期: 206 Partial Content
```

---

### 8. Chunked Transfer Encoding

**定義**: 不知道長度的 response，分塊傳輸

**當前狀態**: ⚪ 未測試，應該可以

**理論分析**:
```javascript
// Fetch API 應該自動處理 chunked encoding
// Gateway 只是透明轉發
```

---

## 🎯 快速判斷指南

### 你的 API 是哪種類型？

#### 步驟 1: 檢查響應狀態碼

```bash
curl -I https://your-backend.com/endpoint
```

- **2xx (200, 201, 204)** → 標準請求 ✅ 完整支援
- **3xx (301, 302, 303, 307, 308)** → Redirect 請求 ✅ 完整支援
- **4xx/5xx** → 錯誤響應 ✅ 完整支援

#### 步驟 2: 檢查特殊 Headers

```bash
curl -I https://your-backend.com/endpoint | grep -i "transfer-encoding\|content-type\|upgrade"
```

- **`Transfer-Encoding: chunked`** → Chunked 編碼 ⚪ 應該可以
- **`Content-Type: text/event-stream`** → SSE 串流 ⚠️ 未測試
- **`Upgrade: websocket`** → WebSocket ❌ 不支援

#### 步驟 3: 檢查 Request Body 大小

```bash
# 如果你要上傳的檔案 > 100MB
ls -lh your-file.mp4
```

- **< 100MB** → ✅ 完整支援
- **> 100MB** → ⚠️ 避免使用會 redirect 的端點

---

## 📋 遇到問題時的檢查清單

當 Gateway 出現問題時，按此順序檢查：

### [ ] 1. 確認請求類型
```bash
curl -I https://your-backend.com/endpoint
# 看狀態碼、headers
```

### [ ] 2. 對比直接請求後端 vs 透過 Gateway
```bash
# 直接請求
curl -i https://backend.com/endpoint

# 透過 Gateway
curl -i https://api-gateway.../api/prefix/endpoint \
  -H "X-API-Key: ntk_xxx"

# 比較差異
```

### [ ] 3. 檢查本文檔的支援狀態
- 在上面的表格中查找你的請求類型
- 確認是「完整支援」還是「部分支援」

### [ ] 4. 查看相關錯誤記錄
- `/docs/CRITICAL_ERRORS_LEARNED.md` - 已知的錯誤
- `/docs/solutions/` - 相關解決方案

### [ ] 5. 判斷是「HTTP 特性」還是「Bug」

**是 HTTP 特性**：
- 本文檔標記為「不支援」或「未測試」
- 直接請求後端也有同樣的特性

**是 Bug**：
- 本文檔標記為「完整支援」但失敗
- 直接請求後端正常，透過 Gateway 失敗

---

## 🚀 未來優化計劃

### Phase 1: 基礎優化 (P1)
- [ ] OPTIONS 預檢優化（在 Gateway 直接返回）
- [ ] CORS headers 自動添加
- [ ] 錯誤訊息改進（區分不同錯誤類型）

### Phase 2: 進階功能 (P2)
- [ ] 大檔案檢測和 stream 直傳
- [ ] 串流響應測試和驗證
- [ ] DELETE 請求 body 處理
- [ ] Timeout 配置（不同路由不同超時）

### Phase 3: 特殊場景 (P3)
- [ ] Range Requests 測試驗證
- [ ] Chunked Encoding 測試驗證
- [ ] Multipart Form Data 測試驗證
- [ ] WebSocket 可行性研究

---

## 📞 回報問題

如果你遇到本文檔未記錄的請求類型問題：

1. **收集資訊**:
   ```bash
   # 直接請求後端
   curl -i https://backend.com/endpoint > backend.txt
   
   # 透過 Gateway
   curl -i https://api-gateway.../endpoint \
     -H "X-API-Key: ntk_xxx" > gateway.txt
   
   # 比較差異
   diff backend.txt gateway.txt
   ```

2. **描述問題**:
   - 請求類型（GET/POST/...）
   - 後端狀態碼
   - 特殊 headers（如有）
   - 預期行為 vs 實際行為

3. **更新文檔**:
   - 在本文檔中記錄新發現的類型
   - 更新支援狀態表格
   - 建立對應的解決方案文檔

---

**最後更新**: 2025-11-08  
**維護者**: Development Team  
**相關文檔**: 
- `/docs/solutions/REDIRECT_HANDLING_SOLUTION.md`
- `/docs/CRITICAL_ERRORS_LEARNED.md`
- `/API_GATEWAY_USAGE.md`

