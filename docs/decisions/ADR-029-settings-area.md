# ADR-029: área de configurações e cadastro de plataformas

## Status

Aceita. Move a configuração do app para uma tela própria e completa o cadastro
de plataformas (renomear e excluir), que antes só permitia criar e agrupar.

## Contexto

O Painel acumulava quatro blocos de configuração no fim da tela — "Grupos de
plataforma", "Plataformas externas (Achievist)", "Backup dos dados" e "Meta
semanal" — misturados com a visão do dia a dia. O catálogo de plataformas
também não era um cadastro de verdade: dava para criar (de forma implícita, ao
montar um jogo) e mudar o grupo, mas não renomear nem excluir, então uma
duplicata como "PC" e "PC (Microsoft Windows)" (ver ADR-025) só podia ser
contida, nunca corrigida.

## Decisão

Nova view `settings` em `/configuracoes` (ADR-021), no grupo "Sistema" do
sidebar, com seções empilhadas:

1. **Plataformas** — o painel de grupos evolui para cadastro completo: criar,
   filtrar, renomear, agrupar e excluir (`platform-groups-panel.tsx` virou
   `platforms-panel.tsx`);
2. **Integrações** — o `AchievistSyncPanel` foi movido sem mudança de
   comportamento;
3. **Backup** — o `BackupCard` foi movido sem mudança de comportamento;
4. **Meta semanal** — o formulário que vivia no `DashboardView` virou
   `WeeklyGoalForm`, exportado por `settings-view.tsx`.

O Painel ficou só com leitura e análise; os indicadores que dependem da meta
semanal (previsão do backlog e "horas disponíveis por semana") continuam lá.

### Cadastro de plataformas

- `platformUpdateSchema` passa a aceitar `name` (além de `parentId`).
  Renomear preserva grupo e vínculos: nada é mesclado nem reapontado;
- nova rota `DELETE /platforms/:id`, com regra de domínio validada na
  fronteira e coberta por teste: recusa (409) quando a plataforma é grupo de
  outras (`checkRemovable`) ou quando tem jogos vinculados em
  `game_platforms` (`countGameLinks`). Nada fica órfão — a associação
  canônica é que impede a exclusão, e `sessions.platform_id` /
  `games.platform_id` são `set null` no banco desde o ADR-023;
- nome duplicado continua recusado (409, índice único de `platforms.name`);
- o backend continua sendo a única fronteira de regra: o painel apenas
  surfaca as recusas da API com a mensagem vinda do servidor.

## Consequências

- Configurações futuras têm uma tela de destino própria, sem poluir o
  Painel; a view entra como chunk próprio (lazy), como Estatísticas e
  Atividade.
- **Renomear afeta a sincronização por nome.** O importador casa a plataforma
  externa pelo nome (`resolvePlatform`, ADR-024): renomear "Steam" para
  "Steam (PC)" faz a próxima sincronização criar uma nova "Steam". Vínculos
  já confirmados não se perdem — eles apontam para o id —, mas entradas novas
  daquele nome passam a cair em outra linha. Para consolidar uma duplicata, a
  via correta continua sendo agrupar, não renomear; renomeie só o que a
  sincronização não usa.
- Quem alterava a meta semanal no Painel agora vai a Configurações; o
  formulário continua lendo e gravando em `PUT /planning/settings`.
- O app Flutter (`apps/mobile`) não foi alterado: as mudanças são aditivas e
  ele não usa `DELETE /platforms/:id` nem a nova rota.
