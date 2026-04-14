import { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  bearerAuth,
  parseTRPC,
  resetDb,
  trpcMutate as trpcMutateBase,
  uniqueEmail,
} from './test-utils.js';
import { startHttpTestHarness, type HttpTestHarness } from './http-test-harness.js';
import { stopDbEventBridge, stopScheduleBoundaryTicker } from '../src/lib/rule-events.js';

let adminToken = '';
let harness: HttpTestHarness | undefined;
let testDataDir: string | null = null;

export const MACHINE_AUTH_SCOPE_SHARED_SECRET = 'test-shared-secret';

function getHarness(): HttpTestHarness {
  assert.ok(harness, 'Machine auth scope harness should be initialized');
  return harness;
}

export function getAdminToken(): string {
  assert.notEqual(adminToken, '', 'Machine auth scope admin token should be initialized');
  return adminToken;
}

export function getApiUrl(): string {
  return getHarness().apiUrl;
}

export function registerMachineAuthScopeLifecycle(): void {
  before(async () => {
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpath-machine-auth-scope-'));

    const etcPath = path.join(process.cwd(), 'etc');
    if (!fs.existsSync(etcPath)) {
      fs.mkdirSync(etcPath, { recursive: true });
    }

    harness = await startHttpTestHarness({
      env: {
        DATA_DIR: testDataDir,
        JWT_SECRET: 'test-jwt-secret',
        SHARED_SECRET: MACHINE_AUTH_SCOPE_SHARED_SECRET,
      },
      readyDelayMs: 1_000,
    });
  });

  beforeEach(async () => {
    await resetDb();
    adminToken = (await getHarness().bootstrapAdminSession({ name: 'Machine Scope Admin' }))
      .accessToken;
  });

  after(async () => {
    adminToken = '';

    await stopDbEventBridge();
    await stopScheduleBoundaryTicker();
    await harness?.close();
    harness = undefined;

    if (testDataDir !== null) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
      testDataDir = null;
    }
  });
}

export async function trpcMutate(
  procedure: string,
  input: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  return trpcMutateBase(getHarness().apiUrl, procedure, input, headers);
}

export async function createUser(params: {
  groupIds?: string[];
  prefix: string;
  role?: 'teacher' | 'admin';
}): Promise<{ accessToken: string }> {
  const email = uniqueEmail(params.prefix);
  const password = 'Password123!';

  const createResponse = await trpcMutate(
    'users.create',
    {
      email,
      password,
      name: `${params.prefix} user`,
      ...(params.role ? { role: params.role } : {}),
      ...(params.groupIds ? { groupIds: params.groupIds } : {}),
    },
    bearerAuth(getAdminToken())
  );

  assert.equal(createResponse.status, 200);

  const loginResponse = await trpcMutate('auth.login', { email, password });
  assert.equal(loginResponse.status, 200);

  const loginData = (await parseTRPC(loginResponse)).data as { accessToken: string };
  assert.ok(loginData.accessToken);

  return { accessToken: loginData.accessToken };
}

export async function createGroup(name: string): Promise<string> {
  const response = await trpcMutate(
    'groups.create',
    { name, displayName: name },
    bearerAuth(getAdminToken())
  );

  assert.equal(response.status, 200);
  return ((await parseTRPC(response)).data as { id: string }).id;
}

export async function createClassroom(name: string, defaultGroupId?: string): Promise<string> {
  const response = await trpcMutate(
    'classrooms.create',
    {
      name,
      displayName: name,
      ...(defaultGroupId ? { defaultGroupId } : {}),
    },
    bearerAuth(getAdminToken())
  );

  assert.ok([200, 201].includes(response.status));
  return ((await parseTRPC(response)).data as { id: string }).id;
}

export async function requestEnrollmentTicket(
  classroomId: string,
  accessToken: string,
  notFoundRetries = 0
): Promise<Response> {
  for (let attempt = 0; attempt <= notFoundRetries; attempt += 1) {
    const response = await fetch(`${getApiUrl()}/api/enroll/${classroomId}/ticket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status !== 404 || attempt === notFoundRetries) {
      return response;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error('Unreachable enrollment ticket retry state');
}

export async function getEnrollmentTicket(
  classroomId: string,
  accessToken: string
): Promise<string> {
  const response = await requestEnrollmentTicket(classroomId, accessToken, 2);

  assert.equal(response.status, 200);
  const data = (await response.json()) as { enrollmentToken: string };
  assert.ok(data.enrollmentToken);
  return data.enrollmentToken;
}

export function extractMachineToken(whitelistUrl: string): string {
  const match = /\/w\/([^/]+)\//.exec(whitelistUrl);
  assert.ok(match, `Expected tokenized whitelist URL, got ${whitelistUrl}`);
  const token = match[1];
  assert.ok(token, `Expected machine token in ${whitelistUrl}`);
  return token;
}

export async function registerMachine(params: {
  classroomId: string;
  enrollmentToken: string;
  hostname: string;
}): Promise<{ machineHostname: string; machineToken: string }> {
  const response = await fetch(`${getApiUrl()}/api/machines/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.enrollmentToken}`,
    },
    body: JSON.stringify({
      hostname: params.hostname,
      classroomId: params.classroomId,
    }),
  });

  assert.equal(response.status, 200);
  const data = (await response.json()) as {
    machineHostname: string;
    whitelistUrl: string;
  };

  assert.ok(data.machineHostname);
  assert.ok(data.whitelistUrl);

  return {
    machineHostname: data.machineHostname,
    machineToken: extractMachineToken(data.whitelistUrl),
  };
}
