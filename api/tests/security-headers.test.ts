import { describe, test } from 'node:test';
import assert from 'node:assert';

import { registerSecurityLifecycle, request } from './security-test-harness.js';

registerSecurityLifecycle();

void describe('Security tests - HTTP headers and hardening', () => {
  void test('should include X-Content-Type-Options: nosniff', async () => {
    const { headers } = await request('/health');
    assert.strictEqual(headers.get('x-content-type-options'), 'nosniff');
  });

  void test('should include X-Frame-Options: DENY', async () => {
    const { headers } = await request('/health');
    assert.strictEqual(headers.get('x-frame-options'), 'DENY');
  });

  void test('should include Content-Security-Policy header', async () => {
    const { headers } = await request('/health');
    const csp = headers.get('content-security-policy');
    assert.ok(csp !== null && csp !== '');
    assert.ok(csp.includes('default-src'));
    assert.ok(!csp.includes('unpkg.com'));
  });
});
