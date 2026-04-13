import { describe, test } from 'node:test';
import assert from 'node:assert';

import { registerSecurityLifecycle, request } from './security-test-harness.js';

registerSecurityLifecycle();

void describe('Security tests - privacy boundaries and public rate limits', () => {
  void test('rejects health reports with unrecognized fields (strict schema)', async () => {
    const { body, status } = await request('/trpc/healthReports.submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-shared-secret',
      },
      body: JSON.stringify({
        json: {
          hostname: 'test-host',
          status: 'OK',
          browsingHistory: ['forbidden-site.com'],
          dnsQueries: ['how to bypass'],
        },
      }),
    });

    if (status !== 401) {
      assert.strictEqual(status, 400);
      const errorMessage = (body as { error: { message: string } }).error.message;
      assert.ok(errorMessage.includes('unrecognized_keys'));
    }
  });

  void test('rejects domain requests with unrecognized fields', async () => {
    const { body, status } = await request('/trpc/requests.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.25',
      },
      body: JSON.stringify({
        json: {
          domain: `privacy-test-${Date.now().toString()}.com`,
          reason: 'test',
          requesterEmail: 'user@test.local',
          fullUrl: 'https://example.com/private/path',
        },
      }),
    });

    assert.strictEqual(status, 400);
    const errorMessage = (body as { error: { message: string } }).error.message;
    assert.ok(errorMessage.includes('unrecognized_keys'));
  });

  void test('enforces the public request rate limit on /api/requests/auto', async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        request('/api/requests/auto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      )
    );

    const blocked = responses.filter((response) => response.status === 429);
    assert.ok(blocked.length > 0);
  });
});
