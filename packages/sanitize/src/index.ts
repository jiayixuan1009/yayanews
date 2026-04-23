import DOMPurify from 'isomorphic-dompurify';

/**
 * Shared HTML sanitizer configuration for article / topic / guide bodies
 * across apps/web (public render) and apps/admin (editor preview).
 *
 * Keep this list conservative. Anything that needs a broader allowlist
 * should be expressed as a separate exported function to keep the
 * default safe for unknown third-party content.
 */
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'a', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'figure', 'figcaption',
  'div', 'span', 'sup', 'sub',
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height',
  'class', 'id',
  'colspan', 'rowspan',
  'loading',
];

export function sanitizeHtml(dirty: string | null | undefined): string {
  return DOMPurify.sanitize(dirty ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
  });
}
