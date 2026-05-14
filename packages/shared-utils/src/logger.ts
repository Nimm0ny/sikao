// Thin logger facade. Today it wraps console; tomorrow it can route to
// Sentry / pino-compatible transport without changing call sites.
// Rationale: harness.md bans scattered `console.*` in business code
// and requires a single project logging surface.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  readonly [key: string]: unknown;
}

const envLevel = (import.meta.env.VITE_LOG_LEVEL ?? 'info') as LogLevel;
const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function shouldEmit(level: LogLevel): boolean {
  return order[level] >= order[envLevel];
}

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  if (!shouldEmit(level)) return;
  const payload = { t: new Date().toISOString(), level, msg, ...(ctx ?? {}) };
  // Routing to console is an implementation detail. Replace here later
  // with a remote transport (Sentry.captureMessage, pino.http, etc.).
  const line = JSON.stringify(payload);
  switch (level) {
    case 'debug':
    case 'info':
      window.console.log(line);
      break;
    case 'warn':
      window.console.warn(line);
      break;
    case 'error':
      window.console.error(line);
      break;
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit('error', msg, ctx),
};

export type Logger = typeof logger;
