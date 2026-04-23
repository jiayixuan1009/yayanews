// Thin re-export. The real implementation lives in @yayanews/sanitize so
// apps/web and apps/admin share one allow-list and one DOMPurify config.
export { sanitizeHtml } from '@yayanews/sanitize';
