import { resolve } from 'node:path';
import { defineConfig } from '@rsbuild/core';
import { pluginVue } from '@rsbuild/plugin-vue';

const PORT = Number(process.env.PORT) || 3002;
const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:3001';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginVue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: PORT,
    proxy: {
      // Proxy API requests to the Node.js API server
      '/api': {
        target: API_SERVER_URL,
        changeOrigin: true,
      },
      // Proxy auth requests to the Node.js API server
      '/auth': {
        target: API_SERVER_URL,
        changeOrigin: true,
      },
    },
  },
});
