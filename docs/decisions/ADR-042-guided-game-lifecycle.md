# ADR-042: ciclo do jogo guiado (começar a jogar e zerar)

## Status

Aceito. Substitui, em parte, a seção "Relação com o status global do jogo" do ADR-023.

## Contexto

Registrar o início de uma jornada, preencher a data de início do jogo e zerar eram
passos manuais em formulários separados. O ADR-023 manteve jornadas e ficha do jogo
desacopladas: concluir uma jornada não zerava o jogo, e a interface deixava o
usuário alinhar os dois por uma ação explícita.

## Decisão

O desacoplamento continua valendo para edições soltas, mas dois **comandos
explícitos** passam a alinhar os dois lados em uma única ação. Tocar em "Iniciar
jornada" ou em "Zerar" é a ação explícita que o ADR-023 exige; a interface sempre
mostra o que será feito e permite "Agora não" ou "Desfazer". Não existe modo
automático sem pergunta.

API (a regra fica no servidor; web e Flutter só apresentam):

- `GET /games/:id/lifecycle` devolve o que oferecer: modo de início (`LINK_ACTIVE`,
  `OFFER_FIRST`, `OFFER_REPLAY`, `OFFER_RESUME`, `OFFER_PLANNED`), plataforma
  sugerida, onde o jogador parou e dados para zerar. Deriva do estado atual, então
  se corrige sozinho após falhas ou uso offline.
- `POST /games/:id/start-playing` cria ou retoma a jornada conforme o modo, preenche
  `games.started_at` só se estiver vazio, muda BACKLOG, PAUSED, ABANDONED e QUEUED para
  Jogando (DESIRED e COMPLETED não mudam; um replay não altera a ficha) e, se `sessionId`
  vier, vincula a sessão à jornada.
- `POST /games/:id/finish` encerra sessões abertas, conclui a jornada em andamento (ou a
  pausada mais recente), cria uma jornada já concluída se o jogo não tem nenhuma, grava
  status Zerado, data de conclusão (padrão: hoje, no fuso do cliente) e os extras
  opcionais (nota, dificuldade, condição, favorito, jogo do ano), tira o jogo da fila e
  registra missões concluídas. Recusa data anterior ao início e jogo Desejado.
- `POST /games/:id/finish/undo` restaura o estado anterior devolvido por `finish`.

## Consequências

- Os repositórios não compartilham transação. As escritas seguem uma ordem que deixa o
  jogo consistente se algo falhar no meio e podem ser repetidas. Uma transação única
  exigiria um repositório composto no Drizzle, que fica como evolução.
- O efeito de zerar sobre fila e missões foi extraído para `challenge/record.ts` e é
  compartilhado com a edição do jogo.
- Os cartões de estatística continuam distintos: jogos zerados pela ficha e jogos com
  jornada concluída; os comandos só tendem a deixá-los alinhados.
