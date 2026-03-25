import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      // 让 Vite 在开发时也能正确解析 Tauri API
      '@tauri-apps/api/core': '@tauri-apps/api/core',
      '@tauri-apps/api/event': '@tauri-apps/api/event',
      '@tauri-apps/plugin-shell': '@tauri-apps/plugin-shell',
      '@tauri-apps/plugin-opener': '@tauri-apps/plugin-opener',
      '@tauri-apps/plugin-dialog': '@tauri-apps/plugin-dialog',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
}))
