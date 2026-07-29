import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { uploadsDir, nowIso } from '../db.js';
import { fetchLogo } from './logo.js';
import { hasGoogleKey } from './index.js';

// Requested once per *saved* place rather than per search result — the
// summary/rating fields sit in Google's priciest SKU tier, so enriching on save
// keeps a 20-result search from billing at that rate.
const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'websiteUri',
  'nationalPhoneNumber',
  'location',
  'googleMapsUri',
  'rating',
  'userRatingCount',
  'priceLevel',
  'editorialSummary',
  'generativeSummary',
  'primaryTypeDisplayName',
  'photos',
].join(',');

const PHOTO_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

function writeUpload(buffer, extension) {
  const filename = `${crypto.randomUUID()}${extension}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return filename;
}

/**
 * Finds the Google place ID for an entry saved before a key was configured
 * (or added by hand). Uses the ID-only field mask, which is Google's free tier.
 *
 * @returns {Promise<string | null>}
 */
async function resolveGooglePlaceId(name, address) {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY.trim(),
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify({
      textQuery: [name, address].filter(Boolean).join(' '),
      maxResultCount: 1,
      languageCode: 'en',
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  return payload.places?.[0]?.id ?? null;
}

async function fetchPlaceDetails(placeId) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY.trim(),
      'X-Goog-FieldMask': DETAILS_FIELD_MASK,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? `Place Details failed (HTTP ${response.status})`);
  }
  return response.json();
}

async function fetchPlacePhoto(photoName) {
  const url =
    `https://places.googleapis.com/v1/${photoName}/media` +
    `?maxHeightPx=800&maxWidthPx=1200&key=${encodeURIComponent(process.env.GOOGLE_MAPS_API_KEY.trim())}`;

  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) return null;

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const extension = PHOTO_TYPES[contentType];
  if (!extension) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.length > 500 ? { buffer, extension } : null;
}

/**
 * Pulls the synopsis, rating, cover photo and logo for a saved place.
 *
 * Every step is best-effort: a place that has no editorial summary, no photo or
 * an unreachable website still saves fine, just with fewer fields filled in.
 *
 * @returns {Promise<{ fields: object, warnings: string[] }>} DB-ready column values.
 */
export async function enrichPlace({ provider, providerPlaceId, name, address, website }) {
  const fields = { enriched_at: nowIso() };
  const warnings = [];

  // --- Google details -------------------------------------------------------
  let details = null;
  if (hasGoogleKey()) {
    let googleId = provider === 'google' ? providerPlaceId : null;

    // Entries saved from demo search or added by hand have no Google ID yet —
    // look one up by name and address so they can be enriched too.
    if (!googleId) {
      try {
        googleId = await resolveGooglePlaceId(name, address);
        if (googleId) {
          fields.resolvedGooglePlaceId = googleId;
        } else {
          warnings.push('No Google match found for this place.');
        }
      } catch (error) {
        warnings.push(`Google lookup: ${error.message}`);
      }
    }

    if (googleId) {
      try {
        details = await fetchPlaceDetails(googleId);
      } catch (error) {
        warnings.push(`Google details: ${error.message}`);
      }
    }
  }

  if (details) {
    const editorial = details.editorialSummary?.text?.trim();
    const generative = details.generativeSummary?.overview?.text?.trim();

    // Prefer Google's editorial blurb; it's tighter and human-written. Fall
    // back to the generated overview so most places get *something*.
    if (editorial) {
      fields.summary = editorial;
      fields.summary_source = 'editorial';
    } else if (generative) {
      fields.summary = generative;
      fields.summary_source = 'generative';
    }

    if (details.primaryTypeDisplayName?.text) fields.primary_type = details.primaryTypeDisplayName.text;
    if (typeof details.rating === 'number') fields.google_rating = details.rating;
    if (typeof details.userRatingCount === 'number') fields.user_rating_count = details.userRatingCount;
    if (details.priceLevel) fields.price_level = details.priceLevel;
    if (details.websiteUri) fields.website = details.websiteUri;
    if (details.googleMapsUri) fields.maps_url = details.googleMapsUri;
    if (details.nationalPhoneNumber) fields.phone = details.nationalPhoneNumber;
    if (details.formattedAddress) fields.address = details.formattedAddress;

    const photo = details.photos?.[0];
    if (photo?.name) {
      try {
        const image = await fetchPlacePhoto(photo.name);
        if (image) {
          fields.cover_filename = writeUpload(image.buffer, image.extension);
          // Google's terms require attributing Place Photos to their author.
          fields.cover_attribution = photo.authorAttributions?.[0]?.displayName ?? 'Google user';
        }
      } catch (error) {
        warnings.push(`Cover photo: ${error.message}`);
      }
    }
  }

  // --- Logo from the restaurant's own website -------------------------------
  const logoSite = fields.website ?? website;
  if (logoSite) {
    try {
      const logo = await fetchLogo(logoSite);
      if (logo) {
        fields.logo_filename = writeUpload(logo.buffer, logo.extension);
        fields.logo_source = logo.source;
      }
    } catch (error) {
      warnings.push(`Logo: ${error.message}`);
    }
  }

  return { fields, warnings };
}

/** Removes image files an enrichment pass is about to replace. */
export function removeUploads(...filenames) {
  for (const filename of filenames) {
    if (filename) fs.rmSync(path.join(uploadsDir, filename), { force: true });
  }
}
