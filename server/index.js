import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { db, nowIso, uploadsDir } from './db.js';
import { searchPlaces, activeProvider, hasGoogleKey } from './places/index.js';
import { enrichPlace, removeUploads } from './places/enrich.js';
import { mountAuthRoutes, requireAuth, isConfigured } from './auth.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDist = path.join(rootDir, 'client', 'dist');
const PORT = Number(process.env.PORT) || 3001;
// Bind to loopback by default so the app isn't accidentally reachable; set
// HOST=0.0.0.0 only when something in front of it is terminating TLS.
const HOST = process.env.HOST || '127.0.0.1';

const app = express();

// Needed for correct client IPs (rate limiting) and HTTPS detection behind a
// reverse proxy. 'loopback' is the safe default; set TRUST_PROXY=1 for nginx,
// Caddy, Cloudflare Tunnel, etc.
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');

// Photos arrive as base64 data URLs on the JSON body; the client downscales
// them first, but leave headroom for a large single upload.
app.use(express.json({ limit: '25mb' }));

// --- Authentication -------------------------------------------------------
// Auth endpoints are registered first so they stay reachable while signed out.
// Everything after this line requires a valid session, including /uploads —
// photos of where you eat are personal data, not public files.
mountAuthRoutes(app);
app.use('/api', requireAuth);
app.use('/uploads', requireAuth);

/* ------------------------------------------------------------------ helpers */

const PLACE_COLUMNS = {
  provider: 'provider',
  providerPlaceId: 'provider_place_id',
  name: 'name',
  address: 'address',
  website: 'website',
  phone: 'phone',
  lat: 'lat',
  lng: 'lng',
  mapsUrl: 'maps_url',
  googleRating: 'google_rating',
  priceLevel: 'price_level',
  visitDate: 'visit_date',
  wouldReturn: 'would_return',
  rating: 'rating',
  crust: 'crust',
  sauce: 'sauce',
  cheese: 'cheese',
  value: 'value',
  notes: 'notes',
};

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function rowToPlace(row) {
  return {
    id: row.id,
    provider: row.provider,
    providerPlaceId: row.provider_place_id,
    name: row.name,
    address: row.address,
    website: row.website,
    phone: row.phone,
    lat: row.lat,
    lng: row.lng,
    mapsUrl: row.maps_url,
    googleRating: row.google_rating,
    userRatingCount: row.user_rating_count,
    priceLevel: row.price_level,
    summary: row.summary,
    summarySource: row.summary_source,
    primaryType: row.primary_type,
    logoUrl: row.logo_filename ? `/uploads/${row.logo_filename}` : null,
    coverUrl: row.cover_filename ? `/uploads/${row.cover_filename}` : null,
    coverAttribution: row.cover_attribution,
    enrichedAt: row.enriched_at,
    visitDate: row.visit_date,
    wouldReturn: row.would_return === null ? null : Boolean(row.would_return),
    rating: row.rating,
    crust: row.crust,
    sauce: row.sauce,
    cheese: row.cheese,
    value: row.value,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photos: listPhotos(row.id),
  };
}

function listPhotos(placeId) {
  return db
    .prepare('SELECT * FROM photos WHERE place_id = ? ORDER BY id')
    .all(placeId)
    .map((photo) => ({
      id: photo.id,
      url: `/uploads/${photo.filename}`,
      caption: photo.caption,
      createdAt: photo.created_at,
    }));
}

function getPlace(id) {
  const row = db.prepare('SELECT * FROM places WHERE id = ?').get(id);
  return row ? rowToPlace(row) : null;
}

/**
 * Runs a Google enrichment pass for a saved place and writes the result.
 * Never throws — a place that can't be enriched is still a usable entry.
 */
async function enrichAndStore(placeId) {
  const row = db.prepare('SELECT * FROM places WHERE id = ?').get(placeId);
  if (!row) return [];

  let result;
  try {
    result = await enrichPlace({
      provider: row.provider,
      providerPlaceId: row.provider_place_id,
      name: row.name,
      address: row.address,
      website: row.website,
    });
  } catch (error) {
    console.error('Enrichment failed:', error);
    return [error.message];
  }

  const { fields, warnings } = result;

  // A place matched to Google for the first time gets re-pointed at that ID, so
  // later refreshes skip the lookup. Skipped when another row already holds it,
  // which would trip the unique index.
  const resolvedId = fields.resolvedGooglePlaceId;
  delete fields.resolvedGooglePlaceId;

  if (resolvedId) {
    const conflict = db
      .prepare('SELECT id FROM places WHERE provider = ? AND provider_place_id = ? AND id != ?')
      .get('google', resolvedId, placeId);
    if (conflict) {
      warnings.push(`Already linked to Google by another entry (#${conflict.id}); details still updated.`);
    } else {
      fields.provider = 'google';
      fields.provider_place_id = resolvedId;
    }
  }

  const assignments = [];
  const values = [];
  for (const [column, value] of Object.entries(fields)) {
    assignments.push(`${column} = ?`);
    values.push(value);
  }

  if (assignments.length > 0) {
    assignments.push('updated_at = ?');
    values.push(nowIso(), placeId);
    db.prepare(`UPDATE places SET ${assignments.join(', ')} WHERE id = ?`).run(...values);
  }

  // Drop the images this pass replaced so refreshes don't leak files.
  removeUploads(
    fields.cover_filename && row.cover_filename !== fields.cover_filename ? row.cover_filename : null,
    fields.logo_filename && row.logo_filename !== fields.logo_filename ? row.logo_filename : null,
  );

  return warnings;
}

