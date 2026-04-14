import type express from 'express';
import type { NextFunction, Request, Response } from 'express';

import { logger } from './lib/logger.js';
import { getTRPCErrorCode, getTRPCErrorMessage, getTRPCErrorStatus, isTRPCError } from './trpc.js';

export function registerErrorHandlers(app: express.Express): void {
  app.use((_req: Request, res: Response): void => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (isTRPCError(err)) {
      const status = getTRPCErrorStatus(err);
      const message = getTRPCErrorMessage(err);
      logger.error('tRPC error', { code: getTRPCErrorCode(err), message });
      res.status(status).json({ error: message });
      return;
    }

    logger.error('Unhandled error', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Error interno del servidor' });
  });
}
