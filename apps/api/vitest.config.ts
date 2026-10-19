import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // O padrão de 5 s expira no primeiro teste de cada arquivo quando a máquina
    // está carregada: o custo é a transformação dos módulos na partida, não o
    // teste em si. Falhas assim apareciam em lotes e sumiam na rodada seguinte.
    // Um limite maior não esconde teste travado — ele ainda falha, só depois.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
