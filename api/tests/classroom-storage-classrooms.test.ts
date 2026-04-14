import assert from 'node:assert/strict';
import test from 'node:test';

const ClassroomStorageClassrooms = await import('../src/lib/classroom-storage-classrooms.js');

await test('classroom-storage classrooms module exposes classroom entrypoints', () => {
  assert.equal(typeof ClassroomStorageClassrooms.getAllClassrooms, 'function');
  assert.equal(typeof ClassroomStorageClassrooms.getClassroomById, 'function');
  assert.equal(typeof ClassroomStorageClassrooms.getClassroomByName, 'function');
  assert.equal(typeof ClassroomStorageClassrooms.createClassroom, 'function');
  assert.equal(typeof ClassroomStorageClassrooms.updateClassroom, 'function');
  assert.equal(typeof ClassroomStorageClassrooms.setActiveGroup, 'function');
  assert.equal(typeof ClassroomStorageClassrooms.deleteClassroom, 'function');
  assert.equal(typeof ClassroomStorageClassrooms.getStats, 'function');
});
