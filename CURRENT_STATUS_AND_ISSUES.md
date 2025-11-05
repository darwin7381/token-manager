# 當前系統狀態和問題分析

**日期**: 2025-11-04  
**狀態**: 正在梳理和修復  

---

## ✅ 已清理

```bash
✅ 清空所有路由數據（PostgreSQL）
✅ 清空 Cloudflare KV 路由配置
✅ 移除所有舊的測試數據
✅ 準備全新開始
```

---

## 🔍 當前代碼邏輯檢查

### **後端 - routes 表 Schema**

```sql
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    path VARCHAR(255) UNIQUE,
    backend_url TEXT,
    description TEXT,
    tags TEXT[],
    backend_auth_type VARCHAR(50) DEFAULT 'none',
    backend_auth_config JSONB,  ← 正確，JSONB 類型
    created_at TIMESTAMP
)

✅ Schema 正確
```

### **後端 - 創建路由邏輯**

```python
# main.py: create_route()

1. 接收 backend_auth_secrets (實際密鑰)
   → 發送到 Cloudflare KV (secret:KEY_NAME)
   
2. 接收 backend_auth_config (環境變數名稱)
   → 儲存到 PostgreSQL (JSONB 格式)
   
3. 同步路由到 KV
   → 包含 auth 配置（引用）

✅ 邏輯正確
⚠️ 問題: asyncpg 自動處理 JSONB，不需要 json.dumps
   已修復: 移除了 json.dumps()
```

### **前端 - RouteForm**

```javascript
用戶輸入:
  環境變數名稱: PERPLEXITY_API_KEY
  實際 Token: pplx-xxxxx

發送到後端:
  backend_auth_config: {
    token_ref: "PERPLEXITY_API_KEY"
  }
  backend_auth_secrets: {
    "PERPLEXITY_API_KEY": "pplx-xxxxx"
  }

✅ 邏輯正確
```

### **Cloudflare Worker**

```javascript
讀取路由配置:
  route.auth.config.token_ref = "PERPLEXITY_API_KEY"

讀取實際 Key:
  1. 先從 env.PERPLEXITY_API_KEY 讀取
  2. 如果沒有，從 KV secret:PERPLEXITY_API_KEY 讀取

添加到請求:
  headers.set('Authorization', `Bearer ${actualToken}`)

✅ 邏輯正確
```

---

## ⚠️ 發現的問題

### **問題 1: 標籤不匹配**

```
用戶創建時填入: ai, llm, openai
編輯時顯示: core（不匹配）

原因分析:
  可能是編輯時載入了錯誤的數據
  或者標籤沒有正確保存

需要檢查:
  - 創建路由時 tags 是否正確儲存
  - 編輯路由時 tags 是否正確載入
```

### **問題 2: 編輯保存失敗**

```
用戶點擊保存 → 失敗

可能原因:
  1. backend_auth_config 格式問題（已修復）
  2. backend_auth_secrets 處理問題
  3. JSONB 類型轉換問題

已修復:
  ✅ 移除 json.dumps()
  ✅ 讓 asyncpg 自動處理 JSONB
  ✅ 添加 backend_auth_secrets 處理到 update API
```

### **問題 3: 環境變數名稱可以隨便改？**

```yaml
問題: 如果編輯時改了環境變數名稱，會怎樣？

範例:
  原本: PERPLEXITY_API_KEY
  改成: PPLX_KEY

結果:
  - 資料庫儲存新名稱: PPLX_KEY
  - KV 中舊的 secret:PERPLEXITY_API_KEY 還在
  - Worker 會找 env.PPLX_KEY 或 KV secret:PPLX_KEY
  - 找不到！因為實際儲存在 secret:PERPLEXITY_API_KEY

解決方案:
  選項 A: 刪除舊 secret，創建新 secret
  選項 B: 不允許修改環境變數名稱（鎖定）
  選項 C: 提示用戶需要重新輸入實際 Key

建議: 選項 B - 環境變數名稱不可修改
```

---

## 🎯 修復計劃

### **立即修復**

1. **鎖定環境變數名稱**
   - 編輯時不允許修改環境變數名稱
   - 只能修改實際的 Key 值

2. **驗證標籤保存**
   - 確保創建時標籤正確儲存
   - 確保編輯時標籤正確載入

3. **測試完整流程**
   - 創建路由
   - 編輯路由
   - 使用 Token 調用

---

## 📝 下一步

1. 修復環境變數名稱編輯問題
2. 測試創建和編輯功能
3. 端到端測試（n8n → Worker → 後端服務）

---

讓我現在開始修復...

