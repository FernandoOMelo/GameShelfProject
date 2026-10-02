# Regras Complementares para Agentes

## Antes de codificar

Responder internamente:

1. Qual requisito estou implementando?
2. Qual documentação descreve esse requisito?
3. Quais módulos serão afetados?
4. Existe regra semelhante já implementada?
5. Que testes demonstram o comportamento esperado?

## Durante a implementação

- reutilizar componentes existentes;
- respeitar convenções do projeto;
- evitar duplicação;
- manter funções pequenas;
- não misturar refatoração ampla com feature;
- não atualizar dependências sem necessidade.

## Depois da implementação

Executar, quando disponíveis:

- typecheck;
- lint;
- testes unitários;
- testes de integração;
- build;
- E2E para fluxos afetados.

## Mudança de arquitetura

Se a implementação exigir uma decisão que contradiga a documentação:

1. parar;
2. explicar a divergência;
3. propor alternativa;
4. registrar ADR após decisão.

## Dados

Nunca adicionar credenciais reais aos arquivos.

Nunca commitar:
- `.env` com segredos;
- tokens;
- chaves de API;
- dumps contendo dados pessoais.

## UI

Priorizar:
- desktop para gerenciamento;
- mobile para registro rápido;
- acessibilidade básica;
- feedback claro de carregamento, sucesso e erro.
