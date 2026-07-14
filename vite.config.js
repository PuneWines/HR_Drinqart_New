import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/hr_system/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/device-logs': {
        target: 'http://103.195.203.77:15167',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/device-logs/, '/api/v2/WebAPI/GetDeviceLogs')
      }
    }
  }
})