# Experiência Mobile

## Objetivo

O celular serve principalmente para registrar sessões, consultar o jogo atual e verificar a fila.

## Prioridade

### P0

- registrar sessão;
- escolher jogo;
- informar duração;
- informar onde parou;
- salvar.

### P1

- consultar jogo atual;
- consultar fila;
- consultar última sessão.

### P2

- editar sessões;
- visualizar estatísticas.

## Princípio

O fluxo de registro deve ser concluído em poucos toques.

Não transformar o mobile em uma cópia reduzida do dashboard desktop.

## PWA

PWA é desejável, mas não deve bloquear o MVP.

O MVP pode começar como web responsiva.

## Implementação inicial

A interface adapta biblioteca, fila, painel e formulários para telas estreitas. O botão de registro no jogo atual abre os detalhes com início e término pré-preenchidos; o usuário pode alterar horários e informar localização, progresso e notas antes de salvar.
