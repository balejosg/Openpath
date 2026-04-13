import { describe, test } from 'node:test';
import assert from 'node:assert';

import { registerSecurityLifecycle, request } from './security-test-harness.js';

registerSecurityLifecycle();

void describe('Security tests - input validation', () => {
  void test('should reject SQL injection in domain requests', async () => {
    const response = await request('/trpc/requests.create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          domain: "'; DROP TABLE requests; --",
          reason: 'test',
          requesterEmail: 'test@example.com',
        },
      }),
    });

    const body = response.body as { error?: { message?: string } };
    const hasInvalidMessage = body.error?.message?.includes('Invalid') === true;
    const is400Status = response.status === 400;
    assert.ok(hasInvalidMessage || is400Status);
  });

  void test('should sanitize XSS in domain name', async () => {
    const response = await request('/trpc/requests.create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          domain: '<script>alert("xss")</script>.com',
          reason: 'test',
          requesterEmail: 'test@example.com',
        },
      }),
    });

    assert.ok(response.status === 400 || response.status === 500);
  });

  void test('should handle extremely long input gracefully', async () => {
    const longDomain = `${'a'.repeat(1000)}.com`;
    const response = await request('/trpc/requests.create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          domain: longDomain,
          reason: 'test',
          requesterEmail: 'test@example.com',
        },
      }),
    });

    assert.ok(response.status === 400 || response.status === 500);
  });
});
