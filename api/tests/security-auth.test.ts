import { describe, test } from 'node:test';
import assert from 'node:assert';

import { registerSecurityLifecycle, request } from './security-test-harness.js';

registerSecurityLifecycle();

void describe('Security tests - authentication hardening', () => {
  void test('enforces rate limiting on auth endpoints', async () => {
    const responses = await Promise.all(
      Array.from({ length: 11 }, () =>
        request('/trpc/auth.login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'rate@limit.com',
            password: 'password123',
          }),
        })
      )
    );

    const blocked = responses.filter((response) => response.status === 429);
    assert.ok(blocked.length > 0);
  });

  void test('should reject access to private routes without token', async () => {
    const response = await request('/trpc/users.list');
    assert.strictEqual(response.status, 401);
  });

  void test('should reject invalid auth token format', async () => {
    const response = await request('/trpc/users.list', {
      headers: { Authorization: 'InvalidFormat token123' },
    });
    assert.strictEqual(response.status, 401);
  });

  void test('should reject malformed JWT token', async () => {
    const response = await request('/trpc/users.list', {
      headers: { Authorization: 'Bearer not.a.valid.jwt.token' },
    });
    assert.strictEqual(response.status, 401);
  });

  void test('should reject expired token signature', async () => {
    const fakeToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidHlwZSI6ImFjY2VzcyJ9.invalid_signature';
    const response = await request('/trpc/users.list', {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    assert.strictEqual(response.status, 401);
  });

  void test('should reject the legacy ADMIN_TOKEN fallback for private tRPC routes', async () => {
    const previousAdminToken = process.env.ADMIN_TOKEN;
    process.env.ADMIN_TOKEN = 'legacy-admin-token';

    try {
      const response = await request('/trpc/users.list', {
        headers: { Authorization: 'Bearer legacy-admin-token' },
      });
      assert.strictEqual(response.status, 401);
    } finally {
      if (previousAdminToken === undefined) {
        Reflect.deleteProperty(process.env, 'ADMIN_TOKEN');
      } else {
        process.env.ADMIN_TOKEN = previousAdminToken;
      }
    }
  });

  void test('should reject the legacy ADMIN_TOKEN fallback for admin setup REST routes', async () => {
    const email = `setup-rest-${Date.now().toString()}@example.com`;
    const forwardedFor = '198.51.100.77';
    const bootstrapResponse = await request('/api/setup/first-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': forwardedFor,
      },
      body: JSON.stringify({
        email,
        name: 'Setup REST Admin',
        password: 'SecurePassword123!',
      }),
    });
    assert.strictEqual(bootstrapResponse.status, 200);

    const previousAdminToken = process.env.ADMIN_TOKEN;
    process.env.ADMIN_TOKEN = 'legacy-admin-token';

    try {
      const registrationTokenResponse = await request('/api/setup/registration-token', {
        headers: {
          Authorization: 'Bearer legacy-admin-token',
          'X-Forwarded-For': forwardedFor,
        },
      });
      assert.strictEqual(registrationTokenResponse.status, 401);

      const regenerateTokenResponse = await request('/api/setup/regenerate-token', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer legacy-admin-token',
          'X-Forwarded-For': forwardedFor,
        },
      });
      assert.strictEqual(regenerateTokenResponse.status, 401);
    } finally {
      if (previousAdminToken === undefined) {
        Reflect.deleteProperty(process.env, 'ADMIN_TOKEN');
      } else {
        process.env.ADMIN_TOKEN = previousAdminToken;
      }
    }
  });
});
