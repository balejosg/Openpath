import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  getAdminBearerAuth,
  parseTRPC,
  registerIntegrationLifecycle,
  trpcMutate,
  trpcQuery,
} from './integration-test-harness.js';

registerIntegrationLifecycle();

await describe('integration classroom management workflow', async () => {
  await test('completes classroom create to get to delete', async () => {
    const createResponse = await trpcMutate(
      'classrooms.create',
      {
        description: 'Test classroom for integration testing',
        name: `integration-test-lab-${Date.now().toString()}`,
      },
      getAdminBearerAuth()
    );

    assert.ok(
      [200, 201].includes(createResponse.status),
      `Classroom creation should succeed, got ${String(createResponse.status)}`
    );

    const createResult = (await parseTRPC(createResponse)).data as { id?: string };
    assert.ok(createResult.id, 'Response should contain classroom id');

    const getResponse = await trpcQuery(
      'classrooms.get',
      { id: createResult.id },
      getAdminBearerAuth()
    );
    assert.equal(getResponse.status, 200, 'Classroom retrieval should succeed');

    const deleteResponse = await trpcMutate(
      'classrooms.delete',
      { id: createResult.id },
      getAdminBearerAuth()
    );
    assert.equal(deleteResponse.status, 200, 'Classroom deletion should succeed');
  });
});
