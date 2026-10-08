import type { FastifyInstance } from 'fastify';
import { backupSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { FranchiseRepository } from '../franchises/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';
import type { GenreRepository } from '../genres/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { ScreenshotRepository } from '../sessions/screenshot-repository.js';
import type { BacklogRepository } from '../backlog/repository.js';
import type { GameListRepository } from '../game-lists/repository.js';
import type { MainChallengeRepository } from '../challenge/repository.js';
import type { GoalRepository } from '../goals/repository.js';
import type { PlanningSettingsRepository } from '../planning/repository.js';
import { LibraryNotEmptyError, type BackupImporter } from './importer.js';
import { buildBackup, findBackupIssues } from './service.js';

export type BackupDependencies = {
  games: GameRepository;
  franchises: FranchiseRepository;
  platforms: PlatformRepository;
  genres: GenreRepository;
  sessions: SessionRepository;
  screenshots: ScreenshotRepository;
  backlog: BacklogRepository;
  lists: GameListRepository;
  challenges: MainChallengeRepository;
  goals: GoalRepository;
  planning: PlanningSettingsRepository;
  importer: BackupImporter;
};

const IMPORT_BODY_LIMIT = 64 * 1024 * 1024;

export async function registerBackupRoutes(app: FastifyInstance, deps: BackupDependencies) {
  app.get('/backup/export', async (_request, reply) => {
    const [franchises, platforms, genres, games, sessions, screenshots, queue, lists, challenge, goals, weeklyMinutes] = await Promise.all([
      deps.franchises.list(), deps.platforms.list(), deps.genres.list(), deps.games.list(), deps.sessions.listAll(), deps.screenshots.listAll(),
      deps.backlog.listQueue(), deps.lists.list(), deps.challenges.get(), deps.goals.list(), deps.planning.getWeeklyMinutes(),
    ]);
    const exportedAt = new Date();
    const backup = backupSchema.parse(buildBackup({
      franchises: franchises.map(({ id, name }) => ({ id, name })), platforms: platforms.map(({ id, name }) => ({ id, name })), genres: genres.map(({ id, name }) => ({ id, name })),
      games, sessions, screenshots, queue, lists, challenge, goals, weeklyMinutes,
    }, exportedAt));
    return reply
      .header('content-disposition', `attachment; filename="gameshelf-backup-${exportedAt.toISOString().slice(0, 10)}.json"`)
      .type('application/json')
      .send(backup);
  });

  app.post('/backup/import', { bodyLimit: IMPORT_BODY_LIMIT }, async (request, reply) => {
    const parsed = backupSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Arquivo de backup inválido.', issues: parsed.error.issues.slice(0, 20) });
    const problems = findBackupIssues(parsed.data.data);
    if (problems.length) return reply.code(400).send({ error: 'O backup tem referências inconsistentes.', problems });
    try {
      await deps.importer.importAll(parsed.data.data);
    } catch (error) {
      if (error instanceof LibraryNotEmptyError) return reply.code(409).send({ error: error.message });
      request.log.error(error);
      return reply.code(422).send({ error: 'Não foi possível importar: o banco rejeitou os dados. Nada foi gravado.' });
    }
    const { data } = parsed.data;
    return reply.code(201).send({
      games: data.games.length, sessions: data.sessions.length, lists: data.lists.length, goals: data.goals.length,
      screenshots: data.screenshots.length, queue: data.queue.length,
    });
  });
}
