import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.NODE_ENV = 'test';

await describe('classroom query service exports', async () => {
  const service = await import('../src/services/classroom-query.service.js');

  await test('exposes read-oriented classroom queries', () => {
    assert.equal(typeof service.listClassrooms, 'function');
    assert.equal(typeof service.getClassroom, 'function');
    assert.equal(typeof service.getStats, 'function');
    assert.equal(typeof service.listMachines, 'function');
  });
});
