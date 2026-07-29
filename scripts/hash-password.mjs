/**
 * Prints a scrypt password hash without writing anything.
 *
 * This is the Docker path: a .env written inside a container is thrown away on
 * the next rebuild, so generate the hash here and paste it into the .env on
 * your host, which docker-compose passes in as an environment variable.
 *
 *   docker compose run --rm pizza-tracker npm run hash-password
 *
 * The hash is safe to store in .env and compose files — it contains no '$', so
 * nothing tries to interpolate it.
 */
import { hashPassword } from '../server/password.js';
import { collectPassword } from './prompt.mjs';

const password = await collectPassword({ commandHint: 'npm run hash-password' });

console.log('\nAdd this line to .env on the host, then restart:\n');
console.log(`AUTH_PASSWORD_HASH=${hashPassword(password)}\n`);
