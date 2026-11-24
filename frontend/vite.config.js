import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Backend del portal en desarrollo. Por defecto 8001 porque el 8000 lo
  // ocupa el backend del sistema interno. Se puede cambiar con
  // VITE_API_PROXY_TARGET en un .env.local (no lo pongas en producción:
  // en Vercel las llamadas van a VITE_API_URL).
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8001'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/static': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
