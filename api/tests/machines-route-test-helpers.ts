import express from 'express';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

export async function getRegisteredMachineRoutes(): Promise<string[]> {
  const { registerMachineRoutes } = await import('../src/routes/machines.js');

  const app = express();
  registerMachineRoutes(app, {
    getCurrentEvaluationTime: () => new Date('2026-04-01T00:00:00Z'),
  });

  return (
    app.router.stack as unknown as {
      route?: { path: string; methods: Record<string, boolean> };
    }[]
  )
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route?.methods ?? {}).map(
        (method) => `${method.toUpperCase()} ${layer.route?.path ?? ''}`
      )
    );
}
