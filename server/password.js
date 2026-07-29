import crypto from 'node:crypto';

// scrypt parameters. N=2^16 keeps a single verification around a tenth of a
// second — plenty slow for offline cracking, unnoticeable at login.
const SCRYPT = { N: 65536, r: 8, p: 1, keylen: 64, maxmem: 128 * 1024 * 1024 };

/**
 * Fields are joined with ':' rather than the conventional '$'. The hash travels
 * through .env files and docker-compose, where '$' triggers variable
 * interpolation and would silently mangle it into an unusable value. Base64
 * never contains ':', so it's an unambiguous separator here.
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password.normalize('NFKC'), salt, SCRYPT.keylen, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), derived.toString('base64')].join(
    ':',
  );
}

export function verifyPassword(password, stored) {
  // '$'-separated hashes from before the switch still verify.
  const raw = String(stored);
  const parts = raw.includes(':') ? raw.split(':') : raw.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, N, r, p, saltB64, expectedB64] = parts;
  const expected = Buffer.from(expectedB64, 'base64');

  let derived;
  try {
    derived = crypto.scryptSync(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
  } catch {
    return false;
  }

  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}
