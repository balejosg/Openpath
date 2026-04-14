import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.NODE_ENV = 'test';

await describe('classroom access service exports', async () => {
  const service = await import('../src/services/classroom-access.service.js');

  await test('exposes classroom access guards', () => {
    assert.equal(typeof service.ensureUserCanAccessClassroom, 'function');
    assert.equal(typeof service.ensureUserCanEnrollClassroom, 'function');
    assert.equal(typeof service.canAccessClassroomScope, 'function');
  });
});
