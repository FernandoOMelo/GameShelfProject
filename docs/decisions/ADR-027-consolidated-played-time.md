# ADR-027: total consolidado de tempo jogado

## Status

Aceita. Revisa a leitura mais rígida do ADR-024 sobre tempo externo nos totais.

## Contexto

O ADR-024 estabeleceu que tempo externo e tempo local nunca se somam. A regra
nasceu de um caso concreto e real: Gran Turismo 7 tem mais de 200 h de sessões
registradas; se a plataforma informar 180 h, somar daria quase 400 h, e as duas
medidas descrevem a mesma atividade com sobreposição desconhecida.

Mas o usuário apontou, com razão, que o número da plataforma é um tempo
consolidado de verdade — muitas vezes mais confiável que o registro manual, que
só existe para os jogos em que ele lembrou de cronometrar. Tratar "não somar
indiscriminadamente" como "nunca usar" joga fora a informação melhor.

## Decisão

O total consolidado existe, e o que o torna correto não é somar tudo: é
**escolher a fonte, por associação de plataforma**.

`game_platforms` ganha `counts_toward_total`. Quando ligado, o tempo informado
por aquela plataforma entra no total consolidado da biblioteca; quando
desligado, fica apenas como informação da associação, como antes.

```
consolidado = tempo local (sessões + horas retroativas)
            + Σ (tempo externo − tempo já lançado como retroativo)
              das associações marcadas
```

O desconto do que já foi lançado é o que faz esta decisão compor com o ADR-026:
tempo importado como hora retroativa já está no tempo local, e contá-lo de novo
dobraria. Com o desconto, lançar ou marcar produz o mesmo total — são dois
caminhos para o mesmo número, não duas somas.

### Por que por associação, e não global

Somar entre plataformas diferentes do mesmo jogo é legítimo: jogar no PC e no
PlayStation são atividades distintas. O que não pode é somar o tempo externo e
o tempo local **da mesma plataforma**, porque aí as duas medidas descrevem a
mesma coisa.

Como só o usuário sabe em quais jogos ele registrou sessões de verdade, a
escolha é dele, por associação. Nenhuma regra automática acerta isso: inferir
"conte o externo quando não houver sessões locais" erraria em todo jogo com
registro parcial, que é o caso comum.

### Desligado por padrão

Nenhum número existente muda com a migração. Ligar é uma decisão consciente,
uma plataforma por vez, e a tela mostra o efeito. O caminho oposto — ligar tudo
por padrão — inflaria silenciosamente o total de todo jogo que já tem sessões
registradas, que é exatamente o erro que o ADR-024 evita.

A consequência honesta é que marcar 72 associações uma a uma é trabalhoso. Não
há ação em massa, e isso é deliberado nesta decisão: uma ação em massa aplicaria
a escolha justamente onde ela é perigosa.

## Métricas publicadas

`stats.library` passa a expor, lado a lado:

- `localPlayedHours`: sessões mais horas retroativas;
- `externalPlaytimeHours`: tudo que as plataformas informam, marcado ou não;
- `externalCountedHours`: o que efetivamente entra no consolidado;
- `consolidatedPlayedHours`: a soma sem sobreposição.

As quatro continuam visíveis. O consolidado não substitui as outras: quem quiser
saber quanto registrou de fato continua tendo a resposta.

## Migração

`0021_counts_toward_total.sql` adiciona a coluna com padrão `false`. Aditiva.
O rollback remove a coluna e perde apenas quais plataformas foram marcadas; as
horas, locais e externas, continuam onde estavam.

## Consequências

- `gamePlatformSchema` ganha `countsTowardTotal` (padrão `false`, mantendo
  backups anteriores importáveis) e o campo é aceito em `PATCH`.
- A associação, na tela de detalhes, ganha o botão de marcar e desmarcar.
- As estatísticas ganham o cartão do total consolidado, com a explicação do que
  entrou e do que ficou de fora.
