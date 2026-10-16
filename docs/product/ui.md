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

Caminhos: `/painel`, `/biblioteca`, `/fila`, `/listas`, `/estatisticas`,
`/atividade` e `/jogos/:id`. Caminhos desconhecidos caem no painel.

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
