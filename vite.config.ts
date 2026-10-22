import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  build: { chunkSizeWarningLimit: 1500 },
  server: { host: '0.0.0.0' },
})
