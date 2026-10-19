# Estatísticas

Além dos números dos jogos zerados, as estatísticas publicam um bloco de
biblioteca com jogos cadastrados, associações de plataforma, jornadas iniciadas
e concluídas, replays iniciados, horas registradas aqui e horas informadas pelas
plataformas (ADR-023). Um jogo em três plataformas é contado uma única vez, e as
duas medidas de tempo nunca são somadas.

O total consolidado (ADR-027) soma o tempo registrado aqui com o tempo das
plataformas que você marcou como fonte do total, descontando o que já virou
hora retroativa. Marcar é por associação, porque só você sabe em quais jogos
registrou sessões de verdade; nenhuma regra automática acerta isso. As quatro
medidas — local, informado, contado e consolidado — ficam visíveis lado a lado.

As quebras por plataforma agregam pelo grupo (ADR-025): jogos e horas de Steam
e GOG aparecem em PC. Somar entre lojas do mesmo aparelho é legítimo; somar
tempo externo com tempo local continua não sendo.

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
- Top 10 favoritos (por nota), Top 5 gêneros e Top 10 tipos (por nota média);
- Top 10 desenvolvedoras: zerados, tempo e nota média;
- taxa de conclusão: zerados sobre os jogos da biblioteca, **ignorando Desejados** —
  querer um jogo não é progresso nem regressão;
- média de horas por jogo jogado: considera todo jogo com horas registradas, zerado ou
  não (diferente da média por jogo zerado, que é só dos zerados);
- distribuição por ano de lançamento: conta a biblioteca inteira, não só os zerados,
  porque a pergunta é sobre a composição do acervo.

Considera jogos com status Zerado, inclusive arquivados — exceto a taxa de conclusão e a
distribuição por ano de lançamento, cujos recortes estão descritos acima. As horas de um
jogo contam no ano em que ele foi zerado. Um jogo com vários gêneros entra em cada um.
Ver ADR-017.

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
