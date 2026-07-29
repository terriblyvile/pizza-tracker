/**
 * Best-effort restaurant logo lookup.
 *
 * Google Places has no business-logo field — `iconMaskBaseUri` is a generic
 * category pin, not the restaurant's mark — so the logo comes from the shop's
 * own website instead. Most restaurant sites point at their logo through
 * <link rel="apple-touch-icon"> or a high-res favicon, which is usually the
 * real mark rather than a generic glyph.
 */

const USER_AGENT = 'Mozilla/5.0 (compatible; PizzaTracker/1.0; +http://localhost)';
const HTML_BYTE_LIMIT = 400_000;
const MAX_IMAGE_BYTES = 3_000_000;

const IMAGE_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
};

/** Scores an icon candidate so the largest, most logo-like one wins. */
function scoreIcon({ rel, sizes, url }) {
  let score = 0;
  if (rel.includes('apple-touch-icon')) score += 100; // usually 180px+ and the real logo
  if (rel.includes('shortcut')) score += 10;

  const largest = Math.max(
    0,
    ...(sizes.match(/\d+/g) ?? []).map(Number).filter((n) => Number.isFinite(n)),
  );
  score += Math.min(largest, 512) / 4;

  if (/\.svg(\?|$)/i.test(url)) score += 40; // scales cleanly
  if (/logo/i.test(url)) score += 30;
  if (/\.ico(\?|$)/i.test(url)) score -= 20; // usually a tiny multi-res favicon

  return score;
}

function parseIconLinks(html, baseUrl) {
  const candidates = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = /\brel=["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase().trim() ?? '';
    if (!rel.split(/\s+/).some((token) => token === 'icon' || token.endsWith('-icon'))) continue;

    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || href.startsWith('data:')) continue;

    const sizes = /\bsizes=["']([^"']+)["']/i.exec(tag)?.[1] ?? '';
    try {
      candidates.push({ rel, sizes, url: new URL(href, baseUrl).href });
    } catch {
      // Malformed href — skip it.
    }
  }
  return candidates.sort((a, b) => scoreIcon(b) - scoreIcon(a));
}

async function downloadImage(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const extension = IMAGE_TYPES[contentType];
  if (!extension) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  // Reject empty or absurdly large responses, and 1x1 tracking pixels.
  if (buffer.length < 100 || buffer.length > MAX_IMAGE_BYTES) return null;

  return { buffer, extension };
}

/**
 * Finds and downloads a logo for a restaurant website.
 * @returns {Promise<{ buffer: Buffer, extension: string, source: string } | null>}
 */
export async function fetchLogo(websiteUrl) {
  if (!websiteUrl) return null;

  let origin;
  try {
    origin = new URL(websiteUrl);
    if (!/^https?:$/.test(origin.protocol)) return null;
  } catch {
    return null;
  }

  let candidates = [];
  try {
    const response = await fetch(origin.href, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const html = (await response.text()).slice(0, HTML_BYTE_LIMIT);
      candidates = parseIconLinks(html, response.url);
    }
  } catch {
    // Site unreachable or too slow — fall through to the favicon guess.
  }

  // Every site is supposed to serve /favicon.ico even without a <link> tag.
  candidates.push({ rel: 'fallback', sizes: '', url: new URL('/favicon.ico', origin).href });

  for (const candidate of candidates.slice(0, 4)) {
    try {
      const image = await downloadImage(candidate.url);
      if (image) return { ...image, source: candidate.url };
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}
