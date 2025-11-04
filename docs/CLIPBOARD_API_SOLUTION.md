# 瀏覽器剪貼簿 API 限制與解決方案

**日期**: 2025-11-03  
**問題**: 為什麼 async 操作後無法使用 `navigator.clipboard.writeText()`？  
**狀態**: ✅ 已解決

---

## 💥 問題描述

### **症狀**

```javascript
// ❌ 這樣會失敗
onClick={async () => {
  const data = await fetch('/api/token/reveal');
  await navigator.clipboard.writeText(data.token);
}}

// 錯誤訊息
NotAllowedError: The request is not allowed by the user agent 
or the platform in the current context, possibly because 
the user denied permission.
```

---

## 🔍 根本原因

### **瀏覽器的安全機制**

```yaml
clipboard API 的限制:
  1. 必須在 HTTPS 下（localhost 除外）
  2. 必須在「用戶手勢」的上下文中
  3. 「用戶手勢上下文」在異步操作後會失效

什麼是用戶手勢上下文？
  用戶點擊按鈕 → 觸發 onClick
    ↓
  [用戶手勢上下文開始]
    ↓
  執行同步代碼 ✅
    ↓
  await async_operation()  ← 異步等待
    ↓
  [用戶手勢上下文結束] ⚠️
    ↓
  clipboard.writeText()  ← 失敗！
```

### **為什麼會這樣設計？**

```
安全考量:
  防止惡意網站在背景偷偷修改剪貼簿
  確保只有用戶「主動點擊」才能操作剪貼簿
  
設計邏輯:
  瀏覽器認為：如果有 async 操作，
  可能是在「等待」某些非用戶控制的事件，
  所以取消剪貼簿權限。
```

---

## ✅ 解決方案

### **方案 1: 預先載入（Perplexity 可能的做法）**

```javascript
// 列表載入時就解密所有 Token
const loadTokens = async () => {
  const tokens = await fetchTokens();
  
  // 解密所有 Token 並存入 state
  const decrypted = await Promise.all(
    tokens.map(t => decryptToken(t.id))
  );
  
  setState(decrypted);
};

// 複製時直接從 state 讀取（同步）
onClick={() => {
  navigator.clipboard.writeText(state.fullToken);  // ✅ 成功
}}

優點:
  ✅ 複製 100% 可靠
  ✅ 立即響應

缺點:
  ❌ 所有 Token 都在前端內存中
  ❌ 安全性較低
  ❌ 列表載入較慢
```

---

### **方案 2: 兩階段點擊（我們的做法，更安全）**

```javascript
// 第一次點擊：打開彈窗 + 異步獲取
onClick={async () => {
  showModal({ loading: true });
  const data = await fetch('/api/reveal');
  setState({ token: data.token });  // 暫存在 state
  showModal({ loading: false });
}}

// 第二次點擊：從 state 複製（同步）
onClick={() => {
  navigator.clipboard.writeText(state.token);  // ✅ 成功！
}}

優點:
  ✅ 複製可靠（在新的用戶點擊上下文中）
  ✅ 更安全（只在需要時才解密）
  ✅ 彈窗關閉後清除內存

缺點:
  ❌ 需要點兩次（但用戶可以接受）
```

---

## 🎯 我們的完整實現

### **代碼結構**

```jsx
// 1. State 管理
const [revealedToken, setRevealedToken] = useState(null);
const [copySuccess, setCopySuccess] = useState(false);

// 2. 第一次點擊：獲取 Token
const handleCopyToken = async (tokenId, tokenName) => {
  // 立即打開彈窗（loading）
  setRevealedToken({ id: tokenId, name: tokenName, token: null, loading: true });
  
  try {
    // 異步獲取解密的 Token
    const authToken = await getToken();
    const data = await revealToken(tokenId, authToken);
    
    // 更新 state（Token 已載入）
    setRevealedToken({ 
      id: tokenId, 
      name: tokenName, 
      token: data.token,  // 完整 Token 存在 state
      loading: false 
    });
  } catch (err) {
    alert('獲取 Token 失敗');
    setRevealedToken(null);
  }
};

// 3. 彈窗顯示（部分 Token）
const maskToken = (token) => {
  if (!token || token.length < 20) return token;
  return `${token.substring(0, 12)}...${token.substring(token.length - 6)}`;
};

// 顯示
<div>{maskToken(revealedToken.token)}</div>  
// 實際: ntk_9qFAGo7M...0xGg

// 4. 第二次點擊：複製（同步，可靠）
<button onClick={() => {
  navigator.clipboard.writeText(revealedToken.token);  // 從 state 讀取
  setCopySuccess(true);
}}>
  複製
</button>

// 5. 關閉彈窗：清除內存
onClick={() => {
  setRevealedToken(null);  // 完整 Token 從內存中移除
  setCopySuccess(false);
}}
```

