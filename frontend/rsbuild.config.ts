import { resolve } from 'node:path';
import { defineConfig } from '@rsbuild/core';
import { pluginVue } from '@rsbuild/plugin-vue';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginVue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3002,
    proxy: {
      // Proxy API requests to the Node.js API server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy auth requests to the Node.js API server
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
