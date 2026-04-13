import { randomUUID } from 'node:crypto';
import { describe, test } from 'node:test';
import assert from 'node:assert';

import { eq } from 'drizzle-orm';

import * as userStorage from '../src/lib/user-storage.js';
import { classrooms, requests, schedules, whitelistGroups } from '../src/db/index.js';
import {
  DEFAULT_PASSWORD,
  db,
  registerServiceCoverageLifecycle,
  type TestUser,
  uniqueEmail,
} from './service-coverage-test-support.js';

registerServiceCoverageLifecycle();

void describe('Coverage-oriented service tests - schema hardening', { concurrency: false }, () => {
  void test('deleting a whitelist group nulls classroom links and cascades dependent rows', async () => {
    const suffix = randomUUID().slice(0, 8);
    const groupId = `grp_${suffix}`;
    const classroomId = `room_${suffix}`;
    const requestId = `req_${suffix}`;
    const teacher = (await userStorage.createUser({
      email: uniqueEmail(`schema-hardening-${suffix}`),
      name: 'Schema Hardening Teacher',
      password: DEFAULT_PASSWORD,
    })) as TestUser;

    await db.insert(whitelistGroups).values({
      id: groupId,
      name: `group-${suffix}`,
      displayName: 'Schema Hardening Group',
    });

    await db.insert(classrooms).values({
      id: classroomId,
      name: `classroom-${suffix}`,
      displayName: 'Schema Hardening Classroom',
      defaultGroupId: groupId,
      activeGroupId: groupId,
    });

    await db.insert(requests).values({
      id: requestId,
      domain: `schema-hardening-${suffix}.example.com`,
      reason: 'FK cascade validation',
      requesterEmail: 'schema-hardening@example.com',
      groupId,
      status: 'pending',
    });

    await db.insert(schedules).values({
      id: randomUUID(),
      classroomId,
      teacherId: teacher.id,
      groupId,
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:00',
      recurrence: 'weekly',
    });

    await db.delete(whitelistGroups).where(eq(whitelistGroups.id, groupId));

    const remainingRequests = await db
      .select({ id: requests.id })
      .from(requests)
      .where(eq(requests.id, requestId));
    const remainingSchedules = await db
      .select({ groupId: schedules.groupId })
      .from(schedules)
      .where(eq(schedules.groupId, groupId));
    const updatedClassroom = (await db
      .select({
        defaultGroupId: classrooms.defaultGroupId,
        activeGroupId: classrooms.activeGroupId,
      })
      .from(classrooms)
      .where(eq(classrooms.id, classroomId))
      .limit(1)) as { defaultGroupId: string | null; activeGroupId: string | null }[];

    assert.strictEqual(remainingRequests.length, 0);
    assert.strictEqual(remainingSchedules.length, 0);
    assert.ok(updatedClassroom[0]);
    assert.strictEqual(updatedClassroom[0].defaultGroupId, null);
    assert.strictEqual(updatedClassroom[0].activeGroupId, null);
  });
});
