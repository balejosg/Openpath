import assert from 'node:assert/strict';
import test from 'node:test';

const ClassroomStorageMachines = await import('../src/lib/classroom-storage-machines.js');

await test('classroom-storage machines module exposes machine entrypoints', () => {
  assert.equal(typeof ClassroomStorageMachines.getAllMachines, 'function');
  assert.equal(typeof ClassroomStorageMachines.getMachineById, 'function');
  assert.equal(typeof ClassroomStorageMachines.getMachineByHostname, 'function');
  assert.equal(typeof ClassroomStorageMachines.registerMachine, 'function');
  assert.equal(typeof ClassroomStorageMachines.updateMachineLastSeen, 'function');
  assert.equal(typeof ClassroomStorageMachines.deleteMachine, 'function');
  assert.equal(typeof ClassroomStorageMachines.getMachineByDownloadTokenHash, 'function');
  assert.equal(typeof ClassroomStorageMachines.setMachineDownloadTokenHash, 'function');
  assert.equal(typeof ClassroomStorageMachines.getMachineTokenStatus, 'function');
});
