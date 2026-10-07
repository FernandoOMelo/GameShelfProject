# Blueprint de produto — GameShelf 1.0

## Para que serve este documento

Registrar o modelo aprovado para a versão 1.0 e orientar sua implementação.
As decisões do usuário abaixo foram confirmadas; requisitos em execução e
pendências restantes ficam descritos ao fim do documento.

## Visão de 1.0

O GameShelf será um catálogo pessoal de jogos com a sensação de uma videoteca
editorial: capas, páginas de detalhes, busca, filtros, coleção, avaliações e
histórico. A referência de experiência é um catálogo organizado como o Stash e
um banco de títulos como o IMDb, adaptados para acompanhar a relação pessoal do
usuário com cada jogo.

O sistema continua privado e self-hosted no homelab. “IMDb de jogos” descreve a
forma de consultar e organizar o catálogo; não significa publicação de perfis,
avaliações ou dados na internet.

### O produto deve responder

- O que tenho, quero jogar, estou jogando, pausei ou terminei?
- Em qual plataforma estou jogando este título?
- O que posso começar a seguir?
- Quanto tempo investi e quando terminei cada jogo?
- O que achei de cada jogo?
- Como está minha biblioteca ao longo do tempo?

## Decisões já confirmadas

- O jogo é a entidade principal e existe uma única ficha por título.
- Cada ficha pode apontar para uma plataforma principal selecionada pelo
  usuário.
- Posse, status, datas, avaliação e sessões descrevem a relação pessoal com o
  jogo, não a disponibilidade comercial do título.
- A avaliação pertence ao jogo: 1 a 10, com 11 reservado a “Jogo da Vida”.
- A nota só pode ser informada quando o status atual for Zerado ou Abandonado.
- Datas de início e conclusão podem ser retroativas.
- Relatórios contam o jogo uma vez por período.
- A fila ordenada e as listas nomeadas são ferramentas diferentes.
- A fila só aceita jogos marcados como possuídos.
- Arquivar oculta o jogo das visões padrão, preserva seu estado anterior e
  oferece a ação “Desarquivar”.
- A 1.0 não terá jornadas múltiplas/replays como entidade. Mantém uma data de
  conclusão no jogo e o histórico de sessões.
- IGDB permanece como fonte inicial de metadata; integração com HowLongToBeat
  fica para depois da 1.0.
- O Painel será a tela inicial, com ações rápidas para todos os jogos em
  andamento e estatísticas selecionáveis por período.
- Cards oferecem abrir detalhes, mudar status, adicionar/remover da fila e
  iniciar sessão quando aplicável.
- O critério de pronto é cadastrar, organizar, jogar, registrar sessões,
  concluir com nota e encontrar os jogos por filtros e relatórios sem fricção.
- O uso é pessoal, local e não será publicado na web.

## Modelo de organização

Os conceitos aparecem juntos na experiência, mas cada um tem uma função.

| Conceito | Responde a | Proposta |
| --- | --- | --- |
| Ciclo do jogo | Em que etapa estou com este título? | Um estado principal visível na ficha e nos cards |
| Posse | Tenho acesso/considero este jogo meu? | Informação pessoal independente do ciclo |
| Plataforma | Onde estou jogando ou tenho o jogo? | Uma plataforma selecionada na ficha |
| Fila | O que pretendo começar primeiro? | Lista única, ordenada, usada pelo planejamento e restrita a jogos possuídos |
| Listas | Como quero agrupar títulos? | Listas temáticas livres, sem afetar status ou previsões |
| Sessões | Quando joguei e por quanto tempo? | Histórico de atividades ligado ao jogo |
| Avaliação | O que achei do jogo? | Nota e, se aprovado, uma resenha pessoal opcional |

### Ciclo de vida aprovado

Estados da ficha:

1. **Desejado** — quero jogar ou acompanhar este título.
2. **Na biblioteca** — tenho acesso e ainda não iniciei; pode ser chamado
   “Backlog” na navegação. A posse continua sendo um campo explícito.
3. **Jogando** — experiência em andamento.
4. **Pausado** — comecei, mas não é o jogo ativo no momento.
5. **Zerado** — marquei a conclusão e registrei a data.
6. **Abandonado** — decidi não continuar.
7. **Arquivado** é uma ação de organização, não um estado substituto:
   desaparece das visões padrão e preserva o estado anterior.

Desarquivar restaura o jogo ao estado que tinha antes do arquivamento.

