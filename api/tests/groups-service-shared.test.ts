import assert from 'node:assert/strict';
import { test } from 'node:test';

void test('groups-service-shared module loads', async () => {
  const mod = await import('../src/services/groups-service-shared.js');
  assert.notEqual(mod, undefined);
});
