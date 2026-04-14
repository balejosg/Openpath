import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startHttpTestHarness, type HttpTestHarness } from './http-test-harness.js';
import { TEST_RUN_ID, assertStatus, bearerAuth, parseTRPC } from './test-utils.js';

export interface ClassroomResult {
  currentGroupId?: string;
  defaultGroupId?: string;
  displayName?: string;
  id: string;
  machines?: unknown[];
  name: string;
}

export interface MachineResult {
  classroomId?: string;
  groupId?: string;
  hostname: string;
  url?: string;
}

export interface ClassroomsTestHarness extends HttpTestHarness {
  adminToken: string;
  cienciasGroupId: string;
  createClassroom: (input?: {
    defaultGroupId?: string;
    displayName?: string;
    name?: string;
  }) => Promise<ClassroomResult>;
  createEnrollmentToken: (classroomId: string) => Promise<string>;
  getClassrooms: () => Promise<ClassroomResult[]>;
  lenguaGroupId: string;
  suffix: string;
}

export function uniqueClassroomName(prefix: string): string {
  return `${prefix}-${TEST_RUN_ID}-${Math.random().toString(36).slice(2, 6)}`;
}

async function createGroup(
  harness: HttpTestHarness,
  adminToken: string,
  name: string,
  displayName: string
): Promise<string> {
  const response = await harness.trpcMutate(
    'groups.create',
    { name, displayName },
    bearerAuth(adminToken)
  );
  assertStatus(response, 200);
  const payload = (await parseTRPC(response)) as { data?: { id?: string } };
  const groupId = payload.data?.id ?? '';
  assert.ok(groupId, `Expected group id for ${name}`);
  return groupId;
}

export async function startClassroomsTestHarness(): Promise<ClassroomsTestHarness> {
  const suffix = TEST_RUN_ID;
  const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpath-classrooms-'));
  fs.mkdirSync(path.join(process.cwd(), 'etc'), { recursive: true });

  const harness = await startHttpTestHarness({
    cleanup: () => {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    },
    env: {
      DATA_DIR: testDataDir,
      JWT_SECRET: 'test-jwt-secret',
    },
    readyDelayMs: 1000,
    resetDb: true,
  });

  const adminToken = (await harness.bootstrapAdminSession({ name: 'Classrooms Test Admin' }))
    .accessToken;

  const cienciasGroupId = await createGroup(
    harness,
    adminToken,
    `ciencias-3eso-${suffix}`,
    `ciencias-3eso-${suffix}`
  );
  const lenguaGroupId = await createGroup(
    harness,
    adminToken,
    `lengua-2eso-${suffix}`,
    `lengua-2eso-${suffix}`
  );

  return {
    ...harness,
    adminToken,
    cienciasGroupId,
    createClassroom: async (input = {}): Promise<ClassroomResult> => {
      const name = input.name ?? uniqueClassroomName('classroom');
      const response = await harness.trpcMutate(
        'classrooms.create',
        {
          name,
          displayName: input.displayName ?? name,
          defaultGroupId: input.defaultGroupId ?? cienciasGroupId,
        },
        bearerAuth(adminToken)
      );
      assertStatus(response, 200);
      const payload = (await parseTRPC(response)) as { data?: ClassroomResult };
      assert.ok(payload.data?.id, 'Expected created classroom id');
      return payload.data;
    },
    createEnrollmentToken: async (classroomId: string): Promise<string> => {
      const response = await fetch(`${harness.apiUrl}/api/enroll/${classroomId}/ticket`, {
        method: 'POST',
        headers: bearerAuth(adminToken),
      });
      assertStatus(response, 200);
      const payload = (await response.json()) as { enrollmentToken?: string };
      const token = payload.enrollmentToken ?? '';
      assert.ok(token, 'Expected enrollment token');
      return token;
    },
    getClassrooms: async (): Promise<ClassroomResult[]> => {
      const response = await harness.trpcQuery(
        'classrooms.list',
        undefined,
        bearerAuth(adminToken)
      );
      assertStatus(response, 200);
      const payload = (await parseTRPC(response)) as { data?: ClassroomResult[] };
      return payload.data ?? [];
    },
    lenguaGroupId,
    suffix,
  };
}
