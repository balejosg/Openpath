import path from 'node:path';

import type { ErrorRequestHandler } from 'express';

interface SyntaxErrorWithBody extends SyntaxError {
  body?: unknown;
  status?: number;
}

export function getReactSpaPath(currentDirname: string): string {
  const isCompiledCode = currentDirname.includes('/dist');
  return isCompiledCode
    ? path.join(currentDirname, '../../../react-spa/dist')
    : path.join(currentDirname, '../../react-spa/dist');
}

export function shouldBypassCompression(requestPath: string): boolean {
  return requestPath === '/api/machines/events';
}

export function shouldServeSpaFallback(url: string): boolean {
  return !(url.startsWith('/api') || url.startsWith('/trpc') || url.startsWith('/api-docs'));
}

export function createJsonSyntaxErrorHandler(): ErrorRequestHandler {
  return (err, _req, res, next) => {
    if (
      err instanceof SyntaxError &&
      (err as SyntaxErrorWithBody).status === 400 &&
      'body' in err
    ) {
      res.status(400).json({
        success: false,
        error: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
      });
      return;
    }

    next(err);
  };
}
