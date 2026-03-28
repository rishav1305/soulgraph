import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const BACKEND_PORT = process.env.SOULGRAPH_BACKEND_PORT ?? '8081';
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to SoulGraph backend (or mock server)
      '/query': BACKEND_URL,
      '/health': BACKEND_URL,
      '/tune': BACKEND_URL,
      '/ws': {
        target: `ws://localhost:${BACKEND_PORT}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-markdown': ['react-markdown', 'rehype-highlight'],
        },
      },
    },
  },
});