---

## 🔐 安全性保證

### **HTML 層面**

```html
<!-- 列表中 -->
看不到，因為列表 API 只返回 token_preview

<!-- 彈窗中 -->
<div>ntk_9qFAGo7M...0xGg</div>
<!-- 完整 Token 不在 DOM 中 -->
```

### **JavaScript State**

```javascript
// 關閉彈窗前
revealedToken = {
  token: "ntk_9qFAGo7MN2Ek8vCgyjcId4v1-M-WAFGQV4obecQ0xGg"
}
// ⚠️ React DevTools 可以看到

// 關閉彈窗後
revealedToken = null
// ✅ 完整 Token 已從內存清除
```

### **安全性矩陣**

| 攻擊向量 | 我們的防護 | 結果 |
|---------|----------|------|
| 查看 HTML | 只顯示部分 | ✅ 安全 |
| 截圖 | 只顯示部分 | ✅ 安全 |
| React DevTools | State 中有完整（彈窗打開時） | ⚠️ 需要開發者權限 |
| XSS 攻擊 | 可能讀取 state | ❌ 需要其他防護 |
| 網路監聽 | HTTPS 加密 | ✅ 安全 |
| 資料庫洩漏 | Fernet 加密 | ✅ 安全 |

---

## 📊 與 Perplexity 的對比

| 特性 | Perplexity（推測） | 我們的實現 |
|------|------------------|-----------|
| 列表顯示 | 部分 Token | 部分 Token |
| 列表 API | 可能返回完整 | 只返回部分 |
| 複製按鈕 | 直接複製 | 彈窗複製 |
| 內存中的 Token | 一直存在 | 只在彈窗時存在 |
| 點擊次數 | 1次 | 2次（打開+複製） |
| 安全性 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 用戶體驗 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**結論：我們的做法比 Perplexity 更安全！**

---

## 🎓 技術知識點

### **瀏覽器剪貼簿 API 的三種狀態**

```javascript
// 狀態 1: 同步上下文（✅ 可以）
onClick={() => {
  navigator.clipboard.writeText("hello");
}}

// 狀態 2: Async 函數內（✅ 可以，如果沒有 await）
onClick={async () => {
  navigator.clipboard.writeText("hello");  // 還在同步階段
}}

// 狀態 3: Await 之後（❌ 不行）
onClick={async () => {
  await someAsyncOperation();
  navigator.clipboard.writeText("hello");  // 失敗！
}}

// 狀態 4: 新的用戶點擊（✅ 可以）
// 第一次點擊
onClick={async () => {
  await fetchData();
  setState(data);  // 只是存 state
}}

// 第二次點擊（新的用戶手勢）
onClick={() => {
  navigator.clipboard.writeText(state.data);  // ✅ 成功！
}}
```

---

## 📝 最佳實踐

### **如果需要 async 操作 + 複製**

```javascript
✅ 推薦方案 1: 兩階段操作（我們的做法）
  第一次點擊 → 獲取數據 → 存 state
  第二次點擊 → 從 state 複製

✅ 推薦方案 2: 預先載入
  頁面載入時 → 獲取所有數據 → 存 state
  點擊複製 → 從 state 讀取

❌ 不可行: 在 async 操作後直接複製
  這是瀏覽器的硬性限制，無法繞過
```

---

## 🔮 未來改進（可選）

### **如果要做到「一鍵複製」**

唯一的方法是：**列表 API 返回完整 Token**

```python
# backend/main.py
@app.get("/api/tokens")
async def list_tokens(request: Request):
    # ...
    
    tokens = []
    for row in rows:
        token_dict = dict(row)
        
        # 解密完整 Token
        if token_dict['token_encrypted']:
            token_dict['full_token'] = decrypt_token(token_dict['token_encrypted'])
        
        tokens.append(token_dict)
    
    return tokens

# 前端可以直接複製（不需要額外請求）
onClick={() => {
  navigator.clipboard.writeText(token.full_token);
}}
```

**但這會降低安全性！**

---

## 📝 總結

我們採用的**兩階段複製方案**是在**安全性**和**用戶體驗**之間的最佳平衡：

✅ **比 Perplexity 更安全**（只在需要時才解密）  
✅ **可靠性 100%**（複製在同步上下文中）  
✅ **符合瀏覽器安全規範**  
✅ **用戶體驗可接受**（多點一次可以理解）  

---

**文件版本**: 2.0  
**最後更新**: 2025-11-03  
**實施者**: AI Team

