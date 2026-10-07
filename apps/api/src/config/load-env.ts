import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const envFile = resolve(workspaceDirectory, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
