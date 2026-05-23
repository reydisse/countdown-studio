import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@countdown/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // In dev the API and media live on the Express server (:9876).
      // Vite proxies these paths so relative URLs work the same as in production.
      '/api':    { target: 'http://localhost:9876', changeOrigin: true },
      '/media':  { target: 'http://localhost:9876', changeOrigin: true },
      '/output': { target: 'http://localhost:9876', changeOrigin: true },
    },
  },
  css: {
    // File-path form: postcss-load-config resolves plugins relative to this
    // file's directory (packages/ui/), so tailwindcss v3 is found correctly.
    postcss: path.resolve(__dirname, '../../packages/ui/postcss.config.js'),
  },
});
