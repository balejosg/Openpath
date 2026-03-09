export type ReportErrorMeta = Record<string, unknown>;
export interface ReportErrorEvent {
  app: 'openpath-spa';
  message: string;
  route: string | null;
  action?: string;
  userRole?: string;
  meta: ReportErrorMeta;
  error: {
    name?: string;
    message: string;
    stack?: string;
    code?: string;
  };
  timestamp: string;
}

export type ReportErrorSink = (event: ReportErrorEvent) => void;

function defaultSink(event: ReportErrorEvent): void {
  console.error(event);
}

let reportErrorSink: ReportErrorSink = defaultSink;

function getRoute(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.pathname;
}

function normalizeError(error: unknown): ReportErrorEvent['error'] {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: typeof withCode.code === 'string' ? withCode.code : undefined,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: 'Unknown error' };
}

export function setReportErrorSink(sink: ReportErrorSink | null): void {
  reportErrorSink = sink ?? defaultSink;
}

/**
 * Centralized error reporting for the SPA.
 *
 * Delivery stays pluggable through setReportErrorSink().
 */
export function reportError(message: string, error: unknown, meta?: ReportErrorMeta): void {
  const safeMeta = meta ?? {};
  const action = typeof safeMeta.action === 'string' ? safeMeta.action : undefined;
  const userRole = typeof safeMeta.userRole === 'string' ? safeMeta.userRole : undefined;

  reportErrorSink({
    app: 'openpath-spa',
    message,
    route: getRoute(),
    action,
    userRole,
    meta: safeMeta,
    error: normalizeError(error),
    timestamp: new Date().toISOString(),
  });
}
