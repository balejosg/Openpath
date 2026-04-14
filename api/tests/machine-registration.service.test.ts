import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

await describe('machine registration service', async () => {
  const { registerMachineWithToken } =
    await import('../src/services/machine-registration.service.js');

  await test('requires a bearer token before attempting registration', async () => {
    const result = await registerMachineWithToken({
      hostname: 'lab-pc-01',
      classroomName: 'Room 101',
    });

    assert.deepEqual(result, {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Authorization header required' },
    });
  });
});
