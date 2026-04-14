import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

await describe('machine agent delivery service', async () => {
  const { getWindowsBootstrapFile } =
    await import('../src/services/machine-agent-delivery.service.js');

  await test('rejects empty bootstrap file paths', () => {
    const result = getWindowsBootstrapFile('');

    assert.deepEqual(result, {
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'file path required' },
    });
  });
});
