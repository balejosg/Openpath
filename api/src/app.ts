import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import type { Config } from './config.js';
import { config as defaultConfig } from './config.js';
import { logger } from './lib/logger.js';
import { registerAppErrorHandlers } from './app-errors.js';
import { getTrustedBrowserOrigins, registerAppMiddleware } from './app-middleware.js';
import { registerAppRoutes } from './app-routes.js';

export interface CreatedApp {
  app: express.Express;
}

export async function createApp(runtimeConfig: Config = defaultConfig): Promise<CreatedApp> {
  let swaggerUi: typeof import('swagger-ui-express') | undefined;
  let getSwaggerSpec: (() => object) | undefined;

  if (runtimeConfig.enableSwagger) {
    try {
      swaggerUi = await import('swagger-ui-express');
      const swaggerModule = await import('./lib/swagger.js');
      getSwaggerSpec = swaggerModule.getSwaggerSpec;
      logger.debug('Swagger documentation enabled');
    } catch (err) {
      logger.warn('Swagger dependencies not installed - skipping documentation', { error: err });
    }
  } else {
    logger.info('Swagger documentation disabled via configuration');
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const app = express();
  let testNowOverride: Date | null = null;

  function getCurrentEvaluationTime(): Date {
    return runtimeConfig.isTest && testNowOverride !== null
      ? new Date(testNowOverride)
      : new Date();
  }

  function setTestNowOverride(nextValue: Date | null): void {
    testNowOverride = nextValue;
  }

  registerAppMiddleware(app, runtimeConfig, getTrustedBrowserOrigins(runtimeConfig));
  registerAppRoutes(app, runtimeConfig, {
    currentDirname: __dirname,
    getCurrentEvaluationTime,
    setTestNowOverride,
    swaggerUi,
    getSwaggerSpec,
  });
  registerAppErrorHandlers(app);

  return { app };
}

export default {
  createApp,
};
