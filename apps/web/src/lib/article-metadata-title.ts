const EDITORIAL_SUFFIX_RE = /(?:市场观察|市场快讯|新闻快讯|频道|专栏|日报|周报|yayanews|鸭鸭财经(?:新闻)?)/i;

export function stripEditorialTitleSuffix(title: string): string {
  const parts = title.split(/[|｜]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return title.trim();

  const suffix = parts.at(-1) || '';
  if (!EDITORIAL_SUFFIX_RE.test(suffix)) return title.trim();
  return parts.slice(0, -1).join(' | ').trim() || title.trim();
}

export function articleMetadataTitle(title: string, lang: string): string {
  const normalized = stripEditorialTitleSuffix(title);
  const maxLength = lang === 'en' ? 95 : 60;
  const chars = Array.from(normalized);
  if (chars.length <= maxLength) return normalized;

  const sliced = chars.slice(0, maxLength - 1).join('');
  // For latin/English text (contains spaces) cut back to the last whitespace so
  // the title never ends mid-word; CJK text has no spaces so slice by character.
  const trimmed = /\s/.test(sliced)
    ? sliced.replace(/\s+\S*$/, '').trim()
    : sliced.trim();
  return `${trimmed || sliced.trim()}…`;
}
