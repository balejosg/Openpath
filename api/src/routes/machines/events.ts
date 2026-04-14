import type { Express, Request, Response } from 'express';

import { openMachineEventsStream } from '../../services/machine-events.service.js';
import { createRouteHandler, sendJsonInternalError, sendMachineServiceError } from './helpers.js';

export function registerMachineEventRoutes(app: Express): void {
  app.get(
    '/api/machines/events',
    createRouteHandler(
      'SSE endpoint error',
      sendJsonInternalError,
      async (req: Request, res: Response): Promise<void> => {
        const connection = await openMachineEventsStream({
          authorizationHeader: req.headers.authorization,
          queryToken: typeof req.query.token === 'string' ? req.query.token : undefined,
          stream: res,
        });
        if (!connection.ok) {
          sendMachineServiceError(res, connection.error);
          return;
        }

        req.on('close', () => {
          connection.data.disconnect();
        });
      }
    )
  );
}
