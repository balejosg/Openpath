import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { resetDb, TEST_RUN_ID } from './test-utils.js';
import { createScheduleBoundaryTicker } from '../src/lib/schedule-boundary-ticker.js';
import * as classroomStorage from '../src/lib/classroom-storage.js';
import * as scheduleStorage from '../src/lib/schedule-storage.js';

await describe('Schedule Boundary Ticker', async () => {
  beforeEach(async () => {
    await resetDb();
  });

  await test('runTickOnce emits classroom IDs with boundary at HH:MM', async () => {
    const classroom = await classroomStorage.createClassroom({
      name: `ticker-room-${TEST_RUN_ID}`,
      displayName: 'Ticker Room',
    });

    await scheduleStorage.createSchedule({
      classroomId: classroom.id,
      teacherId: 'legacy_admin',
      groupId: 'group-a',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
    });

    const events: { classroomId: string; now: Date }[] = [];
    const ticker = createScheduleBoundaryTicker({
      emitClassroomChanged: (classroomId: string, now: Date) => {
        events.push({ classroomId, now });
      },
    });

    const boundaryNow = new Date(2026, 1, 23, 9, 0, 0); // Monday 09:00 local
    await ticker.runTickOnce(boundaryNow);

    assert.strictEqual(events.length, 1);
    const first = events[0];
    assert.ok(first);
    assert.strictEqual(first.classroomId, classroom.id);
  });

  await test('runTickOnce emits classroom IDs at one-off schedule startAt/endAt', async () => {
    const classroom = await classroomStorage.createClassroom({
      name: `ticker-oneoff-room-${TEST_RUN_ID}`,
      displayName: 'Ticker OneOff Room',
    });

    const startAt = new Date(2026, 1, 23, 11, 0, 0, 0);
    const endAt = new Date(2026, 1, 23, 12, 0, 0, 0);

    await scheduleStorage.createOneOffSchedule({
      classroomId: classroom.id,
      teacherId: 'legacy_admin',
      groupId: 'group-b',
      startAt,
      endAt,
    });

    const events: { classroomId: string; now: Date }[] = [];
    const ticker = createScheduleBoundaryTicker({
      emitClassroomChanged: (classroomId: string, now: Date) => {
        events.push({ classroomId, now });
      },
    });

    await ticker.runTickOnce(startAt);
    assert.strictEqual(events.length, 1);
    const atStart = events[0];
    assert.ok(atStart);
    assert.strictEqual(atStart.classroomId, classroom.id);

    events.length = 0;
    await ticker.runTickOnce(endAt);
    assert.strictEqual(events.length, 1);
    const atEnd = events[0];
    assert.ok(atEnd);
    assert.strictEqual(atEnd.classroomId, classroom.id);
  });
});