“Desejado” representa interesse em jogar, não necessariamente intenção de
comprar. Posse é independente: por exemplo, pode-se possuir um jogo ainda
marcado como Desejado.

### Transições

```text
Desejado ── adicionar à biblioteca ──> Na biblioteca ── começar ──> Jogando
                                                                  ↕      │
                                                               Pausado   ├── concluir ──> Zerado
                                                                         └── desistir ──> Abandonado

Arquivar/Desarquivar preserva e restaura qualquer estado.
```

Na 1.0, Zerado pode voltar para Jogando, mas não cria uma jornada separada:
existe uma única data de conclusão por ficha. Uma conclusão posterior atualiza
essa data. Sessões anteriores permanecem no histórico.

### Vocabulário na interface

Evitar mostrar termos técnicos do banco. Vocabulário candidato:

- “Desejados” como seção de descoberta pessoal;
- “Minha biblioteca” para jogos possuídos ou mantidos;
- “Jogando agora” para o jogo ativo;
- “Pausados”, “Zerados” e “Arquivados” como visões rápidas;
- “Fila” para a ordem de próximos jogos;
- “Listas” para agrupamentos criados pelo usuário.

“Backlog” significa jogos possuídos e ainda não zerados; Desejados é uma visão
separada. A fila é uma ordem dentro dos jogos possuídos e não muda o estado.

## Estrutura de navegação proposta

### Início / Painel — tela inicial

- seletor de período global, aplicável às métricas temporais;
- cartões de jogos em andamento com ações rápidas por título;
- métricas de horas jogadas, sessões, jogos jogados e jogos zerados no período;
- gráficos de atividade e conclusões;
- visão da composição atual da biblioteca por estado;
- sessões recentes e próximos itens da fila;
- cada cartão/métrica abre a lista de jogos ou sessões que a compõe.

### Biblioteca

- grade visual de capas como entrada principal;
- busca por título;
- filtros combináveis por ciclo, posse, plataforma, gênero, franquia e nota;
- ordenação por título, lançamento, data de conclusão, nota e atualização;
- troca opcional entre grade e lista compacta;
- ações rápidas no card para mudar status e abrir detalhes.

### Desejados

- títulos que o usuário quer jogar/adicionar à coleção;
- filtros por gênero, plataforma escolhida e estimativa;
- ação para mover para a biblioteca sem criar uma segunda ficha.

### Fila

- ordem manual dos próximos jogos;
- só permite adicionar jogos com posse marcada;
- não aceita Zerados, Abandonados ou Arquivados na 1.0, pois replay está fora
  do escopo decidido;
- entrada e remoção independentes do ciclo e das listas temáticas;
- estimativa de tempo restante e de semanas, quando os dados permitirem.

### Listas

- listas como “Jogos da vida”, “Coop”, “Curtos” ou qualquer nome criado pelo
  usuário;
- o mesmo jogo pode estar em várias listas;
- abrir a ficha do jogo sem sair do contexto da lista.

### Detalhes do jogo

Hierarquia:

1. capa/fundo, título, ano e metadados principais;
2. status atual, plataforma, posse e avaliação;
3. ações principais: editar, iniciar/continuar sessão, concluir, pausar,
   abandonar e arquivar;
4. descrição, gêneros, franquia e desenvolvedora;
5. progresso, tempo jogado e estimativas;
6. datas da jornada e avaliação/resenha;
7. histórico de sessões;
8. listas em que o jogo aparece.

## Fluxos que a 1.0 deve resolver bem

### Adicionar um jogo

1. Buscar metadata pelo nome.
2. Escolher um resultado, revisar os campos e importar apenas o que interessa.
3. Escolher plataforma, posse e estado inicial.
4. Salvar uma única ficha de jogo.

O cadastro manual deve continuar possível quando não houver resultado de
metadata.

### Começar a jogar

1. O jogo precisa estar marcado como possuído para entrar na fila.
2. Mover o jogo para “Jogando”.
3. Registrar a data de início, se conhecida.
4. Iniciar uma sessão em um toque.
5. Encerrar a sessão e informar onde parou, progresso e notas opcionais.

### Marcar como zerado

1. Ação disponível na ficha e em ações rápidas.
2. Informar ou confirmar a data de conclusão.
3. Habilitar avaliação de 1 a 10 ou “Jogo da Vida”.
4. Permitir concluir retroativamente sem criar sessões fictícias.
5. Mostrar confirmação com resumo do tempo total e da nota.

### Consultar e organizar

