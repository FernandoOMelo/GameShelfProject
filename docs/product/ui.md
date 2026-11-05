# Diretrizes de UI

## Conceito

Biblioteca visual inspirada em plataformas de mídia, sem copiar interfaces proprietárias.

## Desktop

Priorizar:

- capas grandes;
- banners;
- carrosséis ou grades;
- filtros;
- dashboard;
- tabelas detalhadas quando úteis.

## Mobile

Priorizar:

- ações rápidas;
- cards compactos;
- formulário de sessão;
- leitura rápida.

## Estados obrigatórios

Toda tela que carrega dados deve possuir estados para:

- carregando;
- vazio;
- erro;
- sucesso.

## Navegação

Cada tela de topo e o detalhe de um jogo têm URL própria (ADR-021). Isso permite
compartilhar o link, recarregar a página na mesma tela e usar o botão voltar do
navegador — no PWA instalado, ele fecha o detalhe em vez de sair do app.

Caminhos: `/painel`, `/biblioteca`, `/fila`, `/listas`, `/plataformas`,
`/estatisticas`, `/atividade`, `/configuracoes` e `/jogos/:id`. Caminhos
desconhecidos caem no painel.

A casca (ADR-032) é uma topnav fixa (marca, busca, `Painel`, `Configurações`,
selo `LOCAL`) mais a barra de abas do perfil — `Jogos`, `Fila`, `Coleções`,
`Sessões de jogo`, `Plataformas`, `Estatísticas` —, que fica visível em todas
as telas, inclusive no painel e nas configurações.

## Configurações

A tela `/configuracoes` (ADR-029) reúne o que configura o app, e não é visão do
dia a dia: cadastro de plataformas (criar, renomear, agrupar, excluir),
integração com o Achievist, backup dos dados e meta semanal. Seções
empilhadas em uma única página, sem sub-abas.

## Acessibilidade

No mínimo:

- navegação por teclado em componentes relevantes;
- labels em inputs;
- contraste adequado;
- foco visível;
- mensagens de erro compreensíveis.

## Cores

Não definir identidade visual definitiva nesta fase. O design system deve permitir evolução posterior.

## Referências

Padrões de layout de sistemas parecidos (bibliotecas de jogos, trackers de mídia
e launchers) e recomendações de modernização estão em
[Pesquisa de layouts — referências para modernizar a UI](ui-references.md).

## Padrões de fluxo (ADR-042 e ADR-043)

- **Capturar primeiro, perguntar depois**: a ação principal (iniciar sessão, zerar) é gravada
  no toque; os detalhes (jornada, nota, dificuldade) vêm em seguida, todos puláveis.
- **Nunca bloquear o cronômetro**: perguntas sobre a jornada aparecem depois que a sessão
  já começou, em sheet ou aviso que não impede o uso do app.
- **Desfazer em vez de confirmar** para ações reversíveis (zerar, pausar, abandonar,
  confirmar metadados); diálogo de confirmação só para o que não volta (excluir).
- **Proteção contra perda de alterações**: editores com alterações pedem confirmação ao
  fechar (Cancelar, Esc, clique no fundo, voltar); a web também avisa antes de recarregar.
- **Padrões inteligentes**: plataforma da última sessão, data de hoje e jornada seguinte
  vêm preenchidas; o usuário só corrige o que estiver errado.
