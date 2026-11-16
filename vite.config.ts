import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The browser stays on this origin. IRSA is reached only by server/spherex.py.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // A public tunnel sends its own hostname. Localhost-only would reject that link.
    allowedHosts: true,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})
