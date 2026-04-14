import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { TEST_RUN_ID, bearerAuth, uniqueDomain } from './test-utils.js';
import { computeMachineProofToken } from '../src/lib/machine-proof.js';
import {
  MACHINE_AUTH_SCOPE_SHARED_SECRET,
  createClassroom,
  createGroup,
  getAdminToken,
  getApiUrl,
  getEnrollmentTicket,
  registerMachine,
  registerMachineAuthScopeLifecycle,
  trpcMutate,
} from './machine-auth-scope-test-harness.js';

registerMachineAuthScopeLifecycle();

void describe('Machine authentication scope - operational endpoints', { timeout: 45_000 }, () => {
  void test('machine operational endpoints reject global shared-secret-only access and accept machine tokens', async () => {
    const groupId = await createGroup(`machine-group-${TEST_RUN_ID}`);
    const classroomId = await createClassroom(`machine-room-${TEST_RUN_ID}`, groupId);
    const enrollmentToken = await getEnrollmentTicket(classroomId, getAdminToken());
    const machine = await registerMachine({
      classroomId,
      hostname: 'machine-scope-host',
      enrollmentToken,
    });

    const legacyProof = computeMachineProofToken(
      machine.machineHostname,
      MACHINE_AUTH_SCOPE_SHARED_SECRET
    );

    const sharedSecretHealth = await trpcMutate(
      'healthReports.submit',
      {
        hostname: machine.machineHostname,
        status: 'HEALTHY',
      },
      bearerAuth(MACHINE_AUTH_SCOPE_SHARED_SECRET)
    );
    assert.equal(sharedSecretHealth.status, 401);

    const legacyRequest = await fetch(`${getApiUrl()}/api/requests/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: uniqueDomain('legacy-proof'),
        reason: 'legacy proof should be rejected',
        hostname: machine.machineHostname,
        token: legacyProof,
      }),
    });
    assert.equal(legacyRequest.status, 403);

    const sharedSecretRotation = await fetch(
      `${getApiUrl()}/api/machines/${machine.machineHostname}/rotate-download-token`,
      {
        method: 'POST',
        headers: bearerAuth(MACHINE_AUTH_SCOPE_SHARED_SECRET),
      }
    );
    assert.equal(sharedSecretRotation.status, 403);

    const machineHealth = await trpcMutate(
      'healthReports.submit',
      {
        hostname: machine.machineHostname,
        status: 'HEALTHY',
        dnsmasqRunning: true,
        dnsResolving: true,
      },
      bearerAuth(machine.machineToken)
    );
    assert.equal(machineHealth.status, 200);

    const requestResponse = await fetch(`${getApiUrl()}/api/requests/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: uniqueDomain('machine-token'),
        reason: 'machine token should work',
        hostname: machine.machineHostname,
        token: machine.machineToken,
        origin_host: 'machine.local',
      }),
    });
    assert.equal(requestResponse.status, 200);

    const rotatedResponse = await fetch(
      `${getApiUrl()}/api/machines/${machine.machineHostname}/rotate-download-token`,
      {
        method: 'POST',
        headers: bearerAuth(machine.machineToken),
      }
    );
    assert.equal(rotatedResponse.status, 200);

    const rotatedData = (await rotatedResponse.json()) as { whitelistUrl: string };
    const rotatedMachineToken = /\/w\/([^/]+)\//.exec(rotatedData.whitelistUrl)?.[1] ?? '';
    assert.notEqual(rotatedMachineToken, '');
    assert.notEqual(rotatedMachineToken, machine.machineToken);

    const oldTokenHealth = await trpcMutate(
      'healthReports.submit',
      {
        hostname: machine.machineHostname,
        status: 'HEALTHY',
      },
      bearerAuth(machine.machineToken)
    );
    assert.equal(oldTokenHealth.status, 401);

    const newTokenHealth = await trpcMutate(
      'healthReports.submit',
      {
        hostname: machine.machineHostname,
        status: 'HEALTHY',
      },
      bearerAuth(rotatedMachineToken)
    );
    assert.equal(newTokenHealth.status, 200);
  });
});
