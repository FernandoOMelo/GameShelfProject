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

O GameShelf é instalável (manifest e ícones) e tem service worker e fila offline de
sessões. Decisões, limites e motivos em ADR-015.

### Sem conexão

- O app carrega a partir do cache e mostra os últimos dados consultados (podem estar
  defasados).
- **Iniciar** e **encerrar** sessões funcionam, no detalhe do jogo e no painel: a
  operação fica guardada no aparelho e um aviso no topo mostra o que está pendente.
  Uma sessão iniciada offline aparece no aviso com "Encerrar agora".
- Ao voltar a conexão (ou ao abrir o app) tudo é enviado em ordem. Se o servidor
  recusar algo (por exemplo, o jogo foi excluído), o item continua no aviso com o
  motivo e um botão "Descartar".
- Não é possível editar jogos, listas ou metas, nem excluir sessões, sem conexão.

### HTTPS é necessário para o PWA completo

Navegadores só registram service workers em HTTPS ou `localhost`. Pelo celular em
`http://<ip-do-host>:8080` não há instalação nem cache do app; a fila de sessões
continua funcionando enquanto a página estiver aberta. Para o PWA completo no
celular, coloque o GameShelf atrás de um reverse proxy com HTTPS.

### Reenvio seguro

`POST /games/:gameId/sessions` responde 409 se o jogo já tem uma sessão iniciada
exatamente no mesmo horário; a fila trata isso como "já registrada", então reenviar
não duplica sessões.

## Implementação inicial

A interface adapta biblioteca, fila, painel e formulários para telas estreitas. O botão de registro no jogo atual abre os detalhes com início e término pré-preenchidos; o usuário pode alterar horários e informar localização, progresso e notas antes de salvar.
