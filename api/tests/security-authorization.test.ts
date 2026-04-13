import { describe, test } from 'node:test';
import assert from 'node:assert';

import { CANONICAL_GROUP_IDS } from './fixtures.js';
import { createAccessToken, registerSecurityLifecycle, request } from './security-test-harness.js';

registerSecurityLifecycle();

void describe('Security tests - authorization boundaries', () => {
  void test('prevents students from approving requests', async () => {
    const domain = `student-test-${Date.now().toString()}.com`;
    const createResp = await request('/trpc/requests.create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        reason: 'test',
        requesterEmail: 'student@school.edu',
        groupId: CANONICAL_GROUP_IDS.groupA,
      }),
    });
    assert.strictEqual(createResp.status, 200);
    const requestId = (createResp.body as { result: { data: { id: string } } }).result.data.id;

    const studentToken = await createAccessToken({
      sub: 'student-1',
      email: 'student@school.edu',
      name: 'Student',
      roles: [{ role: 'student', groupIds: [CANONICAL_GROUP_IDS.groupA] }],
    });

    const approveResp = await request('/trpc/requests.approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ id: requestId }),
    });

    assert.strictEqual(approveResp.status, 403);
  });

  void test('prevents cross-group access', async () => {
    const domain = `group-b-test-${Date.now().toString()}.com`;
    const createResp = await request('/trpc/requests.create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        reason: 'test',
        requesterEmail: 'user@school.edu',
        groupId: CANONICAL_GROUP_IDS.groupB,
      }),
    });
    assert.strictEqual(createResp.status, 200);
    const requestId = (createResp.body as { result: { data: { id: string } } }).result.data.id;

    const teacherToken = await createAccessToken({
      sub: 'teacher-1',
      email: 'teacher@school.edu',
      name: 'Teacher',
      roles: [{ role: 'teacher', groupIds: [CANONICAL_GROUP_IDS.groupA] }],
    });

    const approveResp = await request('/trpc/requests.approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({ id: requestId }),
    });

    assert.strictEqual(approveResp.status, 403);
  });

  void test('rejects cookie-authenticated mutations without a trusted origin', async () => {
    const response = await request('/trpc/auth.logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'op_access=fake-access; op_refresh=fake-refresh',
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 403);
    const body = response.body as { code?: string; error?: string };
    assert.strictEqual(body.code, 'FORBIDDEN');
    assert.match(body.error ?? '', /csrf origin/i);
  });

  void test('allows trusted-origin cookie mutations to continue past CSRF checks', async () => {
    const response = await request('/trpc/auth.logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'op_access=fake-access; op_refresh=fake-refresh',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({}),
    });

    assert.notStrictEqual(response.status, 403);
  });
});
