import type express from 'express';
import type { Request, Response } from 'express';

import { errorTrackingMiddleware } from './lib/error-tracking.js';
import { createJsonSyntaxErrorHandler } from './app-bootstrap-helpers.js';

export function registerAppErrorHandlers(app: express.Express): void {
  app.use(createJsonSyntaxErrorHandler());

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
      path: req.path,
    });
  });

  app.use(errorTrackingMiddleware);
}