function clampNumber(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(max, Math.max(min, num));
}

/** Normalizes and validates a partial place payload into DB-ready values. */
function normalizePlaceInput(body, { requireName }) {
  const out = {};

  if ('name' in body || requireName) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      const error = new Error('A name is required.');
      error.status = 400;
      throw error;
    }
    out.name = name;
  }

  for (const key of ['address', 'website', 'phone', 'mapsUrl', 'notes', 'priceLevel', 'providerPlaceId']) {
    if (key in body) {
      const value = typeof body[key] === 'string' ? body[key].trim() : null;
      out[key] = value || null;
    }
  }

  if ('provider' in body) {
    out.provider = ['google', 'demo', 'manual'].includes(body.provider) ? body.provider : 'manual';
  }

  for (const key of ['lat', 'lng']) {
    if (key in body) out[key] = body[key] === null ? null : clampNumber(body[key], -180, 180);
  }

  if ('googleRating' in body) out.googleRating = clampNumber(body.googleRating, 0, 5);
  if ('rating' in body) out.rating = clampNumber(body.rating, 0, 5);

  for (const key of ['crust', 'sauce', 'cheese', 'value']) {
    if (key in body) out[key] = clampNumber(body[key], 0, 10);
  }

  if ('visitDate' in body) {
    const raw = typeof body.visitDate === 'string' ? body.visitDate.trim() : '';
    // Stored as a plain YYYY-MM-DD string to stay timezone-free.
    out.visitDate = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  }

  if ('wouldReturn' in body) {
    out.wouldReturn =
      body.wouldReturn === null || body.wouldReturn === undefined ? null : body.wouldReturn ? 1 : 0;
  }

  return out;
}

/* ------------------------------------------------------------------- routes */

app.get('/api/config', (req, res) => {
  res.json({ provider: activeProvider(), googleConfigured: hasGoogleKey() });
});

app.get(
  '/api/search',
  asyncRoute(async (req, res) => {
    const { provider, results } = await searchPlaces({
      query: String(req.query.q ?? ''),
      near: String(req.query.near ?? ''),
    });

    // Flag anything already in the collection so the UI can say "Saved".
    const saved = db.prepare('SELECT id, provider_place_id FROM places WHERE provider_place_id IS NOT NULL').all();
    const savedById = new Map(saved.map((row) => [row.provider_place_id, row.id]));

    res.json({
      provider,
      results: results.map((result) => ({
        ...result,
        savedPlaceId: savedById.get(result.providerPlaceId) ?? null,
      })),
    });
  }),
);

app.get('/api/places', (req, res) => {
  const rows = db.prepare('SELECT * FROM places ORDER BY datetime(created_at) DESC').all();
  res.json(rows.map(rowToPlace));
});

app.get('/api/places/:id', (req, res) => {
  const place = getPlace(Number(req.params.id));
  if (!place) return res.status(404).json({ error: 'Place not found.' });
  res.json(place);
});

app.post(
  '/api/places',
  asyncRoute(async (req, res) => {
    const input = normalizePlaceInput(req.body ?? {}, { requireName: true });

    // Re-adding a place from search returns the existing entry rather than
    // creating a duplicate or clobbering ratings already written.
    if (input.providerPlaceId && input.provider && input.provider !== 'manual') {
      const existing = db
        .prepare('SELECT * FROM places WHERE provider = ? AND provider_place_id = ?')
        .get(input.provider, input.providerPlaceId);
      if (existing) {
        return res.status(200).json({ place: rowToPlace(existing), alreadySaved: true });
      }
    }

    const timestamp = nowIso();
    const columns = ['created_at', 'updated_at'];
    const values = [timestamp, timestamp];

    for (const [key, column] of Object.entries(PLACE_COLUMNS)) {
      if (key in input) {
        columns.push(column);
        values.push(input[key]);
      }
    }

    const placeholders = columns.map(() => '?').join(', ');
    const result = db
      .prepare(`INSERT INTO places (${columns.join(', ')}) VALUES (${placeholders})`)
      .run(...values);

    const placeId = Number(result.lastInsertRowid);
    // Manual entries can opt out, so a truly unlisted place doesn't get matched
    // to whatever Google considers the nearest thing by that name.
    const warnings = req.body?.skipEnrichment === true ? [] : await enrichAndStore(placeId);

    res.status(201).json({ place: getPlace(placeId), alreadySaved: false, warnings });
  }),
);

