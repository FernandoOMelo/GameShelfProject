# Estatísticas

## Objetivo

Mostrar a jornada de jogos zerados: quantos, quanto tempo, quais notas, quais
gêneros e plataformas e quais foram os melhores jogos de cada ano.

## Campos de classificação do jogo

- **Dificuldade**: C (fácil), B (médio), A (complicado), AA (difícil), AAA
  (imperdoável). Opcional.
- **Tipo**: texto livre, por exemplo "Action RPG" ou "Metroidvania".
- **Condição de zeramento**: texto livre, por exemplo "Veja os créditos".
- **Favorito**: marca o jogo para o ranking de favoritos.
- **Jogo do ano**: exige a data de conclusão; só um jogo por ano.

## Indicadores (`GET /stats`)

- totais: jogos zerados, horas, média por jogo, mais longo, mais curto e tempo
  desde o primeiro registro (data de início, conclusão ou sessão mais antiga);
- linha do tempo anual: zerados, horas e jogo do ano de cada ano;
- distribuição de notas (11 a 1) e de dificuldade (AAA a C);
- quadros por gênero, tipo e plataforma: zerados, tempo e nota média;
- Top 10 favoritos (por nota), Top 5 gêneros e Top 10 tipos (por nota média).

Considera jogos com status Zerado, inclusive arquivados. As horas de um jogo
contam no ano em que ele foi zerado. Um jogo com vários gêneros entra em cada um.

## Atividade (`GET /stats/activity?year=&timezoneOffsetMinutes=`)

Heatmap anual e sequências de dias jogados, exibidos na tela de Estatísticas.

- minutos por dia = soma das sessões encerradas, atribuídas ao dia local de início
  (`timezoneOffsetMinutes` segue a convenção de `Date.getTimezoneOffset`);
- `days` traz só os dias com sessões do ano pedido (padrão: ano atual);
- **maior sequência** considera todo o histórico; **sequência atual** continua
  válida se o último dia jogado foi hoje ou ontem;
- horas retroativas não têm data de sessão e não entram.

## Replay do ano (`GET /stats/replay?year=&timezoneOffsetMinutes=`)

Painel na tela de Estatísticas com seletor de ano. Resume o ano escolhido:

- horas, sessões e dias jogados: sessões encerradas cujo dia local de início cai no ano;
- jogo mais jogado, gênero mais jogado (um jogo soma em cada um dos seus gêneros),
  mês mais ativo e maior sessão, todos por minutos de sessão; empates ficam com o
  menor nome (ou mês), para o resultado ser estável;
- jogos zerados e jogo do ano: pela data de conclusão do jogo, não por sessões;
- horas retroativas não entram, pois não têm data de sessão.

Reutiliza os mesmos parâmetros e a mesma regra de dia local da atividade.

## Missão principal

Objetivo de longo prazo acompanhando uma lista pessoal: progresso = jogos zerados
da lista / jogos da lista. Configurada no Painel (`GET/PUT/DELETE /challenge`).
