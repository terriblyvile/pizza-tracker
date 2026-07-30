/**
 * Starts the API server and the Vite dev server together, and shuts both down
 * cleanly on Ctrl-C. Avoids pulling in `concurrently` for a two-process setup.
 */
import { spawn } from 'node:child_process';

const procs = [];
let shuttingDown = false;

// Vite proxies /api and /uploads to this port (see client/vite.config.ts), so
// the two have to agree. Override with API_PORT if 3001 is taken.
const API_PORT = process.env.API_PORT || '3001';

function run(name, command, args, color, env) {
  const childEnv = { ...process.env, ...env };
  // An explicit undefined means "unset this", not "pass the string undefined".
  for (const key of Object.keys(childEnv)) {
    if (childEnv[key] === undefined) delete childEnv[key];
  }

  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: childEnv,
  });

  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, target) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) target.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    process.stdout.write(`${prefix}exited (${signal ?? code}) — stopping everything\n`);
    shutdown(code ?? 1);
  });

  procs.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of procs) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 250);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// PORT is pinned rather than inherited: an ambient PORT (a shell export, or a
// tool that sets one for the *front end's* port) would otherwise move the API
// onto Vite's port, leaving Vite to fall back to another one and the proxy
// pointing at nothing.
run(
  'api',
  process.execPath,
  ['--env-file-if-exists=.env', '--watch', 'server/index.js'],
  '36',
  { PORT: API_PORT, HOST: '127.0.0.1' },
);

// Vite reads its port from client/vite.config.ts; PORT must not leak in here
// either, or it would shadow that config in some setups.
run('web', 'npm', ['--prefix', 'client', 'run', 'dev'], '35', { PORT: undefined });
