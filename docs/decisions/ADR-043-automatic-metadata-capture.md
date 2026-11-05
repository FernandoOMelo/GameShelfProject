# ADR-043: captura automática de metadados

## Status

Aceito.

## Contexto

Buscar metadados (IGDB) e tempos (HowLongToBeat) dependia de o usuário digitar o título
no editor e escolher um resultado. A regra de "o que preencher" vivia no cliente (o
Flutter, por exemplo, não aplicava gêneros) e jogos importados do Achievist nasciam
quase vazios.

## Decisão

Um serviço no servidor (`modules/metadata-sync`) busca e preenche sozinho:

- **Correspondência**: só aplica com **um** candidato de título igual (ignorando caixa,
  acentos, ™®© e pontuação) e, se o jogo tem ano de lançamento, com o mesmo ano. Vários
  iguais (remakes) ou só parecidos vão para revisão; nenhum candidato é "não encontrado".
- **Preenchimento**: só campos vazios; nunca sobrescreve. Capa e fundo são baixados para
  o armazenamento local, gêneros são mapeados por nome (os que faltam são criados, pois a
  lista do IGDB é curta e padronizada) e a franquia é reaproveitada ou criada.
- **Tempos**: melhor esforço (ADR-019), com título exato e único, só em tempo principal e
  completista vazios. A estimativa pessoal continua do usuário (ADR-003).
- **Quando roda**: ao cadastrar um jogo, ao criar um jogo pela fila de importação do
  Achievist, em varredura (30 s depois de subir e de hora em hora, 25 jogos por rodada com
  pausa entre consultas) e sob demanda (`POST /metadata-sync/run`, `/:gameId/sync`).
- **Falhas**: se o provedor falhar, nada é gravado e a varredura para; o jogo é tentado de
  novo depois e a falha já aparece na saúde das integrações (ADR-040). "Não encontrado"
  só é refeito após 30 dias ou se o título mudar.
- **Estado**: tabela `game_metadata_sync` (migration 0031), uma linha por jogo consultado:
  status `APPLIED_AUTO`, `NEEDS_REVIEW`, `NOT_FOUND`, `CONFIRMED` ou `IGNORED`, título
  consultado, campos preenchidos e candidatos.
- **Aviso**: sem push. `GET /metadata-sync/review` devolve os jogos que pedem atenção
  (aplicados sozinhos, a revisar e não encontrados) e a contagem para o selo da navegação.
  Ações: usar candidato, buscar outro título, ignorar, confirmar e desfazer (zera só o que
  a captura preencheu).

## Consequências

- Web e Flutter ficam iguais, porque a regra é uma só. A captura funciona com o celular offline.
- Sem as credenciais do IGDB o serviço não existe e as rotas não são registradas.
- Uma correspondência exata errada é possível (dois jogos com o mesmo nome e ano); por isso
  tudo que é aplicado sozinho fica visível para confirmar ou desfazer.
