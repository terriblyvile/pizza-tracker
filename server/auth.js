import crypto from 'node:crypto';

import { db, nowIso } from './db.js';
import { verifyPassword } from './password.js';

const COOKIE_NAME = 'pizza_session';
const SESSION_DAYS = 30;

export function isConfigured() {
  return Boolean(process.env.AUTH_PASSWORD_HASH?.trim());
}

/* ---------------------------------------------------------------- sessions */

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function purgeExpired() {
  db.prepare('DELETE FROM sessions WHERE datetime(expires_at) < datetime(?)').run(nowIso());
}

function createSession(userAgent) {
  purgeExpired();

  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);

  db.prepare(
    'INSERT INTO sessions (token_hash, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?)',
  ).run(hashToken(token), now.toISOString(), expires.toISOString(), now.toISOString(), userAgent ?? null);

  return { token, expires };
}

function readSession(token) {
  if (!token) return null;

  const session = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(token));
  if (!session) return null;

  if (new Date(session.expires_at) <= new Date()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(session.token_hash);
    return null;
  }

  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(nowIso(), session.token_hash);
  return session;
}

function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

/* ----------------------------------------------------------------- cookies */

function parseCookies(header) {
  const jar = {};
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    jar[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return jar;
}

/** True when the original client request used HTTPS, including via a proxy. */
function isSecureRequest(req) {
  return req.secure || (req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
}

function setSessionCookie(req, res, token, expires) {
  const attributes = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    // Lax still blocks cross-site POST/PATCH/DELETE, which is our CSRF defense.
    'SameSite=Lax',
    `Expires=${expires.toUTCString()}`,
  ];
  // Only mark Secure when the connection actually is: setting it on plain HTTP
  // makes the browser drop the cookie and login silently fails.
  if (isSecureRequest(req)) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(req, res) {
  const attributes = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecureRequest(req)) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

/* ------------------------------------------------------------ rate limiting */

// Per-IP failure tracking. In-memory is fine for a single-process personal app;
// the window resets on restart, which only ever helps a legitimate user.
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60_000;

function checkRateLimit(ip) {
  const record = attempts.get(ip);
  if (!record) return { allowed: true };

  if (Date.now() - record.first > LOCKOUT_MS) {
    attempts.delete(ip);
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((LOCKOUT_MS - (Date.now() - record.first)) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

function recordFailure(ip) {
  const record = attempts.get(ip);
  if (!record || Date.now() - record.first > LOCKOUT_MS) {
    attempts.set(ip, { count: 1, first: Date.now() });
  } else {
    record.count += 1;
  }
}

/* ------------------------------------------------------------- middleware */

/** Rejects any request without a valid session cookie. */
export function requireAuth(req, res, next) {
  if (!isConfigured()) {
    return res.status(401).json({
      error: 'No password is set yet.',
      setupRequired: true,
    });
  }

  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!readSession(token)) {
    return res.status(401).json({ error: 'Not signed in.', authRequired: true });
  }

  next();
}

/** Mounts /api/auth/* onto the app. Must run before requireAuth is applied. */
export function mountAuthRoutes(app) {
  app.get('/api/auth/session', (req, res) => {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    res.json({
      configured: isConfigured(),
      authenticated: isConfigured() && Boolean(readSession(token)),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    if (!isConfigured()) {
      return res.status(503).json({
        error: 'No password is set. Run `npm run set-password` on the server, then restart it.',
        setupRequired: true,
      });
    }

    const ip = req.ip ?? 'unknown';
    const limit = checkRateLimit(ip);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).`,
      });
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password || !verifyPassword(password, process.env.AUTH_PASSWORD_HASH.trim())) {
      recordFailure(ip);
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    attempts.delete(ip);
    const { token, expires } = createSession(req.headers['user-agent']);
    setSessionCookie(req, res, token, expires);
    res.json({ authenticated: true });
  });

  app.post('/api/auth/logout', (req, res) => {
    destroySession(parseCookies(req.headers.cookie)[COOKIE_NAME]);
    clearSessionCookie(req, res);
    res.json({ authenticated: false });
  });

  // Signs out every device — useful if a password is ever changed or leaked.
  app.post('/api/auth/logout-all', requireAuth, (req, res) => {
    db.exec('DELETE FROM sessions');
    clearSessionCookie(req, res);
    res.json({ authenticated: false });
  });
}
