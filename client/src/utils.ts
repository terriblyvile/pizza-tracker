import type { Place } from './types';

const PRICE_LABELS: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

export function priceLabel(priceLevel: string | null): string | null {
  return priceLevel ? (PRICE_LABELS[priceLevel] ?? null) : null;
}

/** Average of whichever sub-scores have been filled in, on the 0-10 scale. */
export function subScoreAverage(place: Place): number | null {
  const scores = [place.crust, place.sauce, place.cheese, place.value].filter(
    (score): score is number => typeof score === 'number',
  );
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function formatVisitDate(value: string | null): string | null {
  if (!value) return null;
  // Parse as local time; a bare YYYY-MM-DD would otherwise be read as UTC and
  // display as the previous day in western timezones.
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function hostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Apple Maps deep link. On iOS and macOS this opens the Maps app directly;
 * elsewhere maps.apple.com renders the same place in a browser.
 *
 * With coordinates, `q` becomes the pin's label rather than a search term,
 * which puts you on the exact spot instead of whatever the name matches.
 */
export function appleMapsLink(place: Pick<Place, 'name' | 'address' | 'lat' | 'lng'>): string {
  const params = new URLSearchParams();

  if (typeof place.lat === 'number' && typeof place.lng === 'number') {
    params.set('ll', `${place.lat},${place.lng}`);
    params.set('q', place.name);
  } else {
    params.set('q', [place.name, place.address].filter(Boolean).join(', '));
  }

  return `https://maps.apple.com/?${params.toString()}`;
}

/** `tel:` href, or null when there's no dialable number. */
export function telLink(phone: string | null): string | null {
  if (!phone) return null;
  // Keep digits and a leading +; strip the formatting humans read.
  const cleaned = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return cleaned.replace(/\D/g, '').length >= 5 ? `tel:${cleaned}` : null;
}

/**
 * Downscales an image in the browser before upload so a phone photo doesn't
 * arrive as a 12 MB payload. Returns a JPEG data URL.
 */
export async function fileToResizedDataUrl(file: File, maxDimension = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not read that image.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', 0.85);
}
