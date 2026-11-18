import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

function pagesFallback(): Plugin {
  return {
    name: 'pages-fallback',
    apply: 'build',
    closeBundle() {
      const dist = resolve('dist')
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
    },
  }
}

export default defineConfig({
  base: '/smashburguerafogados-app/',
  plugins: [react(), pagesFallback()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
