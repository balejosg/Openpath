import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

await describe('machine events service', async () => {
  const { openMachineEventsStream } = await import('../src/services/machine-events.service.js');

  await test('requires a machine token before opening the SSE stream', async () => {
    const writes: string[] = [];
    const result = await openMachineEventsStream({
      stream: {
        write: (chunk: string) => {
          writes.push(chunk);
          return true;
        },
        writeHead: () => undefined,
      },
    });

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Machine token required (Authorization: Bearer or query param)',
      },
    });
    assert.deepEqual(writes, []);
  });
});
