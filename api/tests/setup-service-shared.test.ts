import assert from 'node:assert/strict';
import { test } from 'node:test';

void test('setup-service-shared module loads', async () => {
  const mod = await import('../src/services/setup-service-shared.js');
  assert.notEqual(mod, undefined);
});
