/**
 * Server-side reporting for failures the client is never told about.
 *
 * Route handlers answer with a generic message on purpose, so a failure cannot
 * leak a filesystem path or a stack frame into the browser. Without a log on this
 * side the real cause — a permission error, a full disk, unparseable YAML — is
 * discarded with the caught value, and the only trace left is a 500 that explains
 * nothing.
 */

/** Report a caught route failure with the operation that failed and its cause. */
export function logRouteError(operation: string, error: unknown): void {
  console.error(`marga: ${operation} failed`, error instanceof Error ? error : { thrown: error });
}
