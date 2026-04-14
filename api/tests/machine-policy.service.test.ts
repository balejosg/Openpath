import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

await describe('machine policy service', async () => {
  const { FAIL_OPEN_RESPONSE, resolveMachineEventsAccess, resolveMachineWhitelist } =
    await import('../src/services/machine-policy.service.js');

  await test('fails open when the machine token is missing', async () => {
    const result = await resolveMachineWhitelist(
      undefined,
      new Date('2026-04-14T12:00:00Z'),
      undefined
    );

    assert.deepEqual(result, {
      kind: 'content',
      body: FAIL_OPEN_RESPONSE,
      cacheControl: 'no-store, max-age=0',
      pragma: 'no-cache',
    });
  });

  await test('requires a machine token to open an events stream', async () => {
    const result = await resolveMachineEventsAccess({});

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Machine token required (Authorization: Bearer or query param)',
      },
    });
  });
});
