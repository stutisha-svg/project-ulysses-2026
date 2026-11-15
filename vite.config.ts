import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The SPHEREx fetcher proxies /api in the next build step. Do not call IRSA from the browser.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})
