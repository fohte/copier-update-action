import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
      '@test': '/test',
    },
  },
  test: {
    globalSetup: ['./test/global-setup.ts'],
  },
})
