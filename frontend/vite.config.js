/* global process */  // vite.config runs in Node
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // On Vercel, a missing backend address would ship a site that calls the visitor's own computer
  // (localhost) and fails everywhere. Stop the build with a clear message instead (src/config.js).
  const env = loadEnv(mode, process.cwd(), '')
  if (process.env.VERCEL && !env.VITE_API_BASE_URL) {
    throw new Error('Set VITE_API_BASE_URL in Vercel (Project → Settings → Environment Variables), '
      + 'e.g. https://yourname.pythonanywhere.com/api, then redeploy.')
  }
  return {
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
}
})
