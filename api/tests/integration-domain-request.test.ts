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

await describe('integration domain request workflow', async () => {
  await test('completes request submission to review to decision', async () => {
    const submitResponse = await trpcMutate('requests.create', {
      domain: `integration-test-${Date.now().toString()}.example.com`,
      reason: 'Integration test request',
      requesterEmail: 'student@test.com',
    });

    assert.equal(submitResponse.status, 200, 'Request submission should succeed');
    const submitResult = (await parseTRPC(submitResponse)).data as { id?: string };
    assert.ok(submitResult.id, 'Response should contain request id');

    const listResponse = await trpcQuery('requests.list', {}, getAdminBearerAuth());
    assert.equal(listResponse.status, 200, 'Request listing should succeed');

    const listResult = (await parseTRPC(listResponse)).data;
    assert.ok(Array.isArray(listResult), 'Response should contain requests array');

    const statusResponse = await trpcQuery('requests.getStatus', { id: submitResult.id });
    assert.equal(statusResponse.status, 200, 'Request retrieval should succeed');

    const statusResult = (await parseTRPC(statusResponse)).data as { status?: string };
    assert.equal(statusResult.status, 'pending');

    const rejectResponse = await trpcMutate(
      'requests.reject',
      {
        id: submitResult.id,
        reason: 'Integration test rejection',
      },
      getAdminBearerAuth()
    );
    assert.equal(rejectResponse.status, 200, 'Request rejection should succeed');
  });
});