/** Re-pulls the synopsis, rating, cover photo and logo from Google. */
app.post(
  '/api/places/:id/refresh',
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!getPlace(id)) return res.status(404).json({ error: 'Place not found.' });

    const warnings = await enrichAndStore(id);
    res.json({ place: getPlace(id), warnings });
  }),
);

app.patch('/api/places/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getPlace(id)) return res.status(404).json({ error: 'Place not found.' });

  const input = normalizePlaceInput(req.body ?? {}, { requireName: false });
  const assignments = [];
  const values = [];

  for (const [key, column] of Object.entries(PLACE_COLUMNS)) {
    if (key in input) {
      assignments.push(`${column} = ?`);
      values.push(input[key]);
    }
  }

  if (assignments.length > 0) {
    assignments.push('updated_at = ?');
    values.push(nowIso(), id);
    db.prepare(`UPDATE places SET ${assignments.join(', ')} WHERE id = ?`).run(...values);
  }

  res.json(getPlace(id));
});

app.delete('/api/places/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM places WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Place not found.' });

  const files = db.prepare('SELECT filename FROM photos WHERE place_id = ?').all(id);
  db.prepare('DELETE FROM places WHERE id = ?').run(id);

  for (const { filename } of files) {
    fs.rmSync(path.join(uploadsDir, filename), { force: true });
  }
  removeUploads(row.cover_filename, row.logo_filename);

  res.json({ deleted: id });
});

/* -------------------------------------------------------------------- photos */

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
};

app.post('/api/places/:id/photos', (req, res) => {
  const placeId = Number(req.params.id);
  if (!getPlace(placeId)) return res.status(404).json({ error: 'Place not found.' });

  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(req.body?.dataUrl ?? '');
  if (!match) return res.status(400).json({ error: 'Expected an image as a base64 data URL.' });

  const [, mime, base64] = match;
  const extension = MIME_EXTENSIONS[mime.toLowerCase()];
  if (!extension) {
    return res.status(415).json({ error: `Unsupported image type: ${mime}` });
  }

  const filename = `${crypto.randomUUID()}${extension}`;
  fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(base64, 'base64'));

  const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim() || null : null;
  db.prepare('INSERT INTO photos (place_id, filename, caption, created_at) VALUES (?, ?, ?, ?)').run(
    placeId,
    filename,
    caption,
    nowIso(),
  );
  db.prepare('UPDATE places SET updated_at = ? WHERE id = ?').run(nowIso(), placeId);

  res.status(201).json(getPlace(placeId));
});

app.delete('/api/photos/:id', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
  if (!photo) return res.status(404).json({ error: 'Photo not found.' });

  db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
  fs.rmSync(path.join(uploadsDir, photo.filename), { force: true });

  res.json(getPlace(photo.place_id));
});

/* -------------------------------------------------------------------- backup */

app.get('/api/export', (req, res) => {
  const places = db.prepare('SELECT * FROM places ORDER BY id').all().map(rowToPlace);
  res.setHeader('Content-Disposition', `attachment; filename="pizza-tracker-${nowIso().slice(0, 10)}.json"`);
  res.json({ exportedAt: nowIso(), version: 1, places });
});

/* ------------------------------------------------------- static + errors */

app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback for anything that isn't an API or upload path.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));

app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong.', hint: err.hint });
});

app.listen(PORT, HOST, () => {
  const mode = hasGoogleKey() ? 'Google Places' : 'demo data (no GOOGLE_MAPS_API_KEY set)';
  console.log(`Pizza Tracker on http://${HOST}:${PORT} — search: ${mode}`);

  if (!isConfigured()) {
    console.log('\n  ⚠  No login password set. The app will show a setup notice until you run:');
    console.log('       npm run set-password\n');
  }
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    console.log(`  ⚠  Listening on ${HOST} — make sure TLS terminates in front of this process.`);
  }
  if (!fs.existsSync(clientDist)) {
    console.log('Client not built yet. Use `npm run dev`, or `npm run build && npm start`.');
  }
});
