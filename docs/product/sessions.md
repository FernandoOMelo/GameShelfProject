# Sessões

Uma sessão pode ser ligada a uma jornada e a uma plataforma, ambos opcionais
(ADR-023). Sessões sem vínculo continuam válidas, e sessões da mesma jornada
podem estar em plataformas diferentes. Ver `playthroughs.md`.

## Objetivo

Registrar cada período em que o usuário jogou.

## Campos

- `id`
- `gameId`
- `startedAt`
- `endedAt`
- `progress`
- `location` — exibido como **Onde parei**
- `notes` — exibido como **Resumo da história**
- `keyDecisions` — exibido como **Decisões importantes**
- `tips` — exibido como **Dicas e lembretes**
- `createdAt`
- `updatedAt`

## Diário da sessão

Os quatro campos de texto formam o diário: onde o usuário parou, o que aconteceu na história,
que escolhas ele fez e o que precisa lembrar na próxima vez. Todos são opcionais.

`location` guarda o ponto de retomada (capítulo, missão) e aceita até 200 caracteres; os outros
três são texto longo. Os nomes `location` e `notes` são herdados do MVP, quando significavam
"localização" e "notas"; os dados sempre foram usados no sentido atual. Ver ADR-018.

O detalhe do jogo abre com a seção **Onde parei**, que mostra o valor mais recente não vazio de
cada um dos quatro campos, com a data da sessão que o registrou. Cada campo é resolvido
separadamente: uma sessão que só anotou onde parou não apaga as decisões registradas antes.

## Onde aparecem

No detalhe do jogo, onde podem ser criadas, editadas e excluídas, e na linha do tempo
(aba "Atividade"), que reúne as sessões de todos os jogos junto aos demais eventos da
biblioteca. Na linha do tempo são somente leitura: o título do jogo leva ao detalhe,
onde a edição acontece. Ver ADR-016.

## Regras

1. Uma sessão pertence a exatamente um jogo.
2. `startedAt` é obrigatório.
3. `endedAt` é obrigatório para uma sessão finalizada.
4. `endedAt` não pode ser anterior a `startedAt`.
5. A duração é calculada pelo backend.
6. O cliente não deve ser a fonte de verdade da duração.
7. `progress` deve estar entre 0 e 100 quando informado.
8. `location` pode ser vazia.
9. `notes`, `keyDecisions` e `tips` podem ser vazias.
10. Uma sessão não deve ter duração negativa.
11. O usuário pode excluir uma sessão; uma sessão inexistente ou pertencente a outro jogo retorna não encontrado.

## Registro rápido

No celular, o fluxo prioritário é:

1. selecionar jogo;
2. informar duração ou início/fim;
3. informar onde parei;
4. opcionalmente informar progresso e o resto do diário;
5. salvar.

## Cálculos

### Tempo jogado

Soma das durações das sessões válidas do jogo.

O detalhe do jogo também exibe horas retroativas acumuladas sem data junto ao
tempo das sessões. Esse lançamento não cria sessão e não participa das
estatísticas, relatórios ou previsões do painel.

No cadastro inicial, a duração de uma sessão finalizada é calculada pela API em minutos completos a partir de `startedAt` e `endedAt`. Uma sessão sem `endedAt` permanece em andamento e ainda não contribui para a duração.

### Tempo total da biblioteca

Soma das sessões de todos os jogos.

### Progresso

No MVP, o progresso atual pode ser associado à sessão mais recente que possuir progresso informado.

Uma implementação futura poderá tratar progresso por capítulos, objetivos ou eventos.

## Implementação inicial

A página de detalhes do jogo permite registrar, editar e excluir sessões, encerrar sessões em andamento e consultar o histórico. A API calcula a duração e limita cada operação ao jogo da rota.

Na página de detalhes, a ação **Continuar jogando** cria imediatamente uma sessão
em andamento e exibe o tempo decorrido. O timer é retomado a partir do horário
persistido ao reabrir o jogo. **Encerrar sessão** grava o término pela API e abre
o formulário para registrar progresso e o diário da sessão. A sessão continua editável
no histórico.

## Screenshots

Cada sessão aceita até 10 imagens (JPEG, PNG ou WebP, até 8 MB). Na página do jogo,
o botão "Imagens" de cada sessão abre a galeria, com envio e exclusão. Detalhes e
motivos em ADR-012.

- `GET /games/:gameId/sessions/:sessionId/screenshots` lista;
- `POST` no mesmo caminho envia o arquivo como corpo binário com o `Content-Type` da
  imagem (415 se não for uma imagem válida, 409 acima do limite);
- `DELETE .../screenshots/:screenshotId` exclui a linha e o arquivo;
- excluir a sessão ou o jogo também apaga os arquivos.

## Duplicidade

Um jogo não pode ter duas sessões com o mesmo início: `POST /games/:gameId/sessions`
responde 409. Isso torna seguro reenviar sessões guardadas offline (ADR-015).
