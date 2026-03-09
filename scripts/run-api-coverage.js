#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(import.meta.dirname, '..');
const API_DIR = resolve(ROOT_DIR, 'api');
const shell = process.env.SHELL || '/bin/sh';

const dbHost = process.env.DB_HOST ?? 'localhost';
const dbPort = process.env.DB_PORT ?? '5433';
const dbName = process.env.DB_NAME ?? 'openpath_test';
const dbUser = process.env.DB_USER ?? 'openpath';
const dbPassword = process.env.DB_PASSWORD ?? 'openpath_test';

const testEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? 'test',
  DB_HOST: dbHost,
  DB_PORT: dbPort,
  DB_NAME: dbName,
  DB_USER: dbUser,
  DB_PASSWORD: dbPassword,
  DATABASE_URL: `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`,
};

function run(command, cwd = ROOT_DIR, env = testEnv) {
  const result = spawnSync(command, {
    cwd,
    env,
    stdio: 'inherit',
    shell,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
}

function wait(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

let failureCode = 0;

try {
  run('docker compose -f docker-compose.test.yml down -v');
  run('docker compose -f docker-compose.test.yml up -d');
  await wait(3000);

  run('npm run db:setup:e2e --workspace=@openpath/api');
  run(
    'node ../scripts/run-c8-coverage.js "node --import tsx --test --test-force-exit --test-concurrency=1 tests/*.test.ts"',
    API_DIR
  );
} catch (error) {
  failureCode = 1;
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
} finally {
  try {
    run('docker compose -f docker-compose.test.yml down', ROOT_DIR, process.env);
  } catch (teardownError) {
    failureCode = failureCode || 1;
    if (teardownError instanceof Error) {
      console.error(teardownError.message);
    } else {
      console.error(String(teardownError));
    }
  }
}

if (failureCode !== 0) {
  process.exit(failureCode);
}
