import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const dataDir = path.join(rootDir, 'data');
export const uploadsDir = path.join(dataDir, 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'pizza.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS places (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Where the record came from: 'google', 'demo', or 'manual'
    provider          TEXT    NOT NULL DEFAULT 'manual',
    provider_place_id TEXT,

    name              TEXT    NOT NULL,
    address           TEXT,
    website           TEXT,
    phone             TEXT,
    lat               REAL,
    lng               REAL,
    maps_url          TEXT,
    google_rating     REAL,
    user_rating_count INTEGER,
    price_level       TEXT,

    -- Pulled from Google on save (see server/places/enrich.js)
    summary           TEXT,
    summary_source    TEXT,
    primary_type      TEXT,
    logo_filename     TEXT,
    logo_source       TEXT,
    cover_filename    TEXT,
    cover_attribution TEXT,
    enriched_at       TEXT,

    visit_date        TEXT,
    would_return      INTEGER,
    rating            REAL,
    crust             REAL,
    sauce             REAL,
    cheese            REAL,
    value             REAL,
    notes             TEXT,

    created_at        TEXT    NOT NULL,
    updated_at        TEXT    NOT NULL
  );

  -- One saved entry per external place, so re-adding from search updates in place.
  CREATE UNIQUE INDEX IF NOT EXISTS places_provider_place_id
    ON places (provider, provider_place_id)
    WHERE provider_place_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS photos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id   INTEGER NOT NULL REFERENCES places (id) ON DELETE CASCADE,
    filename   TEXT    NOT NULL,
    caption    TEXT,
    created_at TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS photos_place_id ON photos (place_id);

  -- Login sessions. token_hash holds a SHA-256 of the cookie value, so a stolen
  -- database still can't be used to forge a live session.
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_agent  TEXT
  );

  CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions (expires_at);
`);

// Bring databases created before the Google-enrichment columns existed up to
// date. CREATE TABLE IF NOT EXISTS won't add columns to an existing table.
const existingColumns = new Set(
  db.prepare('PRAGMA table_info(places)').all().map((column) => column.name),
);

const ADDED_COLUMNS = {
  user_rating_count: 'INTEGER',
  summary: 'TEXT',
  summary_source: 'TEXT',
  primary_type: 'TEXT',
  logo_filename: 'TEXT',
  logo_source: 'TEXT',
  cover_filename: 'TEXT',
  cover_attribution: 'TEXT',
  enriched_at: 'TEXT',
};

for (const [column, type] of Object.entries(ADDED_COLUMNS)) {
  if (!existingColumns.has(column)) {
    db.exec(`ALTER TABLE places ADD COLUMN ${column} ${type}`);
  }
}

export function nowIso() {
  return new Date().toISOString();
}
