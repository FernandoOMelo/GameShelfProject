import type { FastifyInstance } from 'fastify';
import {
  externalIntegrationStatusSchema, externalMatchConfirmSchema, externalMatchCreatedSchema, externalMatchCreateGameSchema,
  externalPendingMatchSchema, externalSyncStateSchema,
} from '@gameshelf/contracts';
import { parseId } from '../shared/parse-id.js';
import { toGame, toGamePlatform } from '../shared/serialize.js';
import { confirmExternalMatch, createGameFromMatch, toPendingMatch, type ImportDependencies } from './import-service.js';
import type { ExternalSyncRunner } from './sync-runner.js';

export type IntegrationContext = {
  runner: ExternalSyncRunner;
  deps: ImportDependencies;
  /** Testa credenciais e alcance da fonte, quando o provedor sabe fazer. */
  checkConnection?: () => Promise<{ accounts: number }>;
};

/**
 * Sincronização manual da fonte externa (ADR-024). Sem credenciais
 * configuradas, `context` é indefinido: a consulta de estado responde
 * `disabled` e as ações respondem 503, enquanto o resto da API segue normal.
 */
export async function registerIntegrationRoutes(app: FastifyInstance, source: string, context?: IntegrationContext) {
  const base = `/integrations/${source}`;
  const disabled = () => externalSyncStateSchema.parse({
    source, status: 'disabled', startedAt: null, finishedAt: null, summary: null,
    error: 'A integração está desligada: configure ACHIEVIST_BASE_URL, ACHIEVIST_USERNAME e ACHIEVIST_PASSWORD.',
  });

  app.get(`${base}/sync`, async (_request, reply) => {
    if (!context) return reply.send(disabled());
    return reply.send(externalSyncStateSchema.parse(context.runner.snapshot()));
  });

  // Diagnóstico para a tela de Configurações: o servidor diz se tem as
  // credenciais e, quando testado, se elas autenticam. Nada sensível sai daqui.
  app.get(`${base}/status`, async (_request, reply) => {
    if (!context?.checkConnection) {
      return reply.send(externalIntegrationStatusSchema.parse({
        source, configured: Boolean(context), reachable: null, accounts: null, error: null,
      }));
    }
    try {
      const { accounts } = await context.checkConnection();
      return reply.send(externalIntegrationStatusSchema.parse({ source, configured: true, reachable: true, accounts, error: null }));
    } catch (error) {
      // A mensagem vem do cliente da fonte, que nunca repete usuário nem senha.
      return reply.send(externalIntegrationStatusSchema.parse({
        source, configured: true, reachable: false, accounts: null,
        error: error instanceof Error ? error.message : 'Não foi possível falar com a fonte.',
      }));
    }
  });

  app.post(`${base}/sync`, async (_request, reply) => {
    if (!context) return reply.code(503).send(disabled());
    if (!context.runner.start()) {
      return reply.code(409).send({ error: 'Já existe uma sincronização em andamento.' });
    }
    return reply.code(202).send(externalSyncStateSchema.parse(context.runner.snapshot()));
  });

  // A fila mostra apenas o que espera decisão do usuário. As sugestões são
  // calculadas na leitura, por título normalizado, e nunca aplicadas sozinhas.
  app.get(`${base}/pending`, async (_request, reply) => {
    if (!context) return reply.code(503).send(disabled());
    const [records, games] = await Promise.all([
      context.deps.queue.listForSource(source),
      context.deps.games.list(),
    ]);
    const pending = records.filter((record) => record.status === 'PENDING')
      .map((record) => externalPendingMatchSchema.parse(toPendingMatch(record, games)));
    return reply.send(pending);
  });

  app.post<{ Params: { id: string } }>(`${base}/pending/:id/confirm`, async (request, reply) => {
    if (!context) return reply.code(503).send(disabled());
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = externalMatchConfirmSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados da confirmação inválidos.', issues: parsed.error.issues });
    const pending = await context.deps.queue.find(id);
    if (!pending || pending.source !== source) return reply.code(404).send({ error: 'Pendência não encontrada.' });

    const outcome = await confirmExternalMatch(context.deps, pending, parsed.data);
    if (!outcome.ok) return reply.code(outcome.status).send({ error: outcome.error });
    return reply.code(201).send(toGamePlatform(outcome.record));
  });

  // Cadastrar o jogo que ainda não existe na biblioteca e vincular na mesma ação.
  app.post<{ Params: { id: string } }>(`${base}/pending/:id/create-game`, async (request, reply) => {
    if (!context) return reply.code(503).send(disabled());
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = externalMatchCreateGameSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados do jogo inválidos.', issues: parsed.error.issues });
    const pending = await context.deps.queue.find(id);
    if (!pending || pending.source !== source) return reply.code(404).send({ error: 'Pendência não encontrada.' });

    const outcome = await createGameFromMatch(context.deps, pending, parsed.data);
    if (!outcome.ok) return reply.code(outcome.status).send({ error: outcome.error });
    const created = await context.deps.games.find(outcome.gameId);
    if (!created) return reply.code(404).send({ error: 'Jogo não encontrado após o cadastro.' });
    return reply.code(201).send(externalMatchCreatedSchema.parse({
      game: toGame(created), platform: toGamePlatform(outcome.record),
    }));
  });

  // Ignorar não apaga a linha: é o que impede a próxima sincronização de
  // propor a mesma entrada outra vez.
  app.post<{ Params: { id: string } }>(`${base}/pending/:id/ignore`, async (request, reply) => {
    if (!context) return reply.code(503).send(disabled());
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const pending = await context.deps.queue.find(id);
    if (!pending || pending.source !== source) return reply.code(404).send({ error: 'Pendência não encontrada.' });
    if (!await context.deps.queue.ignore(id)) return reply.code(404).send({ error: 'Pendência não encontrada.' });
    return reply.code(204).send();
  });
}
