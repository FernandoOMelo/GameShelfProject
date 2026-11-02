import Fastify from 'fastify';
import type { Platform } from '@gameshelf/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { platformPresentation } from './catalog.js';
import type { PlatformRepository } from './repository.js';
import { registerPlatformRoutes } from './routes.js';

function memoryRepository(): PlatformRepository {
  const items: Platform[] = [];
  return {
    list: async () => items,
    create: async (name, parentId = null, presentation) => {
      const platform: Platform = { id: crypto.randomUUID(), name, parentId, catalogKey: presentation?.catalogKey ?? null, iconKey: presentation?.iconKey ?? null, color: presentation?.color ?? null };
      items.push(platform);
      return platform;
    },
    rename: async () => undefined,
    setParent: async () => undefined,
    setPresentation: async (id, presentation) => {
      const platform = items.find((item) => item.id === id);
      if (!platform) return undefined;
      Object.assign(platform, presentation);
      return platform;
    },
    countGameLinks: async () => 0,
    remove: async () => false,
    listSummaries: async () => [],
  };
}

describe('catálogo de plataformas com identidade visual', () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  async function build() {
    const app = Fastify();
    apps.push(app);
    await registerPlatformRoutes(app, memoryRepository());
    return app;
  }

  it('reconhece nomes e apelidos do catálogo', () => {
    expect(platformPresentation('PlayStation 5')).toEqual({ catalogKey: 'ps5', iconKey: 'playstation', color: '#0070D1' });
    expect(platformPresentation('ps5').catalogKey).toBe('ps5');
    expect(platformPresentation('Rockstar Games').iconKey).toBe('rockstar');
    expect(platformPresentation('Plataforma própria')).toEqual({ catalogKey: null, iconKey: null, color: null });
  });

  it('lista o catálogo e grava ícone e cor ao cadastrar pelo nome', async () => {
    const app = await build();
    const catalog = (await app.inject('/platforms/catalog')).json() as Array<{ name: string }>;
    expect(catalog.some((entry) => entry.name === 'Steam')).toBe(true);

    const created = await app.inject({ method: 'POST', url: '/platforms', payload: { name: 'Steam' } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ iconKey: 'steam', color: '#2A6FA8' });
  });

  it('usa o ícone e a cor escolhidos numa plataforma personalizada', async () => {
    const app = await build();
    const created = await app.inject({ method: 'POST', url: '/platforms', payload: { name: 'Meu console', iconKey: 'retro', color: '#112233' } });
    expect(created.json()).toMatchObject({ catalogKey: null, iconKey: 'retro', color: '#112233' });

    const invalid = await app.inject({ method: 'POST', url: '/platforms', payload: { name: 'Outra', color: 'azul' } });
    expect(invalid.statusCode).toBe(400);
  });

  it('troca ícone e cor de uma plataforma existente', async () => {
    const app = await build();
    const { id } = (await app.inject({ method: 'POST', url: '/platforms', payload: { name: 'Meu console' } })).json() as { id: string };
    const updated = await app.inject({ method: 'PATCH', url: `/platforms/${id}`, payload: { iconKey: 'xbox' } });
    expect(updated.json()).toMatchObject({ iconKey: 'xbox', color: '#107C10' });
    const recolored = await app.inject({ method: 'PATCH', url: `/platforms/${id}`, payload: { color: '#AA0000' } });
    expect(recolored.json()).toMatchObject({ iconKey: 'xbox', color: '#AA0000' });
  });
});
