import { createLogger } from '@yayanews/logger';

/**
 * Shared logger for apps/web. Use instead of `console.*` so every line
 * ends up as structured JSON with `service=web`, level, ISO timestamp.
 *
 * Attach route-specific context with `log.child({ route: '/api/x' })`.
 */
export const log = createLogger('web');
