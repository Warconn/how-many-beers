import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('Usage: npm run test:fast -- <Playwright file/filter/config arguments>\nRuns typecheck, unit tests, then targeted browser tests. Example: npm run test:fast -- e2e/home-cleanup.spec.ts');
  process.exit(args.includes('--help') ? 0 : 1);
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const command of [['run', 'typecheck'], ['run', 'test'], ['exec', '--', 'playwright', 'test', ...args]]) {
  const result = spawnSync(npm, command, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
