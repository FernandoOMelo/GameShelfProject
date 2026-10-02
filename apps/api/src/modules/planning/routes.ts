import type { FastifyInstance } from 'fastify';
import { weeklyMinutesSchema } from '@gameshelf/contracts';
import type { PlanningSettingsRepository } from './repository.js';

export async function registerPlanningRoutes(app: FastifyInstance, repository: PlanningSettingsRepository) {
  app.get('/planning/settings', async (_request, reply) => reply.send({ weeklyMinutes: await repository.getWeeklyMinutes() }));

  app.put('/planning/settings', async (request, reply) => {
    const parsed = weeklyMinutesSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Meta semanal inválida.', issues: parsed.error.issues });
    await repository.setWeeklyMinutes(parsed.data.weeklyMinutes);
    return reply.send(parsed.data);
  });
}
