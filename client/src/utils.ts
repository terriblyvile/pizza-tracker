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

export function mapsLink(place: Pick<Place, 'name' | 'address' | 'mapsUrl'>): string {
  if (place.mapsUrl) return place.mapsUrl;
  const query = [place.name, place.address].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
