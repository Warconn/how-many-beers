import { spawnSync } from 'node:child_process';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
// Sequential locally: Next dev/build configurations share .next and must not race.
for (const args of [
  ['run', 'typecheck'], ['run', 'test'],
  ['exec', '--', 'playwright', 'test', '--config=playwright.auth.config.ts'],
  ['exec', '--', 'playwright', 'test', '--config=playwright.accounts.config.ts'],
  ['run', 'test:e2e'], ['run', 'test:offline'],
]) {
  const result = spawnSync(npm, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
