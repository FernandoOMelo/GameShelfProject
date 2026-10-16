# Experiência Mobile

Há duas formas de usar o GameShelf no celular: a **PWA** (o próprio `apps/web`
instalado pelo navegador) e o **app Flutter** (`apps/mobile`). As duas falam com a
mesma API. Este documento cobre as duas; o objetivo e os princípios valem para ambas.

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

Não transformar o mobile em uma cópia reduzida do dashboard desktop. Consultar a
biblioteca e o detalhe de um jogo é permitido — o que não entra no celular é a
edição: cadastrar e alterar jogos, listas e metas continua só no desktop. Ver ADR-016.

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

## App Flutter (`apps/mobile`)

App nativo Android em Dart/Flutter, com Riverpod para estado e dio para HTTP. O
endereço do servidor é configurável em Ajustes. Quatro abas:

- **Jogando**: jogo atual com cronômetro, iniciar e encerrar sessão;
- **Biblioteca**: lista com busca por título, capa e status; abre o detalhe do jogo
  com estimativas, total jogado e histórico de sessões (somente leitura);
- **Fila**: fila ordenável por arrastar, com remoção;
- **Progresso**: indicadores e jogos em andamento.

### Sem conexão no app Flutter

Mesma doutrina do ADR-015, implementada em sqflite:

- a última resposta de cada GET fica guardada; offline o app mostra esses dados e o
  banner avisa que podem estar defasados, em vez de falhar com "Tentar novamente";
- o cache só entra em erro de conexão — erro HTTP do servidor continua aparecendo;
- iniciar e encerrar sessão offline entram numa fila local e são enviados em ordem ao
  reconectar; 409 é tratado como "já registrada" e a operação sai da fila.

Para compilar sem acesso ao CDN do Google, ver
`apps/mobile/android/download_flutter_artifacts.ps1`.

## Implementação inicial da PWA

A interface adapta biblioteca, fila, painel e formulários para telas estreitas. O botão de registro no jogo atual abre os detalhes com início e término pré-preenchidos; o usuário pode alterar horários e informar progresso e os quatro campos do diário da sessão antes de salvar.
