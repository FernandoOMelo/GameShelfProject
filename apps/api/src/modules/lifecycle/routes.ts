import type { FastifyInstance } from 'fastify';
import {
  finishInputSchema, finishResultSchema, finishUndoSchema, lifecycleHintSchema, lifecycleQuerySchema,
  startPlayingInputSchema, startPlayingResultSchema,
} from '@gameshelf/contracts';
import type { BacklogRepository } from '../backlog/repository.js';
import { recordChallengeCompletion, type ChallengeTracking } from '../challenge/record.js';
import type { GameRepository } from '../games/repository.js';
import type { PlaythroughRepository } from '../playthroughs/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import { parseId } from '../shared/parse-id.js';
import { toGame, toPlaythrough } from '../shared/serialize.js';
import { localDate, planFinish, planStart, statusAfterStart } from './service.js';

export type LifecycleDependencies = {
  games: GameRepository; sessions: SessionRepository; playthroughs: PlaythroughRepository;
  backlog?: BacklogRepository; tracking?: ChallengeTracking;
};

/**
 * Comandos do ciclo do jogo (ADR-042). Cada um é uma ação explícita do usuário
 * (tocar em "Iniciar jornada" ou "Zerar"), por isso podem alinhar a ficha do
 * jogo e a jornada. Os repositórios não compartilham transação: as escritas
 * seguem uma ordem que, se falhar no meio, deixa o jogo consistente e a ação
 * pode ser repetida (todas são idempotentes quanto ao resultado final).
 */
