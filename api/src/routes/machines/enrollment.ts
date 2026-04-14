import type { Express, Request, Response } from 'express';

import {
  authenticateMachineToken,
  getFirstParam,
  validateMachineHostnameAccess,
} from '../../lib/server-request-auth.js';
import {
  registerMachineWithToken,
  rotateMachineDownloadToken,
} from '../../services/machine-registration.service.js';
import { createRouteHandler, sendJsonInternalError, sendMachineServiceError } from './helpers.js';

export function registerMachineEnrollmentRoutes(app: Express): void {
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
}