O usuário deve conseguir partir de qualquer estado para detalhes, editar
campos, mudar a plataforma, incluir/remover de listas e encontrar o jogo depois
pela busca ou filtros.

## Linguagem visual

Direção proposta: catálogo de entretenimento com foco na arte dos jogos, sem
replicar telas, ícones, textos ou identidade visual proprietária.

- capas em primeiro plano e fundos usados com moderação;
- cards com título, ano e estado legíveis;
- estados diferenciados por cor e rótulo, sem depender apenas da cor;
- páginas de detalhes com hierarquia editorial;
- navegação consistente entre biblioteca, listas, fila e detalhes;
- responsivo para computador e celular;
- ações de sessão fáceis de alcançar no celular;
- tema escuro atual pode permanecer como base, sujeito a avaliação de contraste.

## Dados, notas e relatórios

### Avaliação

Escala de 1 a 10; 11 significa “Jogo da Vida”. Só pode ser preenchida quando o
jogo estiver Zerado ou Abandonado. Notas operacionais permanecem privadas e
separadas da avaliação. A tela não deve exibir médias sociais ou rankings.

Se um jogo avaliado voltar para Jogando, a proposta é preservar a nota existente
como avaliação do título e só permitir alterá-la novamente quando ele voltar a
Zerado ou Abandonado.

### Conclusões e replays

Para a 1.0, o relatório anual/mensal conta jogos únicos cuja data de conclusão
fica no período. Como não há jornadas múltiplas, zerar novamente atualiza a
data da ficha; sessões antigas continuam registradas.

### Painel inicial e período

O Painel é a tela inicial. Cada jogo em andamento tem ações de abrir detalhes,
iniciar/continuar sessão, encerrar sessão e mudar para Pausado, Zerado ou
Abandonado quando aplicável.

Períodos propostos: últimos 7 dias, mês atual, ano atual, período personalizado
e todo o período. O valor inicial recomendado é mês atual; a escolha deve ser
lembrada no navegador.

Definições das métricas:

- **Horas jogadas:** soma das sessões que ocorreram no período; sessões ainda
  abertas aparecem no cartão do jogo e não entram no total fechado.
- **Sessões:** sessões iniciadas no período; duração parcial de uma sessão que
  cruza o limite do período deve ser calculada pelo tempo dentro do intervalo.
- **Jogos jogados:** títulos únicos com pelo menos uma sessão no período.
- **Jogos zerados:** títulos únicos cuja data de conclusão está no período.
- **Estados da biblioteca:** fotografia atual, não uma série histórica.

Contagens históricas de jogos abandonados ou mudanças de estado exigiriam
guardar eventos/transições de status. Não apresentar essas métricas como
históricas sem registrar essa informação.

## Escopo candidato da versão 1.0

### Essencial

- ciclo de vida definido e aplicado de forma consistente;
- biblioteca visual com busca, filtros e ordenação úteis;
- ficha de jogo organizada como página editorial;
- posse, uma plataforma e datas no nível do jogo;
- sessões com timer e histórico;
- Painel como tela inicial, com ações para todos os jogos em andamento e
  estatísticas por período;
- fila de planejamento apenas com jogos possuídos, separada das listas;
- listas nomeadas;
- avaliação pessoal apenas para jogos Zerados ou Abandonados e conclusão
  retroativa;
- estatísticas anuais/mensais com regra explícita para replays;
- cadastro manual e importação revisável de metadata;
- experiência responsiva no homelab.

### Depois da 1.0, salvo decisão contrária

- perfis públicos, compartilhamento social ou publicação de resenhas;
- achievements, integração de contas de plataforma ou sincronização automática;
- gerenciamento de múltiplas cópias do mesmo título por plataforma;
- múltiplos usuários;
- mecânicas sociais e rankings globais.

## Direção confirmada para o Painel

- mês atual é o período inicial e a escolha do usuário fica lembrada no navegador;
- não mostrar contagem histórica de abandonos sem persistir mudanças de status;
- notas existentes permanecem guardadas e bloqueadas quando o jogo volta a
  Jogando ou Pausado, podendo ser alteradas novamente ao Zerá-lo ou Abandoná-lo.

## Implementação

O ciclo, a posse exigida pela fila, o arquivamento reversível, as regras de nota
e o Painel inicial com períodos e ações rápidas fazem parte da implementação
aprovada. Gráficos e navegação detalhada por cada cartão de estatística podem
ser refinados após a validação prática desta primeira entrega.
