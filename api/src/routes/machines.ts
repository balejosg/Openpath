import type { Express, Request, Response } from 'express';

import { logger } from '../lib/logger.js';
import {
  authenticateEnrollmentToken,
  authenticateMachineToken,
  getFirstParam,
  validateMachineHostnameAccess,
} from '../lib/server-request-auth.js';
import {
  getLinuxAgentManifest,
  getLinuxAgentPackage,
  getWindowsAgentFile,
  getWindowsAgentManifest,
  getWindowsBootstrapFile,
  getWindowsBootstrapManifest,
} from '../services/machine-agent-delivery.service.js';
import { openMachineEventsStream } from '../services/machine-events.service.js';
import {
  registerMachineWithToken,
  rotateMachineDownloadToken,
} from '../services/machine-registration.service.js';
import {
  FAIL_OPEN_RESPONSE,
  resolveMachineWhitelist,
  type MachineWhitelistDelivery,
} from '../services/machine-policy.service.js';

function getWildcardPathParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value
      .map((segment) => segment.trim())
      .filter(Boolean)
      .join('/');
  }

  return value?.trim() ?? '';
}

function sendMachineServiceError(res: Response, error: { code: string; message: string }): void {
  const statusMap: Record<string, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    BAD_REQUEST: 400,
    UNAVAILABLE: 503,
  };
  res.status(statusMap[error.code] ?? 400).json({ success: false, error: error.message });
}

function sendJsonInternalError(res: Response, message = 'Internal error'): void {
  res.status(500).json({ success: false, error: message });
}

function sendWhitelistDelivery(res: Response, delivery: MachineWhitelistDelivery): void {
  res.setHeader('Cache-Control', delivery.cacheControl);
  if ('pragma' in delivery && delivery.pragma) {
    res.setHeader('Pragma', delivery.pragma);
  }
  if ('etag' in delivery && delivery.etag) {
    res.setHeader('ETag', delivery.etag);
  }

  if (delivery.kind === 'not-modified') {
    res.status(304).end();
    return;
  }

  res.type('text/plain').send(delivery.body);
}

function sendFailOpenWhitelist(res: Response): void {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.type('text/plain').send(FAIL_OPEN_RESPONSE);
}

