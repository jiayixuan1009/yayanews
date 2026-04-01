/** Strip HTML tags and decode common HTML entities from a string for safe plain-text display */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')           // remove all HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')            // collapse multiple spaces
    .trim();
}

export function getImportanceDot(importance: string): string {
  switch (importance) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-amber-500';
    default: return 'bg-primary-500';
  }
}

export const CATEGORY_COLORS: Record<string, string> = {
  'us-stock': 'bg-blue-500/20 text-blue-400',
  'crypto': 'bg-amber-500/20 text-amber-400',
  'derivatives': 'bg-emerald-500/20 text-emerald-400',
  'hk-stock': 'bg-rose-500/20 text-rose-400',
};

export const CATEGORY_DOT_COLORS: Record<string, string> = {
  'us-stock': 'bg-blue-500',
  'crypto': 'bg-amber-500',
  'derivatives': 'bg-emerald-500',
  'hk-stock': 'bg-rose-500',
};

/** Convert a flash title to a URL-safe segment */
function titleToSlug(title: string): string {
  return title
    // keep ASCII alphanumeric, CJK unified, Hiragana, Katakana, Hangul, Latin extended
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u00c0-\u024f\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/, '');
}

/**
 * Encode a flash item into an SEO-friendly slug.
 * New format: {title-slug}-{id}   e.g. "bitcoin-hits-100k-20246"
 * Legacy fallback: yyyymmddhh + 4-digit id (pure numeric)
 */
export function encodeFlashSlug(flash: { id: number; title?: string; published_at?: string; created_at?: string }): string {
  if (flash.title) {
    const slug = titleToSlug(flash.title);
    if (slug) return `${slug}-${flash.id}`;
  }
  // Legacy fallback
  const fallback = '0000000000';
  const dtStr = flash.published_at || flash.created_at || '';
  let cleaned = dtStr.replace(/[-T:Z.\s]/g, '');
  if (cleaned.length < 10) cleaned = fallback;
  const yyyymmddhh = cleaned.slice(0, 10);
  const paddedId = String(flash?.id || 0).padStart(4, '0');
  return `${yyyymmddhh}${paddedId}`;
}

/**
 * Decode a flash slug back to its numeric ID.
 * Handles both:
 *   - New: "bitcoin-hits-100k-20246"  → 20246
 *   - Old: "2026033115200123"         → 123  (last 4 digits)
 */
export function decodeFlashSlug(slug: string): number {
  if (!slug) return 0;
  // Old pure-numeric 14-digit format
  if (slug.length >= 14 && /^\d+$/.test(slug)) {
    return parseInt(slug.slice(10), 10);
  }
  // New format: last segment after final dash is the ID
  const parts = slug.split('-');
  const last = parts[parts.length - 1];
  const id = parseInt(last, 10);
  if (!isNaN(id) && id > 0) return id;
  return parseInt(slug, 10);
}
