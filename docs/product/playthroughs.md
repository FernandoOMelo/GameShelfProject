# Plataformas e jornadas

Ver ADR-023.

## O que resolve

Um jogo tem um cadastro único. A partir dele o usuário registra:

- em quais plataformas e edições ele tem ou joga aquele jogo;
- quantas vezes jogou, com datas e estado de cada rodada;
- quanto tempo registrou aqui, separado do tempo que a plataforma informa.

## Grupos de plataforma

O catálogo tem dois níveis (ADR-025). Uma plataforma sem grupo é um grupo em si
(PC, PlayStation 5); dentro dela cabem lojas e variantes (Steam, GOG, Epic).
O jogo é associado à plataforma específica, e as estatísticas agregam pelo grupo
— as horas de Steam aparecem em PC. A lista de associações do jogo continua
mostrando cada plataforma separadamente.

Isso também resolve duplicatas antigas do catálogo: colocar "PC (Microsoft
Windows)" dentro de "PC" consolida os números sem renomear nem apagar nada. O
grupo é definido por você no painel "Grupos de plataforma"; a sincronização
nunca adivinha.

## Plataformas associadas

Cada associação liga o jogo a uma plataforma do catálogo e guarda, opcionalmente,
edição, formato (físico, digital, assinatura, nuvem), posse e observações.

- O mesmo jogo pode estar em quantas plataformas o usuário quiser.
- A mesma plataforma pode aparecer mais de uma vez com edições diferentes
  ("Complete Edition", "Game of the Year"); a mesma edição duas vezes é
  recusada.
- Uma associação pode ser marcada como principal. É só um resumo: ela aparece na
  ficha do jogo e no filtro, mas não restringe em que plataforma as sessões
  acontecem.
- Escolher a plataforma no formulário do jogo cria ou reaproveita a associação
  correspondente e a marca como principal.
- Desassociar uma plataforma não apaga sessões nem jornadas.

Quatro coisas diferentes, que o sistema não confunde: o jogo existe na
plataforma, o usuário possui o jogo na plataforma, o usuário jogou na plataforma
e o usuário zerou.

## Jornadas

Uma jornada é uma experiência contínua de jogo. Um jogo pode ter nenhuma, uma ou
várias.

Estados e o que cada um significa:

| Estado | Significado |
| --- | --- |
| Planejada | Vai acontecer, mas ainda não começou. Não conta como iniciada e não pode ter datas. |
| Em andamento | Começou e não terminou. |
| Pausada | Começou, está parada e pode ser retomada. |
| Concluída | Zerada. Sempre tem data de conclusão. |
| Abandonada | Começou e o usuário desistiu. Não conta como concluída. |

Transições permitidas:

- Planejada → Em andamento.
- Em andamento → Pausada, Concluída ou Abandonada.
- Pausada → Em andamento, Concluída ou Abandonada.
- Concluída → Em andamento (reabrir).
- Abandonada → Em andamento (retomar).

Retomar não cria outra jornada: continua na mesma. Reabrir uma jornada concluída
limpa a data de conclusão, então ela deixa de ser contada como zerada. Qualquer
outra transição é recusada.

Uma jornada pode ter uma plataforma principal, apenas como resumo. A plataforma
de verdade é registrada em cada sessão, então começar no PC e terminar no
PlayStation é uma jornada só.

## Sessões

Uma sessão pode ser ligada a uma jornada e a uma plataforma, e os dois campos são
opcionais:

- sessões antigas, e sessões em que o usuário não sabe dizer, continuam válidas
  sem vínculo;
- sessões da mesma jornada podem estar em plataformas diferentes;
- a jornada escolhida tem de ser do mesmo jogo;
- excluir a jornada solta as sessões dela, sem apagar nada.

## Fator replay

A quantidade de replays é calculada, não digitada:

- **jornadas iniciadas**: as que deixaram de ser planejadas;
- **jornadas concluídas**: as que estão em concluída;
- **replays iniciados**: jornadas iniciadas que não são a primeira do jogo, pela
  ordem em que foram criadas;
- **jogos com jornada zerada**: jogos distintos com ao menos uma jornada
  concluída.

Um jogo em três plataformas continua sendo um jogo nas estatísticas da
biblioteca. Estar disponível em três plataformas não significa ter sido jogado ou
zerado três vezes.

## Zerado na ficha do jogo e jornada concluída

São duas respostas para perguntas diferentes e as duas aparecem:

- o status do jogo (Zerado, com a data de conclusão) é a ficha pessoal do jogo e
  continua alimentando o Painel, as metas, o Replay anual e "jogos zerados" nas
  estatísticas;
- as jornadas contam quantas vezes aquele jogo foi jogado e como cada rodada
  terminou.

Concluir uma jornada não marca o jogo como zerado automaticamente, e marcar o
jogo como zerado não cria jornada. A tela mostra os dois lado a lado e a decisão
de alinhar é do usuário.

## Tempo local e tempo externo

As duas medidas aparecem separadas e nunca são somadas:

- **horas registradas aqui**: soma das sessões encerradas mais as horas
  retroativas lançadas no jogo;
- **horas informadas pela plataforma**: tempo acumulado que uma fonte externa
  reporta para aquela associação. Ausente significa "a fonte não informa", não
  zero.

A razão está no ADR-024: tempo acumulado não é uma lista de sessões, e somar as
duas medidas contaria a mesma atividade duas vezes.
