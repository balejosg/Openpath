import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

await describe('enrollment service', async () => {
  const { issueEnrollmentTicket } = await import('../src/services/enrollment.service.js');

  await test('requires a teacher or admin role before issuing enrollment tickets', async () => {
    const result = await issueEnrollmentTicket({
      classroomId: 'classroom-1',
      user: {
        sub: 'student-1',
        email: 'student@example.com',
        name: 'Student Example',
        type: 'access',
        roles: [{ role: 'student', groupIds: [] }],
      },
    });

    assert.deepEqual(result, {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Teacher access required' },
    });
  });
});
