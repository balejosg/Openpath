import { after, beforeEach } from 'node:test';

import { db } from '../src/db/index.js';
import { classrooms, users } from '../src/db/schema.js';
import { closeConnection } from '../src/db/index.js';
import { CANONICAL_GROUP_IDS } from './fixtures.js';
import { resetDb } from './test-utils.js';

export const testClassroomId = 'test-classroom-1';
export const testTeacherId = 'teacher-1';
export const defaultClassroomGroupId = CANONICAL_GROUP_IDS.default;
export const testGroupId = CANONICAL_GROUP_IDS.groupA;
export const secondaryGroupId = CANONICAL_GROUP_IDS.groupB;
export const oneOffGroupId = CANONICAL_GROUP_IDS.groupC;
export const weeklyGroupId = CANONICAL_GROUP_IDS.groupZ;

export function registerSchedulesLifecycle(): void {
  beforeEach(async () => {
    await resetDb();

    await db.insert(users).values({
      id: testTeacherId,
      email: 'teacher@test.com',
      name: 'Test Teacher',
      passwordHash: 'hash',
    });

    await db.insert(classrooms).values({
      id: testClassroomId,
      name: 'test-classroom',
      displayName: 'Test Classroom',
      defaultGroupId: defaultClassroomGroupId,
    });
  });

  after(async () => {
    await closeConnection();
  });
}

export { db };
