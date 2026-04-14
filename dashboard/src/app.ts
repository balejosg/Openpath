import express from 'express';

import { registerAuthRoutes } from './app-auth.js';
import { registerErrorHandlers } from './app-errors.js';
import { registerDashboardRoutes } from './app-groups.js';
import { registerCommonMiddleware } from './app-middleware.js';

export interface DashboardAppOptions {
  cookieSecret?: string;
  cookieSecure?: boolean;
}

export function createDashboardApp(options: DashboardAppOptions = {}): express.Express {
  const app = express();

  registerCommonMiddleware(app, options.cookieSecret ?? 'dashboard-dev-secret');
  registerAuthRoutes(app, { cookieSecure: options.cookieSecure ?? false });
  registerDashboardRoutes(app);
  registerErrorHandlers(app);

  return app;
}
