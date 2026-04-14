import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { TEST_RUN_ID } from './test-utils.js';
import {
  createClassroom,
  createGroup,
  createUser,
  getApiUrl,
  registerMachine,
  registerMachineAuthScopeLifecycle,
  requestEnrollmentTicket,
} from './machine-auth-scope-test-harness.js';

registerMachineAuthScopeLifecycle();

void describe('Machine authentication scope - enrollment flows', { timeout: 45_000 }, () => {
  void test('teacher cannot mint an enrollment token for another classroom', async () => {
    const allowedGroupId = await createGroup(`allowed-group-${TEST_RUN_ID}`);
    const deniedGroupId = await createGroup(`denied-group-${TEST_RUN_ID}`);
    const allowedClassroomId = await createClassroom(`allowed-room-${TEST_RUN_ID}`, allowedGroupId);
    const deniedClassroomId = await createClassroom(`denied-room-${TEST_RUN_ID}`, deniedGroupId);

    const teacher = await createUser({
      prefix: 'teacher-scope-ticket',
      role: 'teacher',
      groupIds: [allowedGroupId],
    });

    const allowedResponse = await requestEnrollmentTicket(
      allowedClassroomId,
      teacher.accessToken,
      2
    );
    assert.equal(allowedResponse.status, 200);

    const deniedResponse = await requestEnrollmentTicket(deniedClassroomId, teacher.accessToken);
    assert.equal(deniedResponse.status, 403);
  });

  void test('teacher can mint an enrollment token and register a machine for a groupless classroom', async () => {
    const grouplessClassroomId = await createClassroom(`groupless-room-${TEST_RUN_ID}`);

    const teacher = await createUser({
      prefix: 'teacher-groupless-ticket',
      role: 'teacher',
      groupIds: [],
    });

    const ticketResponse = await requestEnrollmentTicket(grouplessClassroomId, teacher.accessToken);
    assert.equal(ticketResponse.status, 200);

    const ticketData = (await ticketResponse.json()) as { enrollmentToken?: string };
    assert.ok(ticketData.enrollmentToken);

    const registration = await registerMachine({
      classroomId: grouplessClassroomId,
      hostname: 'pc-groupless-01',
      enrollmentToken: ticketData.enrollmentToken,
    });

    assert.equal(registration.machineHostname.includes('pc-groupless-01'), true);

    const whitelistResponse = await fetch(
      `${getApiUrl()}/w/${encodeURIComponent(registration.machineToken)}/whitelist.txt`
    );
    assert.equal(whitelistResponse.status, 200);
    assert.equal(await whitelistResponse.text(), '#DESACTIVADO\n');

    const contextResponse = await fetch(
      `${getApiUrl()}/api/test-support/machine-context/${encodeURIComponent(registration.machineHostname)}`,
      {
        headers: { Authorization: `Bearer ${teacher.accessToken}` },
      }
    );
    assert.equal(contextResponse.status, 200);

    const contextData = (await contextResponse.json()) as {
      context?: { groupId?: string | null };
      effectiveContext?: {
        classroomId?: string;
        groupId?: string | null;
        mode?: string;
        reason?: string;
      };
    };

    assert.equal(contextData.context?.groupId, '__unrestricted__');
    const effectiveContext = contextData.effectiveContext;
    assert.ok(effectiveContext);
    assert.equal(effectiveContext.mode, 'unrestricted');
    assert.equal(effectiveContext.reason, 'none');
    assert.equal(effectiveContext.groupId, null);
    assert.equal(effectiveContext.classroomId, grouplessClassroomId);

    const eventsResponse = await fetch(`${getApiUrl()}/api/machines/events`, {
      headers: { Authorization: `Bearer ${registration.machineToken}` },
    });
    assert.equal(eventsResponse.status, 200);
    await eventsResponse.body?.cancel();
  });
});
