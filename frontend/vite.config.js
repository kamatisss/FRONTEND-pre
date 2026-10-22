/* global process */  // vite.config runs in Node
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// PWA: stamp the service worker (public/sw.js) with this build's id and the files that make up the
// app's first screen, so each deploy installs as a new version and works offline after one visit.
function serviceWorkerVersion() {
  let outDir = 'dist'
  return {
    name: 'garden-studio-sw-version',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    closeBundle() {
      const html = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      const files = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))]
      const precache = ['/', '/manifest.webmanifest', '/icons/icon-192.png', ...files]
      const swPath = resolve(outDir, 'sw.js')
      const sw = readFileSync(swPath, 'utf8')
        .replace("const BUILD_ID = 'dev';", `const BUILD_ID = '${Date.now().toString(36)}';`)
        .replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(precache)};`)
      if (sw.includes("const BUILD_ID = 'dev';")) throw new Error('public/sw.js: BUILD_ID line not found')
      writeFileSync(swPath, sw)
    },
  }
}

export default defineConfig(({ mode }) => {
  // On Vercel, a missing backend address would ship a site that calls the visitor's own computer
  // (localhost) and fails everywhere. Stop the build with a clear message instead (src/config.js).
  const env = loadEnv(mode, process.cwd(), '')
  if (process.env.VERCEL && !env.VITE_API_BASE_URL) {
    throw new Error('Set VITE_API_BASE_URL in Vercel (Project → Settings → Environment Variables), '
      + 'e.g. https://yourname.pythonanywhere.com/api, then redeploy.')
  }
  return {
  plugins: [react(), tailwindcss(), serviceWorkerVersion()],
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
