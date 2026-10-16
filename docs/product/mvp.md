# MVP

## Objetivo

Entregar uma aplicação funcional para gerenciamento pessoal de backlog e sessões.

## Funcionalidades

### Biblioteca

- listar jogos;
- pesquisar;
- filtrar;
- visualizar em grade;
- visualizar detalhes;
- cadastrar;
- editar;
- remover.

### Metadados

Um jogo pode possuir:

- título;
- descrição;
- capa;
- background;
- ano;
- desenvolvedora;
- publisher;
- franquia;
- gêneros;
- plataformas.

### Planejamento

Cada jogo pode possuir:

- estimativa principal;
- estimativa de conclusão;
- estimativa pessoal;
- prioridade;
- status.

### Sessões

Uma sessão possui:

- jogo;
- início;
- fim;
- duração calculada;
- progresso;
- onde parei;
- observação.

### Fila

O usuário pode:

- adicionar jogo;
- remover jogo;
- reordenar;
- visualizar posição.

### Dashboard

O dashboard deve apresentar:

- jogo atual;
- tempo jogado;
- progresso;
- última sessão;
- backlog;
- horas estimadas;
- tempo disponível semanal;
- previsão aproximada.

## Critérios de aceite do MVP

- É possível cadastrar pelo menos um jogo.
- É possível colocá-lo na fila.
- É possível iniciar e registrar sessões.
- A duração da sessão é calculada pelo backend.
- O total jogado é calculado a partir das sessões.
- O progresso é exibido.
- O dashboard apresenta os principais indicadores.
- A interface funciona em desktop e celular.
- O projeto executa localmente via Docker Compose.
