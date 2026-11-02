# ADR-037: Paridade do app Flutter com a web, segunda leva

## Status

Aceito. Estende o ADR-022.

## Contexto

Depois do ADR-022 a web ganhou: detalhe do jogo em abas, plataformas associadas e
jornadas retroativas, conquistas, DLC e franquia, aba Plataformas com identidade
visual, feed de atividade com conquistas, estatísticas reorganizadas com filtro de ano
e a tela de vinculação do Achievist. O app Flutter ficou com a versão anterior.

## Decisão

1. **Paridade de rotas e telas, sem regra no cliente** (continua valendo o item 3 do
   ADR-022). O app não ganha nenhuma rota nova; usa as da web.
2. **Navegação.** Plataformas e Achievist entram dentro de "Mais" e de Configurações,
   sem uma sexta aba na barra inferior.
3. **Dependência nova: `flutter_svg`.** Renderiza os logos oficiais das plataformas a
   partir dos mesmos paths da web. Sem ela seria preciso redesenhar cada logo à mão em
   código, com risco de divergir do que a web mostra.
4. **Gráficos sem biblioteca.** A curva de conquistas é desenhada com `CustomPainter`
   (área, grade, rótulos e cursor ao toque ou arrasto), como a web faz em SVG. O mesmo
   vale para as colunas por ano de lançamento.
5. **Tooltip vira toque.** O que a web mostra ao passar o mouse (nome e descrição da
   conquista) abre numa folha ao tocar no ícone.
6. **Fuso corrigido.** O app enviava `timeZoneOffset` do Dart, de sinal oposto ao que a
   API espera, e os dias de sessão, replay e atividade ficavam deslocados em 6 horas no
   Brasil. Passa a usar `apiTimezoneOffsetMinutes()`, com o sinal do JavaScript.
7. **Offline não muda.** Iniciar e encerrar sessões continua funcionando sem rede
   (ADR-015, ADR-016 §7). As telas novas leem pelo cache da API quando houver e exigem
   conexão para qualquer escrita.

## Consequências

- Os modelos Dart continuam espelhados à mão a partir de `packages/contracts`.
- O ícone do app foi trocado do padrão do Flutter por um próprio (controle sobre uma
  prateleira), com ícone adaptativo e versão monocromática para o tema do Android 13.
