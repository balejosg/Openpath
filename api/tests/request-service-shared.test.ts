import assert from 'node:assert/strict';
import { test } from 'node:test';

void test('request-service-shared module loads', async () => {
  const mod = await import('../src/services/request-service-shared.js');
  assert.notEqual(mod, undefined);
});
