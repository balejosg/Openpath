import type { Express } from 'express';

import { registerMachineDeliveryRoutes } from './machines/delivery.js';
import { registerMachineEnrollmentRoutes } from './machines/enrollment.js';
import { registerMachineEventRoutes } from './machines/events.js';
import type { MachineRouteDeps } from './machines/helpers.js';

export function registerMachineRoutes(app: Express, deps: MachineRouteDeps): void {
  registerMachineEnrollmentRoutes(app);
  registerMachineDeliveryRoutes(app, deps);
  registerMachineEventRoutes(app);
}
