import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/projects/backtester/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/projects/backtester': {
        target: 'http://127.0.0.1:4175',
        changeOrigin: true,
      },
      '/projects/backtester/api/projects/backtester': {
        target: 'http://127.0.0.1:4175',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/projects\/backtester/, ''),
      },
    },
  },
});
