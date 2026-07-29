import { DEMO_PLACES } from './demo-data.js';

const GOOGLE_SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';

// Only the fields we actually store — Google bills Text Search by field tier,
// so requesting less keeps the cost in the cheaper tiers.
const GOOGLE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.googleMapsUri',
].join(',');

export function hasGoogleKey() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

export function activeProvider() {
  return hasGoogleKey() ? 'google' : 'demo';
}

/**
 * Search for pizza places. Uses Google Places when a key is configured and
 * falls back to the bundled demo dataset otherwise, so the app is always usable.
 *
 * @returns {Promise<{ provider: 'google' | 'demo', results: object[] }>}
 */
export async function searchPlaces({ query, near }) {
  const trimmed = (query ?? '').trim();
  if (!trimmed) return { provider: activeProvider(), results: [] };

  if (hasGoogleKey()) {
    return { provider: 'google', results: await searchGoogle(trimmed, near) };
  }
  return { provider: 'demo', results: searchDemo(trimmed, near) };
}

async function searchGoogle(query, near) {
  // Bias toward pizza even when the user types only a shop name, and fold the
  // optional "near" box into the text query (Text Search understands it).
  const textQuery = [/pizza|pizzeria|apizza/i.test(query) ? query : `${query} pizza`, near?.trim()]
    .filter(Boolean)
    .join(' near ');

  const response = await fetch(GOOGLE_SEARCH_TEXT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY.trim(),
      'X-Goog-FieldMask': GOOGLE_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      includedType: 'pizza_restaurant',
      maxResultCount: 20,
      languageCode: 'en',
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = payload?.error?.message || `HTTP ${response.status}`;
    const error = new Error(`Google Places request failed: ${detail}`);
    error.status = response.status === 400 || response.status === 403 ? 502 : 502;
    error.hint =
      response.status === 403
        ? 'Check that the Places API (New) is enabled for this key and that any key restrictions allow requests from this server.'
        : undefined;
    throw error;
  }

  return (payload.places ?? []).map((place) => ({
    provider: 'google',
    providerPlaceId: place.id,
    name: place.displayName?.text ?? 'Unnamed place',
    address: place.formattedAddress ?? null,
    website: place.websiteUri ?? null,
    phone: place.nationalPhoneNumber ?? null,
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    mapsUrl: place.googleMapsUri ?? null,
    googleRating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    priceLevel: place.priceLevel ?? null,
  }));
}

function searchDemo(query, near) {
  const terms = `${query} ${near ?? ''}`
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((term) => term.length > 1 && term !== 'pizza' && term !== 'near');

  const scored = DEMO_PLACES.map((place) => {
    const haystack = [place.name, place.address, ...place.tags].join(' ').toLowerCase();
    // Every term must appear somewhere; name matches rank above tag matches.
    const matchesAll = terms.every((term) => haystack.includes(term));
    if (!matchesAll) return null;

    const nameHits = terms.filter((term) => place.name.toLowerCase().includes(term)).length;
    return { place, score: nameHits * 10 + place.rating };
  }).filter(Boolean);

  // A bare "pizza" search (no distinguishing terms) should still show something.
  const matches = terms.length === 0
    ? DEMO_PLACES.map((place) => ({ place, score: place.rating }))
    : scored;

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ place }) => ({
      provider: 'demo',
      providerPlaceId: place.id,
      name: place.name,
      address: place.address,
      website: place.website,
      phone: place.phone,
      lat: place.lat,
      lng: place.lng,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${place.name} ${place.address}`,
      )}`,
      googleRating: place.rating,
      userRatingCount: null,
      priceLevel: place.priceLevel,
    }));
}
