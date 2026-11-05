import { readFile, writeFile } from 'node:fs/promises';

// Full diagnostics stay in the shard report. The small review artifact only
// needs identities, outcomes and durations, not duplicated binary attachments.
const [source, target] = process.argv.slice(2);
if (!source || !target) throw new Error('Usage: compact-playwright-timings.mjs <raw-report> <timing-report>');
const report = JSON.parse(await readFile(source, 'utf8'));
const compact = JSON.stringify(report, (key, value) =>
  ['attachments', 'stdout', 'stderr'].includes(key) ? undefined : value);
await writeFile(target, compact + '\n');
console.log(`Prepared timing report: ${target} (${Buffer.byteLength(compact)} bytes)`);
