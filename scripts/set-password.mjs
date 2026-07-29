/**
 * Sets (or changes) the app's login password by writing a scrypt hash into .env.
 * The plaintext password is never stored or logged.
 *
 *   npm run set-password
 *
 * For non-interactive use (CI, remote shells without a TTY):
 *   printf 'my-password\n' | npm run set-password -- --stdin
 *
 * Running in Docker? Use `npm run hash-password` instead — a .env written
 * inside a container doesn't survive a rebuild.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashPassword } from '../server/password.js';
import { collectPassword } from './prompt.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(rootDir, '.env');

function upsertEnvValue(contents, key, value) {
  const line = `${key}=${value}`;
  // Match the key even when it's currently empty, and leave comments alone.
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(contents)) return contents.replace(pattern, line);
  return `${contents.replace(/\s*$/, '')}\n${line}\n`;
}

const password = await collectPassword({ commandHint: 'npm run set-password' });

const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
fs.writeFileSync(envPath, upsertEnvValue(existing, 'AUTH_PASSWORD_HASH', hashPassword(password)), {
  mode: 0o600,
});

console.log('\n✓ Password saved to .env');
console.log('\nNow restart the app:');
console.log('  pkill -f "server/index.js"');
console.log('  npm start\n');