function createRouteHandler(
  logMessage: string,
  onError: (res: Response) => void,
  handler: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response) => void {
  return (req: Request, res: Response): void => {
    void handler(req, res).catch((error: unknown) => {
      logger.error(logMessage, {
        error: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        onError(res);
      }
    });
  };
}

export function registerMachineRoutes(
  app: Express,
  deps: { getCurrentEvaluationTime: () => Date }
): void {
  app.post(
    '/api/machines/register',
    createRouteHandler(
      'Machine registration route failed',
      (res) => {
        sendJsonInternalError(res, 'Internal server error');
      },
      async (req: Request, res: Response): Promise<void> => {
        const { hostname, classroomName, classroomId, version } = req.body as {
          hostname?: string;
          classroomName?: string;
          classroomId?: string;
          version?: string;
        };

        const result = await registerMachineWithToken({
          authorizationHeader: req.headers.authorization,
          hostname,
          classroomName,
          classroomId,
          version,
        });
        if (!result.ok) {
          sendMachineServiceError(res, result.error);
          return;
        }

        res.json({
          success: true,
          machineHostname: result.data.machineHostname,
          reportedHostname: result.data.reportedHostname,
          whitelistUrl: result.data.whitelistUrl,
          classroomName: result.data.classroomName,
          classroomId: result.data.classroomId,
        });
      }
    )
  );

  app.post(
    '/api/machines/:hostname/rotate-download-token',
    createRouteHandler(
      'Rotate machine download token route failed',
      (res) => {
        sendJsonInternalError(res, 'Internal server error');
      },
      async (req: Request, res: Response): Promise<void> => {
        const machine = await authenticateMachineToken(req, res);
        if (!machine) {
          return;
        }

        const hostname = getFirstParam(req.params.hostname);
        if (!hostname) {
          res.status(400).json({ success: false, error: 'hostname parameter required' });
          return;
        }

        const hostnameAccess = validateMachineHostnameAccess(machine, hostname);
        if (!hostnameAccess.ok) {
          res
            .status(403)
            .json({ success: false, error: 'Machine token is not valid for this hostname' });
          return;
        }

        const result = await rotateMachineDownloadToken(machine.id);
        if (!result.ok) {
          sendMachineServiceError(res, result.error);
          return;
        }

        res.json({ success: true, whitelistUrl: result.data.whitelistUrl });
      }
    )
  );

  app.get(
    '/api/agent/windows/bootstrap/manifest',
    createRouteHandler(
      'Error serving Windows bootstrap manifest',
      sendJsonInternalError,
      async (req: Request, res: Response): Promise<void> => {
        const enrollment = await authenticateEnrollmentToken(req, res);
        if (!enrollment) {
          return;
        }

        const result = getWindowsBootstrapManifest(enrollment.classroomId);
        if (!result.ok) {
          sendMachineServiceError(res, result.error);
          return;
        }

        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.json({
          success: true,
          classroomId: result.data.classroomId,
          version: result.data.version,
          generatedAt: result.data.generatedAt,
          files: result.data.files,
        });
      }
    )
  );

  app.get(
    '/api/agent/windows/bootstrap/files/*path',
    createRouteHandler(
      'Error serving Windows bootstrap file',
      sendJsonInternalError,
      async (req: Request, res: Response): Promise<void> => {
        const authenticated = await authenticateEnrollmentToken(req, res);
        if (!authenticated) {
          return;
        }

        const result = getWindowsBootstrapFile(getWildcardPathParam(req.params.path));
        if (!result.ok) {
          sendMachineServiceError(res, result.error);
          return;
        }

        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.type('text/plain').send(result.data.body);
      }
    )
  );

  app.get(
    '/api/agent/windows/manifest',
    createRouteHandler(
      'Error serving Windows agent manifest',
      sendJsonInternalError,
      async (req: Request, res: Response): Promise<void> => {
        const machine = await authenticateMachineToken(req, res);
        if (!machine) {
          return;
        }

        const result = await getWindowsAgentManifest(machine.hostname);
        if (!result.ok) {
          sendMachineServiceError(res, result.error);
          return;
        }

        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.json({
          success: true,
          version: result.data.version,
          generatedAt: result.data.generatedAt,
          files: result.data.files,
        });
      }
    )
  );

  app.get(
    '/api/agent/windows/files/*path',
    createRouteHandler(
      'Error serving Windows agent file',
      sendJsonInternalError,
      async (req: Request, res: Response): Promise<void> => {
        const machine = await authenticateMachineToken(req, res);
        if (!machine) {
          return;
        }

        const result = await getWindowsAgentFile(
          machine.hostname,
          getWildcardPathParam(req.params.path)
        );
        if (!result.ok) {
          sendMachineServiceError(res, result.error);
          return;
        }

        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.type('text/plain').send(result.data.body);
      }
    )
  );

  app.get(
    '/api/agent/linux/manifest',
    createRouteHandler(
      'Error serving Linux agent manifest',
      sendJsonInternalError,
      async (req: Request, res: Response): Promise<void> => {
        const machine = await authenticateMachineToken(req, res);
        if (!machine) {
          return;
        }

        const result = await getLinuxAgentManifest(machine.hostname);
        if (!result.ok) {
          sendMachineServiceError(res, result.error);
          return;
        }

        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.json({
          success: true,
          ...result.data,
        });
      }
    )
  );

  app.get(
    '/api/agent/linux/packages/:version',
    createRouteHandler(
      'Error serving Linux agent package',
      sendJsonInternalError,
      async (req: Request, res: Response): Promise<void> => {
        const machine = await authenticateMachineToken(req, res);
        if (!machine) {
          return;
        }

        const result = await getLinuxAgentPackage(
          machine.hostname,
          getFirstParam(req.params.version)?.trim() ?? ''
        );
        if (!result.ok) {
          sendMachineServiceError(res, result.error);
          return;
        }

        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Content-Disposition', `attachment; filename="${result.data.fileName}"`);
        res.type('application/vnd.debian.binary-package').send(result.data.body);
      }
    )
  );

  app.get('/w/whitelist.txt', (_req: Request, res: Response): void => {
    sendFailOpenWhitelist(res);
  });

  app.get(
    '/w/:machineToken/whitelist.txt',
    createRouteHandler(
      'Error serving tokenized whitelist',
      sendFailOpenWhitelist,
      async (req: Request, res: Response): Promise<void> => {
        const delivery = await resolveMachineWhitelist(
          getFirstParam(req.params.machineToken),
          deps.getCurrentEvaluationTime(),
          req.headers['if-none-match']
        );
        sendWhitelistDelivery(res, delivery);
      }
    )
  );

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
