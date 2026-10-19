import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    // Ver apps/api/vitest.config.ts: com jsdom a partida é ainda mais cara, e o
    // padrão de 5 s produzia falhas que não se reproduziam.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
