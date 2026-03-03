export type ReportErrorMeta = Record<string, unknown>;

/**
 * Centralized error reporting for the SPA.
 *
 * Today this just logs to console; future telemetry can be wired here.
 */
export function reportError(message: string, error: unknown, meta?: ReportErrorMeta): void {
  if (meta) {
    console.error(message, { error, meta });
    return;
  }

  console.error(message, { error });
}
