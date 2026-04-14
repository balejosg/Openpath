import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getRegisteredMachineRoutes } from './machines-route-test-helpers.js';

await describe('machine routes - enrollment', async () => {
  await test('registers enrollment and download-token rotation endpoints', async () => {
    const routes = await getRegisteredMachineRoutes();

    assert.deepEqual(
      routes.filter(
        (route) =>
          route === 'POST /api/machines/register' ||
          route === 'POST /api/machines/:hostname/rotate-download-token'
      ),
      ['POST /api/machines/register', 'POST /api/machines/:hostname/rotate-download-token']
    );
  });
});
