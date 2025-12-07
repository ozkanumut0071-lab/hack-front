import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // DIŞ bağlantılara izin verir
    allowedHosts: [
      "jacquelynn-juvenal-undisastrously.ngrok-free.dev",
      "*.ngrok-free.dev",
      "*.ngrok-free.app",
      "*.ngrok.io"
    ],
    proxy: {
      '/api': {
        target: 'https://pro-api.coinmarketcap.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/backend': {
        target: process.env.VITE_API_URL || 'https://hack-back-w2jw.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
    },
  },
})