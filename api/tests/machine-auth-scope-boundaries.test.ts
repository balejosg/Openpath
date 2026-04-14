import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { TEST_RUN_ID, bearerAuth } from './test-utils.js';
import {
  createClassroom,
  createGroup,
  getAdminToken,
  getEnrollmentTicket,
  registerMachine,
  registerMachineAuthScopeLifecycle,
  trpcMutate,
} from './machine-auth-scope-test-harness.js';

registerMachineAuthScopeLifecycle();

void describe('Machine authentication scope - classroom boundaries', { timeout: 45_000 }, () => {
  void test('classroom-scoped enrollment and machine tokens cannot cross classroom boundaries', async () => {
    const groupA = await createGroup(`scope-group-a-${TEST_RUN_ID}`);
    const groupB = await createGroup(`scope-group-b-${TEST_RUN_ID}`);
    const classroomA = await createClassroom(`scope-room-a-${TEST_RUN_ID}`, groupA);
    const classroomB = await createClassroom(`scope-room-b-${TEST_RUN_ID}`, groupB);

    const ticketA = await getEnrollmentTicket(classroomA, getAdminToken());
    const ticketB = await getEnrollmentTicket(classroomB, getAdminToken());

    const mismatchedRegistration = await trpcMutate(
      'classrooms.registerMachine',
      { hostname: 'scoped-a', classroomId: classroomB },
      bearerAuth(ticketA)
    );
    assert.equal(mismatchedRegistration.status, 403);

    const machineA = await registerMachine({
      classroomId: classroomA,
      hostname: 'scoped-a',
      enrollmentToken: ticketA,
    });
    const machineB = await registerMachine({
      classroomId: classroomB,
      hostname: 'scoped-b',
      enrollmentToken: ticketB,
    });

    const reportResponse = await trpcMutate(
      'healthReports.submit',
      {
        hostname: machineB.machineHostname,
        status: 'HEALTHY',
      },
      bearerAuth(machineA.machineToken)
    );
    assert.equal(reportResponse.status, 403);
  });
});
