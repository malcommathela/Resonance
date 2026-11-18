import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

const src = fileURLToPath(new URL('./src', import.meta.url))
const shared = fileURLToPath(new URL('../../packages/shared', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': src,
      '@shared': shared,
    },
  },
  optimizeDeps: {
    exclude: ['@shared'],  // ← ADD THIS
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    watch: {
      ignored: ['!**/packages/shared/**'],  // ← ADD THIS
    },
  },
})