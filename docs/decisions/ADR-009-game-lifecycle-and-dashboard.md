# ADR-009: ciclo do jogo e Painel por período

## Status

Aceito.

## Contexto

A versão 1.0 precisa tratar cada jogo como uma ficha pessoal única, separar
estado, posse, plataforma e fila e oferecer um resumo útil das sessões e
conclusões. O Painel deve ser a tela inicial no homelab.

## Decisão

- O ciclo usa Desejado, Na biblioteca (`BACKLOG`), Jogando, Pausado, Zerado e
  Abandonado. A fila é independente e aceita apenas jogos possuídos e não
  arquivados, zerados ou abandonados.
- Arquivamento é um booleano independente do status. Arquivar esconde o jogo
  das visões padrão e desarquivar recupera o mesmo status.
- Avaliações de 1 a 11 só podem ser informadas ou alteradas enquanto o jogo está
  Zerado ou Abandonado. Uma avaliação existente fica preservada se o status
  mudar para outro estado.
- O Painel inicial lista todos os jogos Jogando com ações de sessão, pausa,
  zerar, abandonar e abertura dos detalhes.
- Estatísticas temporais usam mês atual por padrão, aceitam outros períodos e
  respeitam o fuso do navegador. Sessões abertas não contam como tempo fechado;
  sessões que cruzam limites contribuem apenas com o intervalo selecionado.
- Não registrar histórico de status nesta versão; portanto abandonos são uma
  fotografia do estado atual, não uma contagem histórica.

## Consequências

Uma migration adiciona `DESIRED` e `archived`, converte o status legado `QUEUED`
para `BACKLOG` e remove da fila registros que não atendam às regras atuais. A
data única `completedAt` continua sendo a fonte dos relatórios de conclusão.
