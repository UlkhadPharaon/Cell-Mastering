import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: false,
    host: 'localhost'
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          mediapipe: ['@mediapipe/tasks-vision']
        }
      }
    }
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts']
  }
});
