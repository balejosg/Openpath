import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.NODE_ENV = 'test';

await describe('classroom service shared helpers', async () => {
  const shared = await import('../src/services/classroom-service-shared.js');

  await test('normalizes unexpected group source values to none', () => {
    assert.equal(shared.normalizeCurrentGroupSource('unexpected'), 'none');
    assert.equal(shared.normalizeCurrentGroupSource('manual'), 'manual');
  });

  await test('maps machine state to dashboard shape', () => {
    const machine = shared.toMachineInfo({
      id: 'machine-1',
      hostname: 'lab-01',
      lastSeen: new Date(),
    });

    assert.equal(machine.id, 'machine-1');
    assert.equal(machine.hostname, 'lab-01');
    assert.ok(typeof machine.status === 'string');
  });
});
