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

Como decidido em [ADR-022](../decisions/ADR-022-mobile-web-parity.md), o app Flutter
tem **paridade funcional com a web**: além de consultar a biblioteca, o detalhe e os
indicadores, o celular também cria e altera jogos, listas e metas. O princípio de
"poucos toques" continua valendo para o registro de sessão, que segue sendo o fluxo
primário.

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
endereço do servidor é configurável em Ajustes e o app aceita `http://`: o manifest
declara `usesCleartextTraffic`, porque o endereço é escolhido por você em tempo de
execução (não dá para restringir por host) e o self-hosted documentado
(`http://<ip-do-host>:8080`) não usa TLS.

Cinco abas, com paridade funcional em relação à web
([ADR-022](../decisions/ADR-022-mobile-web-parity.md)):

- **Jogando**: jogo atual com cronômetro, iniciar e encerrar sessão;
- **Biblioteca**: busca, filtros (status, prioridade, plataforma, gênero, franquia,
  lista, ano de conclusão, arquivados) e ordenação, sobre `GET /games`; cadastro,
  edição e exclusão de jogos, com busca de metadata (IGDB) e tempos (HowLongToBeat)
  nas mesmas rotas da web. O detalhe do jogo é dividido em quatro abas
  ([ADR-037](../decisions/ADR-037-mobile-parity-phase-2.md)): **Resumo** (estimativas,
  total jogado, ficha e o bloco de plataformas e jornadas, com as datas de início e de
  zerado sugeridas pelas conquistas do Achievist), **Conquistas** (busca, filtro e
  secretas ocultas por padrão), **Sessões** (totais, horas retroativas em horas e
  minutos, diário e histórico, com registrar, editar e excluir) e **DLC & Franquia**.
  Quando aberto a partir da biblioteca ou de uma lista, o detalhe tem **Anterior/Próximo** na ordem e filtros da origem; o menu também tem **Mesclar duplicado** e, nas conquistas, uma aba por plataforma ([ADR-038](../decisions/ADR-038-multiplatform-achievements-merge-and-dlc-link.md)). Em **Agora jogando**, tocar no jogo abre o detalhe.
  Favorito e entrada/saída da fila ficam no menu. O ícone de relógio no card abre o **registro retroativo** — dia
  (Hoje, Ontem ou outra data) e duração em um toque, com a sessão terminando no
  horário atual;
- **Fila**: ordenável por arrastar (pela alça) e por ações de mover para cima/baixo;
  deslizar um item para a esquerda remove e o aviso oferece **Desfazer**, que devolve
  o jogo à posição original; inclui jogos da biblioteca e monta a fila a partir de
  uma lista;
- **Progresso**: painel com indicadores, período, sugestão do próximo jogo, missão
  principal (definir/editar objetivo e lista acompanhada), metas (criar, ajustar alvo,
  excluir) e meta semanal (minutos disponíveis por semana, usados na previsão do
  backlog);
- **Mais**: Listas (ver, criar, renomear, excluir e editar os jogos), **Plataformas**
  (cartões com logo e cor oficiais, números por plataforma, estado da sincronização e
  cadastro pelo catálogo ou personalizado), Estatísticas (destaques, seções, barras,
  prateleira de favoritos e filtro de ano), Atividade (feed paginado no estilo do
  Trophies Hunter, com as conquistas dentro das sessões e o gráfico acumulado), Metas
  e Configurações, que também abre a tela do **Achievist** (conexão, sincronização e
  vínculo dos jogos importados, com busca, filtros e ação em lote).

### Sem conexão no app Flutter

Mesma doutrina do ADR-015, implementada em sqflite:

- a última resposta de cada GET fica guardada; offline o app mostra esses dados e o
  banner avisa que podem estar defasados, em vez de falhar com "Tentar novamente";
- o cache só entra em erro de conexão — erro HTTP do servidor continua aparecendo;
- iniciar e encerrar sessão offline entram numa fila local e são enviados em ordem ao
  reconectar; 409 é tratado como "já registrada" e a operação sai da fila.
- as telas novas (plataformas, conquistas, jornadas, DLC, Achievist) leem pelo cache
  quando a API respondeu antes e exigem conexão para qualquer escrita.

Horas aparecem sempre como `42min`, `5h 17min` ou, a partir de 100 h, só as horas
(`1.569h`), no mesmo padrão da web. O deslocamento de fuso enviado à API segue o sinal
do `getTimezoneOffset()` do JavaScript (`apiTimezoneOffsetMinutes`).

O ícone do app (controle sobre uma prateleira, em roxo) tem versão legada, redonda,
adaptativa e monocromática (tema do Android 13) em `android/app/src/main/res/mipmap-*`.

Para compilar sem acesso ao CDN do Google, ver
`apps/mobile/android/download_flutter_artifacts.ps1`.

## Implementação inicial da PWA

A interface adapta biblioteca, fila, painel e formulários para telas estreitas. O botão de registro no jogo atual abre os detalhes com início e término pré-preenchidos; o usuário pode alterar horários e informar progresso e os quatro campos do diário da sessão antes de salvar.

## Metas, missões e integrações (ADR-040)

O app tem as metas flexíveis (jogos zerados, horas, zerar uma lista, horas seguidas e texto livre, com data limite livre), a lista de missões com uma principal e, em Configurações, a saúde do IGDB, da RAWG e do Achievist com teste sob demanda. A biblioteca mostra horas e conquistas nos cartões e ordena por horas jogadas (ADR-039).

## Ciclo do jogo, metadados e proteção de edição (Flutter)

- **Jornada ao iniciar sessão** e **Zerar em etapas** (nota em chips de 1 a 11, dificuldade,
  extras, resumo, alterar data e Desfazer): ver playthroughs.md e sessions.md (ADR-042).
  O botão "Zerar" fica no detalhe do jogo; o gatilho "Terminou o jogo?" vem do encerramento
  da sessão com 100%.
- **Metadados a revisar** (Mais): jogos que a API preencheu sozinha (Confirmar ou Desfazer),
  que têm candidatos (Usar este, Buscar outro, Ignorar) ou que não foram encontrados, com o
  botão "Buscar metadados pendentes". O selo com a contagem aparece em "Mais" (ADR-043).
- **Cadastro rápido**: o botão "Jogo" da biblioteca abre um sheet com título (com sugestões
  do nome oficial enquanto digita) e plataforma. "Mais detalhes" abre o editor completo.
- **Proteção contra perda de alterações**: sair do editor de jogo ou do sheet de sessão com
  alterações pergunta "Descartar alterações?"; salvar fecha direto.
- **Status em um toque** no detalhe: Pausar, Retomar, Marcar como jogando e Abandonar, com
  "Desfazer" no aviso. O app Flutter não tem a área de Relatórios.