export async function registerLifecycleRoutes(app: FastifyInstance, deps: LifecycleDependencies) {
  const { games, sessions, playthroughs } = deps;

  app.get<{ Params: { id: string } }>('/games/:id/lifecycle', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const query = lifecycleQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'Parâmetros inválidos.', issues: query.error.issues });
    const game = await games.find(id);
    if (!game) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const [journeys, sessionRecords] = await Promise.all([playthroughs.listForGame(id), sessions.listForGame(id)]);
    const plan = planStart(journeys);
    const closed = sessionRecords.filter((item) => item.endedAt !== null).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const last = closed[0];
    return reply.send(lifecycleHintSchema.parse({
      start: {
        ...plan,
        suggestedPlatformId: last?.platformId ?? game.platformId ?? null,
        gameStatusAfter: statusAfterStart(toGame(game).status),
        lastSession: last ? { endedAt: last.endedAt!.toISOString(), progress: last.progress, location: last.location, keyDecisions: last.keyDecisions } : null,
      },
      finish: {
        journeyId: planFinish(journeys).journeyId,
        hasOpenSession: sessionRecords.some((item) => item.endedAt === null),
        suggestedCompletedAt: localDate(new Date(), query.data.timezoneOffsetMinutes),
      },
    }));
  });

  app.post<{ Params: { id: string } }>('/games/:id/start-playing', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const body = startPlayingInputSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: body.error.issues });
    const game = await games.find(id);
    if (!game) return reply.code(404).send({ error: 'Jogo não encontrado.' });

    const startedAt = body.data.startedAt ?? new Date().toISOString();
    const day = localDate(startedAt, body.data.timezoneOffsetMinutes);
    const journeys = await playthroughs.listForGame(id);
    const plan = planStart(journeys);
    const lastSession = (await sessions.listForGame(id)).filter((item) => item.endedAt !== null).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
    const platformId = body.data.platformId !== undefined ? body.data.platformId : lastSession?.platformId ?? game.platformId ?? null;

    let journey = journeys.find((item) => item.id === plan.journeyId);
    if (plan.mode === 'OFFER_FIRST' || plan.mode === 'OFFER_REPLAY') {
      journey = await playthroughs.create(id, { status: 'PLAYING', startedAt: day, primaryPlatformId: platformId });
    } else if (plan.mode === 'OFFER_PLANNED') {
      journey = await playthroughs.update(id, plan.journeyId!, { status: 'PLAYING', startedAt: day });
    } else if (plan.mode === 'OFFER_RESUME') {
      journey = await playthroughs.update(id, plan.journeyId!, { status: 'PLAYING', completedAt: null });
    }
    if (!journey) return reply.code(409).send({ error: 'Não foi possível determinar a jornada.' });

    if (body.data.sessionId) {
      const session = await sessions.findForGame(id, body.data.sessionId);
      if (!session) return reply.code(404).send({ error: 'Sessão não encontrada.' });
      await sessions.update(id, session.id, {
        startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null, progress: session.progress,
        location: session.location, notes: session.notes, keyDecisions: session.keyDecisions, tips: session.tips,
        playthroughId: journey.id, platformId: session.platformId ?? platformId,
      });
    }

    // A data de início do jogo só é preenchida quando está vazia; um replay não a reescreve.
    const status = statusAfterStart(toGame(game).status);
    const patch = { ...(game.startedAt ? {} : { startedAt: day }), ...(status === toGame(game).status ? {} : { status }) };
    const updated = Object.keys(patch).length > 0 ? await games.update(id, patch) ?? game : game;
    return reply.send(startPlayingResultSchema.parse({ mode: plan.mode, playthrough: toPlaythrough(journey), game: toGame(updated) }));
  });

  app.post<{ Params: { id: string } }>('/games/:id/finish', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const body = finishInputSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: body.error.issues });
    const game = await games.find(id);
    if (!game) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    if (game.status === 'DESIRED') return reply.code(409).send({ error: 'Um jogo desejado ainda não pode ser zerado. Mova-o para a biblioteca primeiro.' });

    const completedAt = body.data.completedAt ?? localDate(new Date(), body.data.timezoneOffsetMinutes);
    const journeys = await playthroughs.listForGame(id);
    const plan = planFinish(journeys);
    const target = journeys.find((item) => item.id === plan.journeyId);
    const earliest = [game.startedAt, target?.startedAt].filter((item): item is string => Boolean(item)).sort().pop();
    if (earliest && completedAt < earliest) {
      return reply.code(409).send({ error: 'A data de conclusão não pode ser anterior ao início do jogo ou da jornada.' });
    }

    const undo = {
      status: toGame(game).status, startedAt: game.startedAt, completedAt: game.completedAt, rating: game.rating, difficulty: game.difficulty,
      completionCondition: game.completionCondition, favorite: game.favorite, gameOfYear: game.gameOfYear,
      journey: { action: plan.action === 'COMPLETE' ? 'REOPEN' as const : plan.action === 'CREATE_COMPLETED' ? 'DELETE' as const : 'NONE' as const, id: plan.journeyId },
    };

    const now = new Date();
    const closedSessionIds: string[] = [];
    for (const open of (await sessions.listForGame(id)).filter((item) => item.endedAt === null)) {
      const endedAt = now.getTime() >= open.startedAt.getTime() ? now : open.startedAt;
      await sessions.update(id, open.id, {
        startedAt: open.startedAt.toISOString(), endedAt: endedAt.toISOString(), progress: open.progress, location: open.location,
        notes: open.notes, keyDecisions: open.keyDecisions, tips: open.tips, playthroughId: open.playthroughId, platformId: open.platformId,
      });
      closedSessionIds.push(open.id);
    }

    let journey = target;
    if (plan.action === 'COMPLETE') journey = await playthroughs.update(id, plan.journeyId!, { status: 'COMPLETED', completedAt });
    else if (plan.action === 'CREATE_COMPLETED') {
      journey = await playthroughs.create(id, { status: 'COMPLETED', startedAt: game.startedAt, completedAt, primaryPlatformId: game.platformId });
      undo.journey.id = journey.id;
    }

    const { rating, difficulty, completionCondition, favorite, gameOfYear } = body.data;
    const updated = await games.update(id, {
      ...(rating === undefined ? {} : { rating }), ...(difficulty === undefined ? {} : { difficulty }),
      ...(completionCondition === undefined ? {} : { completionCondition }), ...(favorite === undefined ? {} : { favorite }),
      ...(gameOfYear === undefined ? {} : { gameOfYear }),
      status: 'COMPLETED', completedAt,
      ...(game.startedAt || !journey?.startedAt ? {} : { startedAt: journey.startedAt }),
    });
    if (!updated) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    // Mesmos efeitos de editar o jogo para Zerado: sai da fila e conta nas missões.
    await deps.backlog?.removeFromQueue(id);
    await recordChallengeCompletion(deps.tracking, games, updated);
    return reply.send(finishResultSchema.parse({
      game: toGame(updated), playthrough: journey ? toPlaythrough(journey) : null, closedSessionIds, undo,
    }));
  });

  app.post<{ Params: { id: string } }>('/games/:id/finish/undo', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const body = finishUndoSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: body.error.issues });
    if (!await games.find(id)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const { journey, ...previous } = body.data;
    if (journey.id && journey.action === 'REOPEN') await playthroughs.update(id, journey.id, { status: 'PLAYING', completedAt: null });
    if (journey.id && journey.action === 'DELETE') {
      await sessions.detachPlaythrough(journey.id);
      await playthroughs.delete(id, journey.id);
    }
    const restored = await games.update(id, previous);
    if (!restored) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    return reply.send({ game: toGame(restored) });
  });
}
