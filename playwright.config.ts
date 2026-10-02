import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      ...(process.env.GAMESHELF_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' as const } : {}),
    },
  }],
  webServer: {
    command: process.platform === 'win32'
      ? 'npm exec --yes --package=pnpm@10.12.1 -- pnpm --filter @gameshelf/web preview -- --host 127.0.0.1 --port 4173'
      : 'pnpm --filter @gameshelf/web preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
