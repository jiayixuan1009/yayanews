/**
 * Server-side guard for article view counts: one counted view per client IP and article
 * per window. The browser beacon already dedupes per session, but the endpoint is public,
 * and view_count drives "popular" lists and which articles the pipeline translates
 * (TRANSLATION_MIN_VIEWS), so scripted repeats must not count.
 *
 * In memory, per web process: production runs a single `yayanews` process, and a restart
 * only forgets recent views (a few may count twice), which is acceptable for a counter.
 */
const WINDOW_MS = 30 * 60_000;
const MAX_ENTRIES = 50_000;

const seen = new Map<string, number>();

/** Client IP as forwarded by nginx (X-Real-IP is the Cloudflare-restored visitor address). */
export function clientIp(headers: Headers): string | null {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || null;
}

/** True when this view should be counted; false for a repeat inside the window. */
export function shouldCountView(ip: string | null, articleId: number, now = Date.now()): boolean {
  // Without an IP (direct local calls) there is nothing to dedupe on; count as before.
  if (!ip) return true;
  const key = `${ip}|${articleId}`;
  const last = seen.get(key);
  if (last !== undefined && now - last < WINDOW_MS) return false;
  seen.delete(key); // re-insert so Map order stays oldest-first
  seen.set(key, now);
  while (seen.size > MAX_ENTRIES) {
    const oldest = seen.keys().next().value;
    if (oldest === undefined) break;
    seen.delete(oldest);
  }
  return true;
}

/** Test hook. */
export function resetViewDedupe(): void {
  seen.clear();
}
