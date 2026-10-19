# ADR-028: conquistas da fonte externa

## Status

Aceita. Complementa o ADR-024.

## Contexto

O Achievist é, antes de tudo, um agregador de conquistas: é o dado que ele tem
de melhor qualidade. `GET /api/games/{platform_game_id}/achievements` devolve
nome, descrição, ícone, pontos, raridade global, se está desbloqueada e quando.

Para o GameShelf isso é informação de leitura: o usuário conquista troféus
jogando, não dentro desta aplicação.

## Decisão

As conquistas são **espelhadas** da fonte, por associação de plataforma, e
exibidas na tela de detalhes do jogo.

### Onde ficam

`external_achievements` referencia `game_platforms`, não `games`. Uma conquista
existe numa plataforma específica — os troféus de PlayStation de um jogo não são
as conquistas de Steam do mesmo jogo —, e desassociar a plataforma leva as
conquistas junto por cascata, sem deixar órfão.

### Busca sob demanda

A sincronização da biblioteca **não** busca conquistas. Com 70 ou 80
associações, seriam dezenas de requisições por rodada para dados que quase nunca
são olhados, e a rodada que hoje leva 5 segundos passaria a levar minutos.

Em vez disso, `GET /games/:gameId/platforms/:id/achievements` busca na hora em
que o usuário abre a seção, atualiza o espelho e devolve o resultado. Uma
requisição, no momento em que alguém está olhando.

### Substituir, não mesclar

A atualização apaga e regrava as conquistas daquela associação. A fonte é dona
desses dados: uma conquista que sumiu de lá não deve sobreviver aqui, e nada de
origem local vive nesta tabela, então não há o que preservar.

### Fonte indisponível

Se a busca falhar — Achievist fora do ar, sem credenciais, erro de rede —, a
resposta vem do espelho local com `refreshedAt` nulo, e a interface diz que está
mostrando o último dado guardado. Abrir conquistas nunca derruba a tela de
detalhes, pela mesma razão do ADR-024: indisponibilidade da fonte externa não
pode comprometer o uso da biblioteca.

### O que as conquistas não fazem

- Não viram sessões. `unlocked_at` é um evento datado de verdade, diferente do
  tempo acumulado, mas é um **instante**, não um intervalo: não diz por quanto
  tempo se jogou, e derivar sessão dele seria inventar duração.
- Não marcam jogo nem jornada como concluída. Ter 100% das conquistas é uma
  informação; dizer que o jogo foi zerado é uma decisão do usuário (ADR-023).
- Não entram em nenhuma métrica de tempo.

Levar os desbloqueios para a linha do tempo da Atividade é possível e legítimo,
já que são eventos datados — mas é outra decisão, não tomada aqui.

## Migração

`0022_external_achievements.sql` cria a tabela. Nada existente muda; o rollback
apaga o espelho, que volta na próxima consulta à fonte.

## Consequências

- `ExternalLibraryProvider` ganha `fetchAchievements`, mantendo o vocabulário do
  GameShelf na fronteira: nenhum endpoint ou formato da fonte vaza.
- A associação, na tela de detalhes, ganha a seção recolhível de conquistas, com
  quantas foram desbloqueadas, os pontos somados das desbloqueadas e a raridade
  de cada uma.
- Pontos contam só os desbloqueados: pontuação é o que se conquistou, não o que
  existe para conquistar.
