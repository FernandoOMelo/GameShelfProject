import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // React muda raramente: separado do código do app, ele fica em cache
        // entre deploys enquanto o chunk da aplicação é atualizado.
        manualChunks: (id) => (id.includes('node_modules/react') || id.includes('node_modules/scheduler') ? 'react' : undefined),
      },
    },
  },
  resolve: {
    alias: {
      '@gameshelf/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Em dev local a API pode subir em outra porta (ex.: ao lado do container
      // docker na 3000); `VITE_PROXY_TARGET` escolhe o alvo sem editar isto.
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/media': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
