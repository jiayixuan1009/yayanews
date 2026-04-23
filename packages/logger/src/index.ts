import pino, { type Logger, type LoggerOptions } from 'pino';

/**
 * Shared structured logger for YayaNews Node services.
 *
 * First-principles purpose: provide a single consistent JSON log schema so
 * the T0–T5 latency chain defined in PRD §0 can be measured. Every log line
 * carries `service`, `env`, ISO timestamp and level so downstream log
 * collectors (e.g. PM2 log rotation → Loki / Vector) can aggregate by
 * service without regex gymnastics.
 *
 * Usage:
 *   import { createLogger } from '@yayanews/logger';
 *   const log = createLogger('ws-server');
 *   log.info({ stage_ms: 42 }, 'broadcast delivered');
 */
export interface CreateLoggerOptions {
  /** Override log level. Defaults to env LOG_LEVEL or 'info'. */
  level?: LoggerOptions['level'];
  /** Extra default bindings attached to every log line. */
  bindings?: Record<string, unknown>;
}

export function createLogger(service: string, opts: CreateLoggerOptions = {}): Logger {
  const env = process.env.NODE_ENV || 'development';
  const level = opts.level || process.env.LOG_LEVEL || (env === 'production' ? 'info' : 'debug');

  return pino({
    level,
    base: {
      service,
      env,
      ...(opts.bindings || {}),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Redact common secret-bearing keys so accidental logs do not leak them.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        'token',
        '*.password',
        '*.token',
        '*.authorization',
      ],
      remove: true,
    },
  });
}

export type { Logger } from 'pino';
