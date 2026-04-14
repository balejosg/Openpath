import type { Express, Request, Response } from 'express';

import { buildWhitelistEtag, matchesIfNoneMatch } from '../lib/server-assets.js';
import CoreService from '../services/core.service.js';
import { createAsyncRouteHandler, sendTextInternalError } from './route-helpers.js';

export function registerCoreRoutes(app: Express): void {
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'openpath-api' });
  });

  app.get('/api/config', (_req, res) => {
    res.json(CoreService.getPublicClientConfig());
  });

  app.get('/export/:name.txt', (req: Request, res: Response): void => {
    const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    if (!name) {
      res.status(400).type('text/plain').send('Group name required');
      return;
    }

    createAsyncRouteHandler(
      'Public export route failed',
      sendTextInternalError,
      async (_req: Request, response: Response): Promise<void> => {
        const result = await CoreService.getPublicGroupExportResource(name);
        if (!result.ok) {
          response
            .status(result.error.code === 'NOT_FOUND' ? 404 : 500)
            .type('text/plain')
            .send(result.error.message);
          return;
        }

        const resource = result.data;
        const etag = buildWhitelistEtag({
          groupId: resource.groupId,
          updatedAt: resource.groupUpdatedAt,
          enabled: resource.enabled,
        });
        response.setHeader('ETag', etag);
        response.setHeader('Cache-Control', 'no-cache');
        if (matchesIfNoneMatch(req, etag)) {
          response.status(304).end();
          return;
        }

        response.type('text/plain').send(resource.content);
      }
    )(req, res);
  });
}
