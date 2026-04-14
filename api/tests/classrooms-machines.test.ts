import { after, before, describe, test } from 'node:test';
import assert from 'node:assert';

import {
  type ClassroomsTestHarness,
  startClassroomsTestHarness,
  uniqueClassroomName,
} from './classrooms-test-harness.js';
import { assertStatus, bearerAuth, parseTRPC } from './test-utils.js';

let harness: ClassroomsTestHarness | undefined;

function getHarness(): ClassroomsTestHarness {
  assert.ok(harness, 'Classrooms harness should be initialized');
  return harness;
}

void describe('Classroom management - machine enrollment', () => {
  before(async () => {
    harness = await startClassroomsTestHarness();
  });

  after(async () => {
    await harness?.close();
    harness = undefined;
  });

  void test('classrooms.registerMachine registers a computer via enrollment token', async (): Promise<void> => {
    const classroom = await getHarness().createClassroom({
      name: uniqueClassroomName('machines-room'),
    });

    const enrollmentToken = await getHarness().createEnrollmentToken(classroom.id);
    const response = await getHarness().trpcMutate(
      'classrooms.registerMachine',
      {
        hostname: 'pc-01',
        classroomName: classroom.name,
      },
      bearerAuth(enrollmentToken)
    );

    assertStatus(response, 200);
    const payload = (await parseTRPC(response)) as { data?: { machine?: { hostname?: string } } };
    assert.strictEqual(payload.data?.machine?.hostname, 'pc-01');

    const getResponse = await getHarness().trpcQuery(
      'classrooms.get',
      { id: classroom.id },
      bearerAuth(getHarness().adminToken)
    );
    assertStatus(getResponse, 200);
    const classroomPayload = (await parseTRPC(getResponse)) as { data?: { machines?: unknown[] } };
    assert.strictEqual(classroomPayload.data?.machines?.length, 1);
  });
});
