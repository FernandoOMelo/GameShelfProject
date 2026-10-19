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
            + Σ max(0, tempo externo
                     − tempo já lançado como retroativo
                     − minutos de sessão naquela plataforma)
              das associações marcadas
```

O número da fonte é o **total daquela plataforma**, não um acréscimo. Por isso
dele saem as duas coisas que já estão contadas no tempo local: o que virou hora
retroativa e as sessões registradas naquela plataforma.

Sem o segundo desconto, o caso mais comum quebrava: importar Portal com 10 h da
Steam, jogar 1 h aqui e sincronizar faz a Steam reportar 11 h, e o total daria
12 h — a hora jogada contada duas vezes, uma na sessão e outra dentro do total
atualizado da fonte.

O desconto do que já foi lançado é o que faz esta decisão compor com o ADR-026:
tempo importado como hora retroativa já está no tempo local, e contá-lo de novo
dobraria. Com o desconto, lançar ou marcar produz o mesmo total — são dois
caminhos para o mesmo número, não duas somas.

### Por que por associação, e não global

Somar entre plataformas diferentes do mesmo jogo é legítimo: jogar no PC e no
PlayStation são atividades distintas. O que não pode é somar o tempo externo e
o tempo local **da mesma plataforma**, porque aí as duas medidas descrevem a
mesma coisa.

A escolha de *usar* a fonte continua sendo do usuário, por associação. O que
não depende dele é a aritmética: uma vez marcada, a sobreposição com as sessões
daquela plataforma é descontada automaticamente, e o registro parcial — o caso
comum — passa a dar o número certo em vez de inflado.

### Desligado por padrão

Nenhum número existente muda com a migração. Ligar é uma decisão consciente,
uma plataforma por vez, e a tela mostra o efeito. O caminho oposto — ligar tudo
por padrão — inflaria silenciosamente o total de todo jogo que já tem sessões
registradas, que é exatamente o erro que o ADR-024 evita.

A consequência honesta é que marcar 72 associações uma a uma é trabalhoso. Não
há ação em massa, e isso é deliberado nesta decisão: uma ação em massa aplicaria
a escolha justamente onde ela é perigosa.

### Limite conhecido

Sessões **sem plataforma informada** não entram no desconto: não há como saber a
qual plataforma pertencem. Num jogo com sessões assim e a associação marcada, o
total fica inflado pela parte não descontável. A tela de detalhes avisa quando o
jogo tem sessões nessa situação e pede que a plataforma seja informada; o
sistema não adivinha.

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
