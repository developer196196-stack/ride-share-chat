/**
 * Low-watch development server. Nest's --watch traverses the pnpm workspace
 * and consumes enough inotify watches to prevent Expo's Metro from starting.
 * Poll only API-owned inputs instead; leave Metro's watcher budget untouched.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sources = path.join(root, 'src');
const inputs = [
  path.join(root, 'tsconfig.build.json'),
  path.join(root, 'nest-cli.json'),
  path.join(root, '..', '..', 'lib', 'api-spec', 'openapi.yaml'),
];
const intervalMs = 1000;
let server;
let building = false;
let stopping = false;
let lastBuilt;

function snapshot() {
  const files = [];
  function walk(location) {
    for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
      const file = path.join(location, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  walk(sources);
  files.push(...inputs);
  return files.sort().map((file) => {
    try {
      const { mtimeMs, size } = fs.statSync(file);
      return `${file}:${mtimeMs}:${size}`;
    } catch (error) {
      if (error.code === 'ENOENT') return `${file}:missing`;
      throw error;
    }
  }).join('\n');
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code === 0 && !signal));
  });
}

function stopServer() {
  if (!server) return Promise.resolve();
  const child = server;
  server = undefined;
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
  });
}

function startServer() {
  server = spawn(process.execPath, [path.join(root, 'dist', 'main.js')], {
    cwd: root,
    stdio: 'inherit',
  });
  const child = server;
  child.once('error', (error) => {
    console.error('API server failed to start:', error);
    process.exitCode = 1;
    shutdown();
  });
  child.once('exit', (code, signal) => {
    if (server !== child || stopping) return;
    console.error(`API server exited unexpectedly (${signal || code}).`);
    process.exitCode = 1;
    shutdown();
  });
}

async function rebuild() {
  if (building || stopping) return;
  building = true;
  try {
    const before = snapshot();
    console.log('Building API after source change…');
    // Run the CLI's JS entry with node: `.bin/nest` is a shell shim that spawn()
    // can't execute on Windows (there it's nest.CMD → ENOENT).
    const nest = require.resolve('@nestjs/cli/bin/nest.js', { paths: [root] });
    if (!(await run(process.execPath, [nest, 'build']))) {
      console.error('API build failed; keeping the currently running server.');
      lastBuilt = before;
      return;
    }
    if (!(await run(process.execPath, [path.join(__dirname, 'copy-openapi.js')]))) {
      console.error('OpenAPI copy failed; keeping the currently running server.');
      lastBuilt = before;
      return;
    }
    // If a file changed during compilation, rebuild again before serving it.
    if (snapshot() !== before || stopping) return;
    await stopServer();
    if (!stopping) {
      startServer();
      lastBuilt = before;
    }
  } catch (error) {
    console.error('API rebuild failed:', error);
    process.exitCode = 1;
    shutdown();
  } finally {
    building = false;
  }
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  void stopServer();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

const timer = setInterval(() => {
  if (building || stopping) return;
  try {
    if (snapshot() !== lastBuilt) void rebuild();
  } catch (error) {
    console.error('Could not scan API sources:', error);
    process.exitCode = 1;
    shutdown();
  }
}, intervalMs);
void rebuild();