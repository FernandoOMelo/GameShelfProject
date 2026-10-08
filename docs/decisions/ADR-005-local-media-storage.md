# ADR-005 — Armazenamento local de imagens importadas

## Status

Aceito

## Contexto

A importação opcional de metadata pode incluir capas e artworks. URLs remotas
deixam essas imagens dependentes da disponibilidade do IGDB e não atendem ao
princípio de manter dados importados localmente.

## Decisão

- O backend baixa imagens do host HTTPS `images.igdb.com` somente quando o jogo
  é salvo.
- Os arquivos ficam no filesystem local, em `MEDIA_STORAGE_PATH`, com nomes
  aleatórios e acesso por `/media/<arquivo>`.
- PostgreSQL armazena apenas a URL local da imagem.
- Docker Compose monta um volume persistente dedicado em `/app/storage`.
- Downloads aceitam apenas JPEG, PNG e WebP, limitados a 8 MiB, com timeout e
  sem seguir redirecionamentos.

## Consequências

Imagens continuam disponíveis sem IGDB e após reiniciar os containers. O volume
`gameshelf-media` deve ser mantido junto do volume PostgreSQL nos backups. A
integração não importa imagens hospedadas em outros domínios; URLs manuais
continuam sendo armazenadas como fornecidas.

## Atualização

O ADR-012 reutiliza este armazenamento para imagens enviadas pelo usuário
(screenshots de sessão), validadas pela assinatura do arquivo.
