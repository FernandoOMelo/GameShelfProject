# ADR-015: PWA e uso offline

## Status

Aceito.

## Contexto

O celular serve para registrar sessões (docs/product/mobile.md), e a conexão com o
servidor doméstico pode cair. Os dados são de uma pessoa só e há um único aparelho
escrevendo por vez na prática, o que permite uma solução simples. Não havia
manifest, service worker nem tratamento de falha de rede.

## Decisão

**1. Instalável.** `manifest.webmanifest` e ícones PNG (192 e 512, com versão
maskable) gerados por script, sem dependência. O `index.html` aponta para eles.

**2. Service worker escrito à mão** (`apps/web/public/sw.js`), sem
`vite-plugin-pwa`/Workbox (princípio 12 do AGENTS.md: sem dependência para tarefa
pequena). Estratégias:

- navegação: rede primeiro; se falhar, o `index.html` guardado (SPA);
- `GET /api/*`: rede primeiro; se falhar, a última resposta guardada, ou 503 JSON
  quando nunca foi consultada. `/api/backup` nunca é guardado;
- `/assets/*` (nome com hash), `/media/*` e o shell: cache primeiro;
- qualquer método diferente de GET, outras origens e o próprio `sw.js` passam direto.

Só é registrado em produção. O nginx serve `sw.js` e o manifest com `no-cache`.
Para limpar caches antigos basta mudar `VERSION` no arquivo.

**3. Fila local de operações de sessão** (`offline-sessions.ts`), em `localStorage`,
independente do service worker. São as duas operações que a interface faz online:

- `create`: iniciar uma sessão (POST). Pode ficar em aberto offline e ser
  encerrada offline pelo aviso, virando uma sessão completa;
- `finish`: encerrar uma sessão que já existe no servidor (PATCH com `endedAt`).

Enviadas em ordem ao voltar a conexão (evento `online`), ao abrir o app ou por
"Enviar agora". Falha de rede interrompe e mantém o resto; o servidor recusar
(404, 400) marca o item com o motivo e o deixa para o usuário descartar, sem perder
o registro em silêncio. Limite de 50 operações. Só falhas de rede (`TypeError` do
`fetch`) entram na fila; respostas de erro HTTP continuam aparecendo ao usuário.

**4. Idempotência.** O reenvio pode acontecer depois de o servidor já ter gravado e
a resposta ter se perdido. Por isso `POST /games/:id/sessions` agora responde **409**
para o mesmo jogo e horário de início, e a fila trata esse 409 como "já registrada".
O `finish` é naturalmente idempotente (mesmo `endedAt`).

## Limitações assumidas

- **Service worker exige contexto seguro (HTTPS ou `localhost`).** Em
  `http://192.168.x.x:8080`, o caso típico do celular na rede doméstica, o navegador
  não o registra: não há instalação nem cache offline do shell. A fila de sessões
  funciona mesmo assim, mas só enquanto a página já estiver aberta. Para o PWA
  completo no celular é preciso um reverse proxy com HTTPS (previsto em
  architecture.md, fora deste escopo).
- Offline não edita jogos, listas, metas nem exclui sessões; mostra o último dado
  guardado (pode estar defasado).
- Sem resolução de conflitos além do 409: com um aparelho por vez, não se justifica.
- Os dados guardados no navegador ficam legíveis a quem usar o aparelho.

## Consequências

- Mudança na API pública: `POST /games/:gameId/sessions` passa a poder responder 409.
  Único consumidor é o frontend, que já trata erros de resposta; atualizado junto.
- Atualizar o service worker exige novo build da imagem web.
