# ADR-035: Identidade visual das plataformas e cadastro na aba Plataformas

## Status

Aceito. Complementa o ADR-031 (catálogo e resumos) e substitui, no que toca ao
cadastro, o ADR-029 (que o colocava em Configurações).

## Contexto

Ícones e cores das plataformas apareciam em vários lugares (cartões, selos, listas),
mas eram abstratos, fixos no código web e sem cor oficial. Cadastrar uma plataforma
nova não trazia nenhuma identidade. O cadastro morava em Configurações, longe da
visão por plataforma.

## Decisão

1. **O catálogo padrão vive no backend** (`apps/api/src/modules/platforms/catalog.ts`):
   nome, `catalogKey`, `iconKey` e cor da marca, com apelidos que as fontes externas
   usam ("PS5", "Rockstar Games"). Ao criar uma plataforma pelo nome, a API reconhece a
   entrada e grava ícone e cor. `GET /platforms/catalog` expõe a lista para o cadastro.
2. **Coluna `platforms.color`** (`#RRGGBB`, com `CHECK`), preenchida pela migração
   `0028` para o que já existia. `POST` e `PATCH /platforms` aceitam `iconKey` e `color`
   para plataformas personalizadas; o que o usuário escolhe vence o catálogo.
3. **Logos oficiais** (simple-icons, CC0) ficam copiados no repositório, um path por
   marca, indexados pelo `iconKey`: `platform-brand-paths.ts` na web e
   `platform_brand_paths.dart` no app. A chave é o que a API grava.
4. **O cadastro mudou para a aba Plataformas** (escolher do catálogo ou criar
   personalizada, editar, excluir), com o estado da sincronização do Achievist no
   cartão. A tela de Configurações ficou só com integração, backup e meta semanal.

## Consequências

- Identidade visual é só apresentação: não participa de nenhuma regra de associação,
  agregação ou estatística.
- Um logo novo exige copiar o path para os dois clientes; sem ele, o ícone genérico
  assume, na cor da marca.
