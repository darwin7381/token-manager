import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 本地開發：http://localhost:8000
        // 生產測試：https://tapi.blocktempo.ai
        target: 'https://tapi.blocktempo.ai',
        changeOrigin: true,
        secure: true,
      },
      '/health': {
        target: 'https://tapi.blocktempo.ai',
        changeOrigin: true,
        secure: true,
      }
    }
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
    allowedHosts: ['token.blocktempo.ai', 'localhost']
  }
})
