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

export function encodeFlashSlug(flash: { id: number; published_at?: string; created_at?: string }): string {
  const fallback = '0000000000';
  const dtStr = flash.published_at || flash.created_at || '';
  let cleaned = dtStr.replace(/[-T:Z.\s]/g, '');
  if (cleaned.length < 10) cleaned = fallback;
  const yyyymmddhh = cleaned.slice(0, 10);
  const paddedId = String(flash?.id || 0).padStart(4, '0');
  return `${yyyymmddhh}${paddedId}`;
}

export function decodeFlashSlug(slug: string): number {
  if (!slug) return 0;
  if (slug.length >= 14 && /^\d+$/.test(slug)) {
    return parseInt(slug.slice(10), 10);
  }
  return parseInt(slug, 10);
}
