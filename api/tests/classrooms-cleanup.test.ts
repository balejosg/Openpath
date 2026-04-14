import { after, before, describe, test } from 'node:test';
import assert from 'node:assert';

import {
  type ClassroomsTestHarness,
  startClassroomsTestHarness,
  uniqueClassroomName,
} from './classrooms-test-harness.js';
import { assertStatus, bearerAuth } from './test-utils.js';

let harness: ClassroomsTestHarness | undefined;

function getHarness(): ClassroomsTestHarness {
  assert.ok(harness, 'Classrooms harness should be initialized');
  return harness;
}

void describe('Classroom management - cleanup', () => {
  before(async () => {
    harness = await startClassroomsTestHarness();
  });

  after(async () => {
    await harness?.close();
    harness = undefined;
  });

  void test('classrooms.delete removes a classroom', async (): Promise<void> => {
    const classroom = await getHarness().createClassroom({
      name: uniqueClassroomName('cleanup-room'),
    });

    const response = await getHarness().trpcMutate(
      'classrooms.delete',
      { id: classroom.id },
      bearerAuth(getHarness().adminToken)
    );
    assertStatus(response, 200);

    const classrooms = await getHarness().getClassrooms();
    assert.strictEqual(
      classrooms.some((entry) => entry.id === classroom.id),
      false
    );
  });
});
