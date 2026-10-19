# ADR-026: lançar tempo externo como horas retroativas

## Status

Aceita. Complementa o ADR-024, que continua valendo integralmente.

## Contexto

A pergunta do usuário depois da primeira sincronização real foi direta: dá para
importar o tempo de jogo da integração e lançar sessões retroativas?

O levantamento do ADR-024 responde a segunda metade: **não**, e a limitação é da
fonte, não do nosso código. `user_games` guarda um único número acumulado
(`playtime_minutes`) e a última atividade. Não há horário de início, horário de
fim, quebra por dia nem histórico de eventos em tabela alguma do Achievist.
Transformar 242 minutos em sessões significaria inventar quantas foram, quando
e de que duração — e depois de criadas não se distingue mais o que foi
registrado do que foi deduzido.

Mas a primeira metade tem resposta boa. O GameShelf já tem um campo para
exatamente isto: `games.retroactive_played_hours`, que significa "joguei, mas
não registrei sessão". O número da plataforma cabe ali sem que nada seja
inventado.

## Decisão

O tempo informado pela plataforma pode ser lançado como horas retroativas do
jogo, por **ação explícita do usuário, por associação de plataforma**. A
sincronização nunca faz isso sozinha.

A diferença em relação a criar sessões é o que torna a ação legítima: as horas
retroativas não afirmam quando nem em quantas vezes se jogou. Elas dizem apenas
"este tanto de tempo existiu e não está nas minhas sessões", que é precisamente
o que a fonte sabe.

### Idempotência

`game_platforms` ganha `external_playtime_imported_minutes`, registrando quanto
do tempo externo já virou horas retroativas.

- Lançar soma apenas a parte ainda não lançada.
- Repetir a ação não faz nada e responde 409 com mensagem explícita.
- Quando a plataforma reporta mais tempo depois, lança-se só a diferença.
- Se o tempo informado encolher em relação ao já lançado, nada é feito: o
  GameShelf não retira horas que o usuário já tem.

Sem essa coluna, um segundo lançamento dobraria as horas do jogo — e horas
retroativas não têm como ser auditadas depois, porque são um total, não uma
lista.

### O que continua proibido

- Criar sessão a partir de tempo acumulado, em qualquer circunstância.
- A sincronização alterar `retroactive_played_hours` por conta própria.
- Somar automaticamente tempo externo e tempo local nas estatísticas: depois de
  lançado, o tempo passa a ser local e aparece como tal; o que fica na
  associação é o registro do que a fonte informou.

### Consequência sobre a dupla contagem

Depois de lançar, as horas aparecem em "tempo registrado localmente" e o tempo
informado pela plataforma continua visível na associação, agora marcado como já
lançado. As duas medidas continuam separadas nas estatísticas, como o ADR-024
exige — o lançamento move o número de uma para a outra, não o duplica.

Cabe ao usuário não lançar o tempo de um jogo cujas sessões ele já registrou:
nesse caso as duas medidas se sobrepõem, e o sistema não tem como saber em que
proporção. A interface só oferece o botão quando há tempo não lançado, e mostra
quanto já foi, para que a decisão seja informada.

## Migração

`0020_external_playtime_imported.sql` adiciona a coluna com padrão 0 e um
`CHECK` de não negatividade. Aditiva: nenhuma associação muda de comportamento e
todas começam com nada lançado, que é a verdade.

O rollback remove a coluna. As horas já lançadas permanecem no jogo, porque
vivem em `games.retroactive_played_hours`, que esta migração não toca; o que se
perde é a memória do que já foi lançado, e um novo lançamento voltaria a somar
tudo.

## Consequências

- `gamePlatformSchema` ganha `externalPlaytimeImportedMinutes`, com padrão 0
  para manter backups anteriores importáveis.
- Nova rota `POST /games/:gameId/platforms/:id/import-playtime`.
- A tela de detalhes ganha a ação por associação e passa a mostrar as horas
  retroativas dentro do tempo registrado localmente.
- A regra de qual medida vale no total consolidado da biblioteca é outra
  decisão, ainda em aberto.
