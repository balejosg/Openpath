import { after, before } from 'node:test';

import { startHttpTestHarness, type HttpTestHarness } from './http-test-harness.js';
import { parseTRPC as parseTRPCBase, registerAndVerifyUser, uniqueEmail } from './test-utils.js';

let harness: HttpTestHarness | undefined;
let adminToken = '';

function getHarness(): HttpTestHarness {
  if (harness === undefined) {
    throw new Error('Integration HTTP harness has not been initialized');
  }

  return harness;
}

export function registerIntegrationLifecycle(): void {
  before(async () => {
    harness = await startHttpTestHarness({
      env: {
        JWT_SECRET: 'integration-test-jwt-secret',
        SHARED_SECRET: 'integration-test-shared-secret',
      },
      cleanup: async () => {
        const { resetTokenStore } = await import('../src/lib/token-store.js');
        resetTokenStore();
      },
      readyDelayMs: 500,
      resetDb: true,
    });

    adminToken = (await harness.bootstrapAdminSession({ name: 'Integration Test Admin' }))
      .accessToken;
  });

  after(async () => {
    await harness?.close();
    harness = undefined;
    adminToken = '';
  });
}

export function getAdminBearerAuth(): Record<string, string> {
  if (adminToken === '') {
    throw new Error('Integration admin token has not been initialized');
  }

  return { Authorization: `Bearer ${adminToken}` };
}

export async function trpcMutate(
  procedure: string,
  input: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  return getHarness().trpcMutate(procedure, input, headers);
}

export async function trpcQuery(
  procedure: string,
  input?: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  return getHarness().trpcQuery(procedure, input, headers);
}

export { parseTRPCBase as parseTRPC };

export async function registerAndVerifyIntegrationUser(input: {
  email?: string;
  name: string;
  password: string;
}): Promise<Awaited<ReturnType<typeof registerAndVerifyUser>>> {
  return registerAndVerifyUser(getHarness().apiUrl, {
    email: input.email ?? uniqueEmail(input.name.toLowerCase().replace(/\s+/g, '-')),
    password: input.password,
    name: input.name,
  });
}

function extractMachineToken(whitelistUrl: string): string {
  const match = /\/w\/([^/]+)\//.exec(whitelistUrl);
  if (match?.[1] === undefined || match[1] === '') {
    throw new Error(`Expected tokenized whitelist URL, got: ${whitelistUrl}`);
  }

  return match[1];
}

export async function provisionMachineAccess(input: {
  classroomName: string;
  groupName: string;
  hostname: string;
}): Promise<{
  classroomId: string;
  groupId: string;
  machineHostname: string;
  machineToken: string;
}> {
  const groupResponse = await trpcMutate(
    'groups.create',
    {
      name: input.groupName,
      displayName: input.groupName,
    },
    getAdminBearerAuth()
  );

  if (groupResponse.status !== 200) {
    throw new Error(`Expected group creation to succeed, got ${String(groupResponse.status)}`);
  }

  const groupResult = (await parseTRPCBase(groupResponse)).data as { id?: string };
  if (groupResult.id === undefined || groupResult.id === '') {
    throw new Error('Expected group creation to return an id');
  }

  const classroomResponse = await trpcMutate(
    'classrooms.create',
    {
      name: input.classroomName,
      displayName: input.classroomName,
      defaultGroupId: groupResult.id,
    },
    getAdminBearerAuth()
  );

  if (![200, 201].includes(classroomResponse.status)) {
    throw new Error(
      `Expected classroom creation to succeed, got ${String(classroomResponse.status)}`
    );
  }

  const classroomResult = (await parseTRPCBase(classroomResponse)).data as { id?: string };
  if (classroomResult.id === undefined || classroomResult.id === '') {
    throw new Error('Expected classroom creation to return an id');
  }

  const ticketResponse = await fetch(
    `${getHarness().apiUrl}/api/enroll/${classroomResult.id}/ticket`,
    {
      method: 'POST',
      headers: getAdminBearerAuth(),
    }
  );
  if (ticketResponse.status !== 200) {
    throw new Error(
      `Expected enrollment ticket creation to succeed, got ${String(ticketResponse.status)}`
    );
  }

  const ticketData = (await ticketResponse.json()) as { enrollmentToken?: string };
  if (ticketData.enrollmentToken === undefined || ticketData.enrollmentToken === '') {
    throw new Error('Expected enrollment ticket to include a token');
  }

  const registerResponse = await fetch(`${getHarness().apiUrl}/api/machines/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ticketData.enrollmentToken}`,
    },
    body: JSON.stringify({
      classroomId: classroomResult.id,
      hostname: input.hostname,
    }),
  });
  if (registerResponse.status !== 200) {
    throw new Error(
      `Expected machine registration to succeed, got ${String(registerResponse.status)}`
    );
  }

  const registerData = (await registerResponse.json()) as {
    machineHostname?: string;
    whitelistUrl?: string;
  };
  if (registerData.machineHostname === undefined || registerData.whitelistUrl === undefined) {
    throw new Error('Expected machine registration to return hostname and whitelist URL');
  }

  return {
    classroomId: classroomResult.id,
    groupId: groupResult.id,
    machineHostname: registerData.machineHostname,
    machineToken: extractMachineToken(registerData.whitelistUrl),
  };
}
