export interface SitemapUrlEntry {
  loc: string;
  lastmod?: Date | string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  alternates?: Record<string, string>;
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod?: Date | string;
}

export function escapeXml(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(value?: Date | string): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function buildSitemapIndex(entries: SitemapIndexEntry[]): string {
  const body = entries.map(entry => {
    const lastmod = formatDate(entry.lastmod);
    return `  <sitemap>
    <loc>${escapeXml(entry.loc)}</loc>
${lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>\n` : ''}  </sitemap>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}

export function buildUrlset(entries: SitemapUrlEntry[]): string {
  const hasAlternates = entries.some(entry => entry.alternates && Object.keys(entry.alternates).length > 0);
  const xmlns = hasAlternates
    ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"'
    : '';
  const body = entries.map(entry => {
    const lastmod = formatDate(entry.lastmod);
    const alternates = Object.entries(entry.alternates || {})
      .map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(lang)}" href="${escapeXml(href)}" />`)
      .join('\n');
    return `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
${alternates ? `${alternates}\n` : ''}${lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>\n` : ''}${entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>\n` : ''}${entry.priority != null ? `    <priority>${entry.priority}</priority>\n` : ''}  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xmlns}>
${body}
</urlset>`;
}
