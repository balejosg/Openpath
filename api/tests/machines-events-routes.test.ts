import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getRegisteredMachineRoutes } from './machines-route-test-helpers.js';

await describe('machine routes - events', async () => {
  await test('registers the machine event stream endpoint', async () => {
    const routes = await getRegisteredMachineRoutes();

    assert.deepEqual(
      routes.filter((route) => route === 'GET /api/machines/events'),
      ['GET /api/machines/events']
    );
  });
});
