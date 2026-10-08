/**
 * Expo dev server for Replit workflows and local development.
 *
 * Replit: do NOT use --localhost — Metro must listen on 0.0.0.0 so the
 * artifact health check (GET /status on $PORT) succeeds.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const port = process.env.PORT || '18115';
const isReplit = Boolean(process.env.REPLIT_DEV_DOMAIN || process.env.REPL_ID);

const env = {
  ...process.env,
  EXPO_NO_TELEMETRY: '1',
  // Prevent Expo from auto-selecting the web bundler in browser-like environments.
  EXPO_NO_WEB: '1',
};

// CI=1 disables Expo Terminal UI and breaks Replit Preview (iOS / Android / Expo Go).
// Replit may inject CI globally — clear it for dev; build.js keeps non-interactive behavior.
delete env.CI;

if (process.env.REPLIT_DEV_DOMAIN) {
  env.EXPO_PUBLIC_DOMAIN = process.env.REPLIT_DEV_DOMAIN;
  env.REACT_NATIVE_PACKAGER_HOSTNAME = process.env.REPLIT_DEV_DOMAIN;
}

if (process.env.REPLIT_EXPO_DEV_DOMAIN) {
  env.EXPO_PACKAGER_PROXY_URL = `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`;
}

if (process.env.REPL_ID) {
  env.EXPO_PUBLIC_REPL_ID = process.env.REPL_ID;
}

function isPortInUse(checkPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(Number(checkPort), '0.0.0.0');
  });
}

/** Free a stale Metro/Expo listener (common after workflow restart on Replit). */
function killProcessOnPort(checkPort) {
  if (process.platform === 'win32') {
    try {
      execSync(
        `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${checkPort} ^| findstr LISTENING') do taskkill /F /PID %a`,
        { stdio: 'ignore', shell: true },
      );
      return true;
    } catch {
      return false;
    }
  }

  try {
    execSync(`fuser -k ${checkPort}/tcp 2>/dev/null`, { stdio: 'ignore' });
    return true;
  } catch {
    try {
      execSync(`lsof -ti:${checkPort} | xargs -r kill -9 2>/dev/null`, {
        stdio: 'ignore',
        shell: true,
      });
      return true;
    } catch {
      return false;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensurePortAvailable() {
  if (!(await isPortInUse(port))) {
    return;
  }

  console.warn(`Port ${port} is already in use — stopping stale Metro/Expo process…`);
  killProcessOnPort(port);
  await sleep(1500);

  if (await isPortInUse(port)) {
    console.error(
      `\nPort ${port} is still in use.\n` +
        '- On Replit: click **Restart** on the **Mobile App** workflow (do not run `pnpm dev` in Shell while the workflow is running).\n' +
        `- Or free the port: fuser -k ${port}/tcp\n`,
    );
    process.exit(1);
  }

  console.log(`Port ${port} is free.`);
}

/**
 * Returns true if the Metro cache directory exists and is older than pnpm-lock.yaml.
 * When the lockfile is newer, monorepo dependencies changed and the cache is stale.
 */
function isMetroCacheStale() {
  const lockfile = path.join(projectRoot, '../../pnpm-lock.yaml');
  const metroCache = path.join(projectRoot, 'node_modules/.cache/metro');
  try {
    const lockStat = fs.statSync(lockfile);
    const cacheStat = fs.statSync(metroCache);
    return lockStat.mtimeMs > cacheStat.mtimeMs;
  } catch {
    // If either path doesn't exist, no stale cache to worry about.
    return false;
  }
}

function authenticateExpoLauncher() {
  const session = process.env.REPLIT_EXPO_SESSION_SECRET;
  if (!session) {
    console.warn(
      'REPLIT_EXPO_SESSION_SECRET is unset — physical iOS Expo Go may reject SDK 57 previews.',
    );
    return Promise.resolve();
  }

  // create-launch writes ~/.expo/state.json atomically but does not create the
  // parent directory. On a fresh workspace Expo itself has not started yet.
  try {
    fs.mkdirSync(path.join(os.homedir(), '.expo'), { recursive: true });
  } catch (error) {
    console.warn(`Could not prepare Expo's state directory: ${error.message}`);
  }

  console.log('Authenticating Expo Go launch session…');
  return new Promise((resolve) => {
    const login = spawn(
      'pnpm',
      ['exec', 'create-launch', 'login', '--session', session],
      {
        cwd: projectRoot,
        env,
        stdio: ['ignore', 'inherit', 'inherit'],
      },
    );

    login.on('error', (error) => {
      console.warn(`Expo launch authentication could not start: ${error.message}`);
      resolve();
    });
    login.on('exit', (code) => {
      if (code !== 0) {
        console.warn(
          `Expo launch authentication exited with code ${code}; continuing with Metro.`,
        );
      }
      resolve();
    });
  });
}

function startExpo() {
  const args = ['exec', 'expo', 'start', '--port', port];

  if (!isReplit) {
    args.push('--localhost');
  }
  // On Replit: do NOT pass --non-interactive (deprecated in newer Expo) and do NOT set CI=1
  // (CI=1 hides native preview). Port conflicts are pre-empted by ensurePortAvailable().
  // EXPO_NO_WEB=1 (set in env above) blocks web-bundler auto-selection.

  // Explicit guard: never pass --web. EXPO_NO_WEB=1 (set in env above) also blocks it.
  // (No --web flag added anywhere in this file.)

  if (process.env.CLEAR_METRO === '1') {
    args.push('--clear');
    console.log('CLEAR_METRO=1 — clearing Metro bundler cache.');
  } else if (isMetroCacheStale()) {
    args.push('--clear');
    console.log('pnpm-lock.yaml is newer than Metro cache — auto-clearing stale cache.');
  }

  const child = spawn('pnpm', args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`Expo exited due to signal: ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

async function main() {
  console.log('=== Rideshare Chats mobile dev (scripts/dev.js) ===');
  console.log(`Starting Expo dev server on port ${port}${isReplit ? ' (Replit)' : ' (local)'}`);

  if (isReplit) {
    console.log(
      'Replit native preview: use Preview toolbar → iOS Simulator / Android Emulator / Open in Expo Go',
    );
    if (!process.env.REPLIT_EXPO_DEV_DOMAIN) {
      console.warn(
        'REPLIT_EXPO_DEV_DOMAIN is unset — Expo Go QR may not work until Replit injects it',
      );
    }
  }

  await ensurePortAvailable();
  await authenticateExpoLauncher();
  startExpo();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
