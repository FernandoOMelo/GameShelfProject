import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { LocalImageStorage } from './image-storage.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function createStorage(fetcher: typeof fetch) {
  const directory = await mkdtemp(join(tmpdir(), 'gameshelf-media-'));
  directories.push(directory);
  return { directory, storage: new LocalImageStorage(directory, fetcher) };
}

describe('LocalImageStorage', () => {
  it('downloads only allowlisted IGDB images and serves them from the local directory', async () => {
    const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(imageBytes, { status: 200 }));
    const { directory, storage } = await createStorage(fetcher);

    const publicUrl = await storage.importImage('https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg');
    const filename = publicUrl.slice('/media/'.length);
    const app = buildApp({ imageStorage: storage });
    const response = await app.inject(`/media/${filename}`);

    expect(publicUrl).toMatch(/^\/media\/[0-9a-f-]+\.jpg$/);
    expect(await readFile(join(directory, filename))).toEqual(imageBytes);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/jpeg');
    expect(response.rawPayload).toEqual(imageBytes);
    expect(fetcher).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'error' }));
    await app.close();
    await storage.removeImage(publicUrl);
    expect(await storage.openImage(filename)).toBeUndefined();
  });

  it('rejects external hosts and content that is not a supported image', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<script>alert(1)</script>', { status: 200 }));
    const { storage } = await createStorage(fetcher);

    await expect(storage.importImage('https://127.0.0.1/private')).rejects.toThrow('Only IGDB image URLs');
    await expect(storage.importImage('https://images.igdb.com/image.jpg')).rejects.toThrow('not a supported image');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects files larger than the configured limit before writing them', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
      status: 200,
      headers: { 'content-length': String(8 * 1024 * 1024 + 1) },
    }));
    const { directory, storage } = await createStorage(fetcher);

    await expect(storage.importImage('https://images.igdb.com/image.jpg')).rejects.toThrow('maximum allowed size');
    expect(await (await import('node:fs/promises')).readdir(directory)).toEqual([]);
  });
});
