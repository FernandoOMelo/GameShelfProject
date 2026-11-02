# ADR-036: Atividade de conquistas na linha do tempo e nas estatísticas

## Status

Aceito. Estende o ADR-028 (conquistas externas) e respeita o ADR-024 (a
sincronização nunca cria sessão, jornada ou replay).

## Contexto

O Achievist informa quando cada conquista foi desbloqueada, e o GameShelf já guarda
essa data. Ela ajuda a preencher o que era lançado à mão (início e fim de um jogo,
dias em que se jogou), mas conquista não é tempo: dizer que houve atividade num dia
não diz por quanto tempo se jogou.

## Decisão

1. **Sessão é a fonte do tempo; a conquista só a enriquece.** Cada desbloqueio é
   ligado à sessão registrada à mão cuja janela o contém, com 30 minutos de folga
   (o horário da sessão é digitado). Se nenhuma janela casar, liga-se à única sessão
   do jogo naquele dia local; com duas ou mais, a conquista fica solta e a ligação não
   é adivinhada.
2. **Conquista sem sessão aparece sozinha**, agrupada por jogo e dia, só como
   informação ("Desbloqueou N conquistas em ..."). Nada vira sessão nem horas.
3. **Novas leituras**: `GET /stats/achievements` (conquistas por dia, para a curva
   acumulada, calculada no cliente), `achievementDays` em `/stats/activity` (dias do
   mapa de atividade, à parte dos minutos) e eventos `ACHIEVEMENTS_UNLOCKED` e
   conquistas dentro do evento `SESSION` em `/stats/timeline`.
4. **Datas sugeridas.** A primeira e a última conquista de um jogo são oferecidas como
   início e data de zerado, só quando o campo está vazio (o zerado, só se o jogo está
   como Zerado). São sugestões: nada é gravado sem o toque do usuário.
5. **Dia jogado.** Se houve conquista, o jogo foi jogado: o contador "Dias jogados" do
   mapa de atividade e do replay do ano conta a união dos dias com sessão e dos dias
   com conquista, cada dia uma vez só. Isso muda só o contador: horas, sessões e as
   sequências (atual e maior) continuam vindo apenas das sessões registradas.
6. **Fuso.** Todas as rotas usam o mesmo `timezoneOffsetMinutes` (UTC menos local, o
   sinal do `getTimezoneOffset()` do JavaScript).

## Consequências

- A curva só inclui os jogos vinculados à biblioteca.
- Se o Achievist devolver só nomes genéricos ("Trophy 8"), é isso que aparece: o
  GameShelf não adivinha nome ou ícone cruzando por posição com a RAWG.
