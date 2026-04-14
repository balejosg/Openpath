import type { Server } from 'node:http';

export function applyEnvOverrides(
  env: Record<string, string | undefined>
): Map<string, string | undefined> {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(env)) {
    previousValues.set(key, process.env[key]);
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }

  return previousValues;
}

export function restoreEnv(previousValues: Map<string, string | undefined>): void {
  for (const [key, value] of previousValues.entries()) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
}

export async function closeServer(server: Server | undefined): Promise<void> {
  if (server === undefined) {
    return;
  }

  if ('closeAllConnections' in server && typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }

  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

export async function resetProcessTestState(
  env: Readonly<Record<string, string | undefined>> = process.env
): Promise<void> {
  const [{ loadConfig, setConfigForTests }, { resetTokenStore }] = await Promise.all([
    import('../../src/config.js'),
    import('../../src/lib/token-store.js'),
  ]);

  setConfigForTests(loadConfig(env));
  resetTokenStore();
}
