/**
 * Runs `next dev` / `next start` on $PORT (set by Replit) or 3010 locally.
 * Replaces `--port ${PORT:-3010}`, which only works in POSIX shells (not Windows).
 *
 *   node scripts/next.mjs dev
 *   node scripts/next.mjs start
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const command = process.argv[2] ?? 'dev';
const port = process.env.PORT?.trim() || '3010';
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');

const child = spawn(process.execPath, [nextBin, command, '--hostname', '0.0.0.0', '--port', port, ...process.argv.slice(3)], {
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
