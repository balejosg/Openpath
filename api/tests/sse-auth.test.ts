import { after, before, describe, test } from 'node:test';
import assert from 'node:assert';

import type { SseTestHarness } from './sse-test-harness.js';
import { startSseTestHarness } from './sse-test-harness.js';

let harness: SseTestHarness | undefined;

function getHarness(): SseTestHarness {
  assert.ok(harness, 'SSE harness should be initialized');
  return harness;
}

void describe('SSE Endpoint - authentication', { timeout: 30000 }, () => {
  before(async () => {
    harness = await startSseTestHarness();
  });

  after(async () => {
    await harness?.close();
    harness = undefined;
  });

  void test('should reject requests without token', async () => {
    const response = await fetch(`${getHarness().apiUrl}/api/machines/events`);
    assert.strictEqual(response.status, 401);
  });

  void test('should reject requests with invalid token (query param)', async () => {
    const response = await fetch(`${getHarness().apiUrl}/api/machines/events?token=invalid-token`);
    assert.strictEqual(response.status, 403);
  });

  void test('should reject requests with invalid Bearer token', async () => {
    const response = await fetch(`${getHarness().apiUrl}/api/machines/events`, {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    assert.strictEqual(response.status, 403);
  });

  void test('should accept requests with valid Bearer token', async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 2000);

    try {
      const response = await fetch(`${getHarness().apiUrl}/api/machines/events`, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${getHarness().testMachineToken}` },
      });

      assert.strictEqual(response.status, 200);

      const contentType = response.headers.get('content-type');
      assert.ok(
        contentType?.includes('text/event-stream'),
        `Expected text/event-stream, got ${String(contentType)}`
      );
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  });

  void test('should accept requests with valid query param token (backward compat)', async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 2000);

    try {
      const response = await fetch(
        `${getHarness().apiUrl}/api/machines/events?token=${getHarness().testMachineToken}`,
        { signal: controller.signal }
      );

      assert.strictEqual(response.status, 200);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  });
});
