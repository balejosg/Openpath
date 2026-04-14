import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  getAdminBearerAuth,
  parseTRPC,
  provisionMachineAccess,
  registerIntegrationLifecycle,
  trpcMutate,
  trpcQuery,
} from './integration-test-harness.js';

registerIntegrationLifecycle();

await describe('integration health report workflow', async () => {
  await test('completes health report submission to admin retrieval', async () => {
    const suffix = Date.now().toString();
    const machine = await provisionMachineAccess({
      classroomName: `integration-health-room-${suffix}`,
      groupName: `integration-health-group-${suffix}`,
      hostname: `integration-health-host-${suffix}`,
    });

    const reportResponse = await trpcMutate(
      'healthReports.submit',
      {
        hostname: `integration-health-host-${suffix}`,
        status: 'healthy',
        version: '3.5',
      },
      { Authorization: `Bearer ${machine.machineToken}` }
    );

    assert.ok(
      [200, 201].includes(reportResponse.status),
      `Health report submission should succeed, got ${String(reportResponse.status)}`
    );

    const listResponse = await trpcQuery('healthReports.list', undefined, getAdminBearerAuth());
    assert.equal(listResponse.status, 200, 'Should retrieve health reports');

    const listResult = (await parseTRPC(listResponse)).data as {
      hosts?: { hostname: string }[];
    };
    assert.ok(Array.isArray(listResult.hosts), 'Response should contain hosts array');
    assert.ok(
      listResult.hosts.some((host) => host.hostname === machine.machineHostname),
      'Expected registered machine to appear in the health report summary'
    );
  });
});
