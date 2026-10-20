import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Aliases are declared twice on purpose: here for the bundler, and in
// tsconfig.json "paths" for the type-checker and the editor. Keep them in sync.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@packages': fileURLToPath(new URL('./src/packages', import.meta.url)),
      '@test': fileURLToPath(new URL('./src/test', import.meta.url)),
    },
  },
})
