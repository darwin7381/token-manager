import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
    // 不使用 proxy，直接通過 VITE_API_URL 環境變數連接後端
    // 確保後端有正確的 CORS 設置
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
    allowedHosts: ['token.blocktempo.ai', 'localhost']
  }
})
