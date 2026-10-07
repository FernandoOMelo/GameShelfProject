import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const maxImageBytes = 8 * 1024 * 1024;
const mediaPathPrefix = '/media/';
const imageTypes = {
  jpeg: { contentType: 'image/jpeg', extension: '.jpg' },
  png: { contentType: 'image/png', extension: '.png' },
  webp: { contentType: 'image/webp', extension: '.webp' },
} as const;

export interface GameImageStorage {
  importImage(sourceUrl: string): Promise<string>;
  removeImage(publicUrl: string): Promise<void>;
  openImage(filename: string): Promise<{ stream: ReadStream; contentType: string } | undefined>;
}

export class LocalImageStorage implements GameImageStorage {
  private readonly directory: string;

  constructor(directory: string, private readonly fetcher: typeof fetch = fetch) {
    this.directory = resolve(directory);
  }

  async importImage(sourceUrl: string): Promise<string> {
    const url = validateSourceUrl(sourceUrl);
    const response = await this.fetcher(url, { signal: AbortSignal.timeout(10_000), redirect: 'error' });
    if (!response.ok || !response.body) throw new Error('Image download failed.');

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxImageBytes) {
      await response.body.cancel();
      throw new Error('Image exceeds the maximum allowed size.');
    }

    const bytes = await readBoundedImage(response.body);
    const imageType = detectImageType(bytes);
    await mkdir(this.directory, { recursive: true });
    const filename = `${randomUUID()}${imageType.extension}`;
    await writeFile(join(this.directory, filename), bytes, { flag: 'wx', mode: 0o600 });
    return `${mediaPathPrefix}${filename}`;
  }

  async removeImage(publicUrl: string): Promise<void> {
    if (!publicUrl.startsWith(mediaPathPrefix)) return;
    const filename = parseMediaFilename(publicUrl.slice(mediaPathPrefix.length));
    if (filename) await rm(join(this.directory, filename), { force: true });
  }

  async openImage(filename: string): Promise<{ stream: ReadStream; contentType: string } | undefined> {
    const safeFilename = parseMediaFilename(filename);
    if (!safeFilename || extname(safeFilename) !== extname(filename)) return undefined;
    try {
      const filePath = join(this.directory, safeFilename);
      if (!(await stat(filePath)).isFile()) return undefined;
      const imageType = Object.values(imageTypes).find((type) => type.extension === extname(safeFilename));
      if (!imageType) return undefined;
      return { stream: createReadStream(filePath), contentType: imageType.contentType };
    } catch {
      return undefined;
    }
  }
}

function validateSourceUrl(sourceUrl: string): URL {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error('Invalid image URL.');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'images.igdb.com' || url.port || url.username || url.password) {
    throw new Error('Only IGDB image URLs can be imported.');
  }
  return url;
}

async function readBoundedImage(body: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxImageBytes) {
        await reader.cancel();
        throw new Error('Image exceeds the maximum allowed size.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

function detectImageType(bytes: Buffer): (typeof imageTypes)[keyof typeof imageTypes] {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return imageTypes.jpeg;
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return imageTypes.png;
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return imageTypes.webp;
  throw new Error('Downloaded file is not a supported image.');
}

function parseMediaFilename(filename: string): string | undefined {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(filename)
    ? filename
    : undefined;
}
