import { after, before, describe, test } from 'node:test';
import assert from 'node:assert';

import { createSseTestClient } from './sse-test-utils.js';
import type { SseTestHarness } from './sse-test-harness.js';
import { startSseTestHarness } from './sse-test-harness.js';

let harness: SseTestHarness | undefined;

function getHarness(): SseTestHarness {
  assert.ok(harness, 'SSE harness should be initialized');
  return harness;
}

void describe('SSE Endpoint - connection lifecycle', { timeout: 30000 }, () => {
  before(async () => {
    harness = await startSseTestHarness();
  });

  after(async () => {
    await harness?.close();
    harness = undefined;
  });

  void test('should send initial "connected" event', async () => {
    const client = createSseTestClient({
      url: `${getHarness().apiUrl}/api/machines/events`,
      headers: { Authorization: `Bearer ${getHarness().testMachineToken}` },
    });

    try {
      const response = await client.connect();
      assert.strictEqual(response.status, 200);

      const contentType = response.headers.get('content-type');
      assert.ok(
        contentType?.includes('text/event-stream'),
        `Expected text/event-stream, got ${String(contentType)}`
      );

      const connectedEvent = (await client.waitFor(
        (event) => event.event === 'connected',
        5000,
        'connected event'
      )) as { event?: string; groupId?: string };

      assert.strictEqual(connectedEvent.event, 'connected');
      assert.strictEqual(connectedEvent.groupId, getHarness().testGroupId);
    } finally {
      client.close();
    }
  });
});
