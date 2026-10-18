import { z } from 'zod';

const optionalSecret = z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional());

const envSchema = z.object({
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().optional(),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  MEDIA_STORAGE_PATH: z.string().min(1).default('.gameshelf/media'),
  IGDB_CLIENT_ID: optionalSecret,
  IGDB_CLIENT_SECRET: optionalSecret,
  // Achievist (ADR-024): única fonte externa de dados de plataforma. Sem as
  // três variáveis a integração fica desligada e o resto da API segue normal.
  // A senha só existe no servidor: nunca vai ao frontend nem para o log.
  ACHIEVIST_BASE_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  ACHIEVIST_USERNAME: optionalSecret,
  ACHIEVIST_PASSWORD: optionalSecret,
}).superRefine((values, context) => {
  if (Boolean(values.IGDB_CLIENT_ID) !== Boolean(values.IGDB_CLIENT_SECRET)) {
    context.addIssue({ code: 'custom', message: 'IGDB_CLIENT_ID e IGDB_CLIENT_SECRET devem ser configuradas em conjunto.' });
  }
  const achievist = [values.ACHIEVIST_BASE_URL, values.ACHIEVIST_USERNAME, values.ACHIEVIST_PASSWORD];
  if (achievist.some(Boolean) && !achievist.every(Boolean)) {
    context.addIssue({ code: 'custom', message: 'ACHIEVIST_BASE_URL, ACHIEVIST_USERNAME e ACHIEVIST_PASSWORD devem ser configuradas em conjunto.' });
  }
});

export const env = envSchema.parse(process.env);
