# Token Manager Frontend

React + Vite 前端應用

## 🚀 啟動方式（正規）

### 前置需求

- Node.js 18+ (推薦使用 LTS 版本)
- npm 或 pnpm

### 1. 安裝依賴

```bash
# 使用 npm（標準方式）
npm install

# 或使用 pnpm（更快）
pnpm install
```

### 2. 設定環境變數

複製 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

編輯 `.env` 填入正確的值：

```bash
# Clerk Configuration
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Backend API
VITE_API_BASE_URL=http://localhost:8000
```

**注意：** Vite 需要 `VITE_` 前綴才能在前端訪問環境變數！

### 3. 啟動開發服務器

```bash
# 使用 npm
npm run dev

# 或使用 pnpm
pnpm dev
```

開發服務器將啟動在 http://localhost:5173

**Vite 特性：**
- ⚡️ 極速熱模組替換（HMR）
- 🎯 即時錯誤提示
- 📦 自動依賴預構建

### 4. 驗證服務

打開瀏覽器訪問：http://localhost:5173

---

## 📦 生產環境構建

### 構建

```bash
# 構建生產版本
npm run build

# 預覽構建結果
npm run preview
```

構建產物將輸出到 `dist/` 目錄。

### 部署

構建完成後，可以部署到任何靜態託管服務：

- **Vercel**: `vercel deploy`
- **Netlify**: `netlify deploy`
- **Cloudflare Pages**: 推送到 GitHub 自動部署
- **Nginx/Apache**: 將 `dist/` 內容複製到服務器

---

## 🛠️ 開發指令

### 安裝新套件

```bash
# 使用 npm
npm install package-name

# 開發依賴
npm install -D package-name
```

### 代碼檢查

```bash
# ESLint 檢查
npm run lint

# 自動修復
npm run lint:fix
```

### 格式化

```bash
# 使用 Prettier（如果有設定）
npm run format
```

---

## 📂 專案結構

```
frontend/
├── src/
│   ├── components/      # React 組件
│   │   ├── Auth/        # 認證相關
│   │   ├── Layout/      # 布局組件
│   │   ├── TokenManager/
│   │   ├── RouteManager/
│   │   └── UserManagement/
│   ├── constants/       # 常量定義
│   │   └── roles.js     # 角色和權限
│   ├── hooks/           # 自定義 Hooks
│   │   └── usePermissions.js
│   ├── services/        # API 服務
│   │   ├── api.js
│   │   └── useAuthenticatedApi.js
│   ├── utils/           # 工具函數
│   ├── App.jsx          # 主應用
│   ├── main.jsx         # 入口文件
│   └── index.css        # 全局樣式
├── public/              # 靜態資源
├── index.html           # HTML 模板
├── vite.config.js       # Vite 配置
├── package.json         # 依賴和腳本
├── .env                 # 環境變數（不要提交）
├── .env.example         # 環境變數範例
└── README.md            # 本文件
```

---

## 🎨 技術棧

- **React 18** - UI 框架
- **Vite** - 構建工具
- **React Router** - 路由管理
- **Clerk** - 認證服務
- **Lucide React** - 圖標庫

---

## 🔧 常見問題

### Q: 為什麼使用 Vite 而不是 Create React App？

**A:** Vite 比 CRA 快得多：
- 開發服務器啟動：快 10-100 倍
- 熱模組替換（HMR）：幾乎即時
- 生產構建：更小更快

### Q: 環境變數不生效

**A:** 確認：
1. 變數名稱有 `VITE_` 前綴
2. 修改 `.env` 後重啟開發服務器
3. 在代碼中使用 `import.meta.env.VITE_XXX` 訪問

### Q: npm run dev 啟動失敗

**A:** 
1. 刪除 `node_modules` 和 `package-lock.json`
2. 重新安裝：`npm install`
3. 確認 Node.js 版本 >= 18

### Q: 端口 5173 被佔用

**A:** 修改 `vite.config.js`：
```js
export default defineConfig({
  server: {
    port: 3000  // 改成其他端口
  }
})
```

---

## 🔐 認證流程

1. 用戶訪問應用
2. Clerk 檢測未登入 → 導向登入頁
3. 用戶使用 Google 登入
4. Clerk 返回 session token
5. 前端在所有 API 請求帶上 token
6. 後端驗證 token 並返回數據

---

## 📚 相關文檔

- [Vite 官方文檔](https://vitejs.dev/)
- [React 官方文檔](https://react.dev/)
- [Clerk React SDK](https://clerk.com/docs/references/react/overview)
- [React Router](https://reactrouter.com/)

---

**開發愉快！** 🎉

如有問題，請查看 `docs/` 目錄下的詳細文檔。
