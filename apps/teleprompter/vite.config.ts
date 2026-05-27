import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/teleprompter/',
  resolve: {
    alias: {
      '@showstack/teleprompter-ui': path.resolve(__dirname, '../../packages/teleprompter-ui/src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api':   { target: 'http://localhost:9876', changeOrigin: true },
      '/media': { target: 'http://localhost:9876', changeOrigin: true },
    },
  },
  css: {
    postcss: path.resolve(__dirname, '../../packages/teleprompter-ui/postcss.config.js'),
  },
});
