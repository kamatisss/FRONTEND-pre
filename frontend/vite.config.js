/* global process */  // vite.config runs in Node
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The crew's screens. They load lazily (App.jsx), so without this their files would only be saved the
// first time they're opened online, and a crew member who updates the app ("Refresh") and then loses
// signal before opening them couldn't open them at all. Precached with everything they import.
// (CrewArrival's map loads lazily too, but is only shown online: not needed.)
const CREW_SCREENS = /\/src\/components\/(StaffDashboard|StaffAttendance)\.jsx$/

// PWA: stamp the service worker (public/sw.js) with this build's id and the files that make up the
// app's first screen and the crew's screens, so each deploy installs as a new version and works
// offline after one visit.
function serviceWorkerVersion() {
  let outDir = 'dist'
  let crewFiles = []
  return {
    name: 'garden-studio-sw-version',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    generateBundle(_options, bundle) {
      const files = new Set()
      const add = (fileName) => {
        const chunk = bundle[fileName]
        if (!chunk || files.has(fileName)) return
        files.add(fileName)
        if (chunk.type !== 'chunk') return
        // Code and styles only: what the screen needs to open. Images it uses are saved the first time
        // they're shown (sw.js, site images), so a deploy doesn't re-download ~1 MB of pictures.
        chunk.viteMetadata?.importedCss?.forEach((f) => files.add(f))
        chunk.imports.forEach(add)   // static imports only (lazy ones load when used)
      }
      const entries = Object.values(bundle).filter((c) => c.type === 'chunk' && CREW_SCREENS.test(c.facadeModuleId || ''))
      if (entries.length < 2) {
        throw new Error('vite.config.js: crew screens (StaffDashboard / StaffAttendance) not found as lazy chunks; '
          + 'update CREW_SCREENS so the crew app keeps working offline')
      }
      entries.forEach((c) => add(c.fileName))
      crewFiles = [...files].map((f) => `/${f}`)
    },
    closeBundle() {
      const html = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      const files = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))]
      const precache = [...new Set(['/', '/manifest.webmanifest', '/icons/icon-192.png', ...files, ...crewFiles])]
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
