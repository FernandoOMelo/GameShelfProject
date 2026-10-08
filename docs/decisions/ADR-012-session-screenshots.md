# ADR-012: screenshots de sessão

## Status

Aceito.

## Contexto

O diário de sessão já tem notas, localização e progresso (`sessions.notes`). Para
responder "onde parei?" falta anexar imagens à sessão. O armazenamento local de
mídia (ADR-005) só baixava imagens do IGDB; aqui o usuário envia arquivos.

## Decisão

- Tabela `session_screenshots` (`id`, `session_id`, `url`, `created_at`), com
  chave estrangeira em cascata para `sessions`. O banco guarda só a URL local.
- Upload por **corpo binário** (`Content-Type: image/jpeg|png|webp`) em
  `POST /games/:gameId/sessions/:sessionId/screenshots`, sem multipart: um único
  arquivo por requisição dispensa uma dependência nova (AGENTS.md, princípio 12).
- `GameImageStorage` ganha `saveImage(bytes)`, usada também pela importação do
  IGDB. O tipo é decidido pela **assinatura do arquivo**, não pelo cabeçalho
  enviado; tamanho máximo de 8 MiB (mesmo limite da importação); arquivos são
  gravados com nome aleatório.
- No máximo 10 imagens por sessão (409 acima disso).
- Excluir a imagem, a sessão ou o jogo apaga também os arquivos: o cascata do
  banco remove as linhas, então as rotas de sessão e de jogo listam as URLs antes
  e apagam os arquivos depois da exclusão.
- `GET .../screenshots` lista por sessão; a interface só consulta quando o usuário
  abre a seção "Imagens" da sessão.

## Consequências

- Os arquivos entram no volume `gameshelf-media`, que deve fazer parte do backup
  (ver exportação e backup na Fase 8).
- Se a exclusão do arquivo falhar depois da exclusão no banco, o arquivo fica
  órfão; é um custo aceito para evitar linhas apontando para arquivos inexistentes.
