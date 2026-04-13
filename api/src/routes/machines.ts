import type { Express, Request, Response } from 'express';

import { logger } from '../lib/logger.js';
import * as classroomStorage from '../lib/classroom-storage.js';
import {
  ensureDbEventBridgeStarted,
  ensureScheduleBoundaryTickerStarted,
  getSseClientCount,
  registerSseClient,
} from '../lib/rule-events.js';
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
import {
  registerMachineWithToken,
  rotateMachineDownloadToken,
} from '../services/machine-registration.service.js';
import {
  FAIL_OPEN_RESPONSE,
  resolveMachineEventsAccess,
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

export function registerMachineRoutes(
  app: Express,
  deps: { getCurrentEvaluationTime: () => Date }
): void {
  app.post('/api/machines/register', (req: Request, res: Response): void => {
    void (async (): Promise<void> => {
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
    })().catch((error: unknown) => {
      logger.error('Machine registration route failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });
  });

  app.post('/api/machines/:hostname/rotate-download-token', (req: Request, res: Response): void => {
    void (async (): Promise<void> => {
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
    })().catch((error: unknown) => {
      logger.error('Rotate machine download token route failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });
  });

  app.get('/api/agent/windows/bootstrap/manifest', (req: Request, res: Response): void => {
    void (async (): Promise<void> => {
      try {
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
      } catch (error) {
        logger.error('Error serving Windows bootstrap manifest', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Internal error' });
        }
      }
    })();
  });

  app.get('/api/agent/windows/bootstrap/files/*path', (req: Request, res: Response): void => {
    void (async (): Promise<void> => {
      try {
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
      } catch (error) {
        logger.error('Error serving Windows bootstrap file', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Internal error' });
        }
      }
    })();
  });

  app.get('/api/agent/windows/manifest', (req: Request, res: Response): void => {
    void (async (): Promise<void> => {
      try {
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
      } catch (error) {
        logger.error('Error serving Windows agent manifest', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Internal error' });
        }
      }
    })();
  });

  app.get('/api/agent/windows/files/*path', (req: Request, res: Response): void => {
    void (async (): Promise<void> => {
      try {
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
      } catch (error) {
        logger.error('Error serving Windows agent file', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Internal error' });
        }
      }
    })();
  });

  app.get('/api/agent/linux/manifest', (req: Request, res: Response): void => {
    void (async (): Promise<void> => {
      try {
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
      } catch (error) {
        logger.error('Error serving Linux agent manifest', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Internal error' });
        }
      }
    })();
  });

  app.get('/api/agent/linux/packages/:version', (req: Request, res: Response): void => {
    void (async (): Promise<void> => {
      try {
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
      } catch (error) {
        logger.error('Error serving Linux agent package', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Internal error' });
        }
      }
    })();
  });

  app.get('/w/whitelist.txt', (_req: Request, res: Response): void => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.type('text/plain').send(FAIL_OPEN_RESPONSE);
  });

  app.get('/w/:machineToken/whitelist.txt', (req: Request, res: Response): void => {
    void (async (): Promise<void> => {
      try {
        const delivery = await resolveMachineWhitelist(
          getFirstParam(req.params.machineToken),
          deps.getCurrentEvaluationTime(),
          req.headers['if-none-match']
        );
        sendWhitelistDelivery(res, delivery);
      } catch (error) {
        logger.error('Error serving tokenized whitelist', {
          error: error instanceof Error ? error.message : String(error),
        });
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.type('text/plain').send(FAIL_OPEN_RESPONSE);
      }
    })();
  });

  app.get('/api/machines/events', (req: Request, res: Response): void => {
    void (async (): Promise<void> => {
      try {
        const access = await resolveMachineEventsAccess({
          authorizationHeader: req.headers.authorization,
          queryToken: typeof req.query.token === 'string' ? req.query.token : undefined,
        });
        if (!access.ok) {
          sendMachineServiceError(res, access.error);
          return;
        }

        const { machine, classroomId, groupId } = access.data;

        await ensureDbEventBridgeStarted();
        void ensureScheduleBoundaryTickerStarted();

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        res.write(
          `data: ${JSON.stringify({
            event: 'connected',
            groupId,
            hostname: machine.hostname,
          })}\n\n`
        );

        const unsubscribe = registerSseClient({
          hostname: machine.hostname,
          classroomId,
          groupId,
          stream: res,
        });

        logger.info('SSE client connected', {
          hostname: machine.hostname,
          classroomId,
          groupId,
          clients: getSseClientCount(),
        });

        await classroomStorage.updateMachineLastSeen(machine.hostname);

        req.on('close', () => {
          unsubscribe();
          logger.info('SSE client disconnected', {
            hostname: machine.hostname,
            classroomId,
            groupId,
            clients: getSseClientCount(),
          });
        });
      } catch (error) {
        logger.error('SSE endpoint error', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Internal error' });
        }
      }
    })();
  });
}
