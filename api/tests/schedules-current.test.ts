import { describe, test } from 'node:test';
import assert from 'node:assert';

import * as scheduleStorage from '../src/lib/schedule-storage.js';
import {
  oneOffGroupId,
  registerSchedulesLifecycle,
  testClassroomId,
  testGroupId,
  testTeacherId,
  weeklyGroupId,
} from './schedules-test-harness.js';

registerSchedulesLifecycle();

void describe('Schedule storage - current schedule resolution', () => {
  void test('should return null on weekends', async () => {
    await scheduleStorage.createSchedule({
      classroomId: testClassroomId,
      teacherId: testTeacherId,
      groupId: testGroupId,
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:00',
    });

    const sunday = new Date('2025-01-05T09:00:00');
    const result = await scheduleStorage.getCurrentSchedule(testClassroomId, sunday);
    assert.strictEqual(result, null);
  });

  void test('should return one-off schedule on weekends', async () => {
    const schedule = await scheduleStorage.createOneOffSchedule({
      classroomId: testClassroomId,
      teacherId: testTeacherId,
      groupId: oneOffGroupId,
      startAt: new Date(2026, 1, 28, 9, 0, 0, 0),
      endAt: new Date(2026, 1, 28, 10, 0, 0, 0),
    });

    const saturday = new Date(2026, 1, 28, 9, 15, 0, 0);
    const result = await scheduleStorage.getCurrentSchedule(testClassroomId, saturday);

    assert.ok(result);
    assert.strictEqual(result.id, schedule.id);
    assert.strictEqual(result.groupId, oneOffGroupId);
    assert.strictEqual(result.recurrence, 'one_off');
  });

  void test('one-off schedule takes precedence over weekly schedule', async () => {
    await scheduleStorage.createSchedule({
      classroomId: testClassroomId,
      teacherId: testTeacherId,
      groupId: weeklyGroupId,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
    });

    await scheduleStorage.createOneOffSchedule({
      classroomId: testClassroomId,
      teacherId: testTeacherId,
      groupId: oneOffGroupId,
      startAt: new Date(2026, 1, 23, 9, 0, 0, 0),
      endAt: new Date(2026, 1, 23, 10, 0, 0, 0),
    });

    const monday = new Date(2026, 1, 23, 9, 30, 0, 0);
    const result = await scheduleStorage.getCurrentSchedule(testClassroomId, monday);

    assert.ok(result);
    assert.strictEqual(result.groupId, oneOffGroupId);
    assert.strictEqual(result.recurrence, 'one_off');
  });

  void test('should return correct schedule for current time', async () => {
    await scheduleStorage.createSchedule({
      classroomId: testClassroomId,
      teacherId: testTeacherId,
      groupId: testGroupId,
      dayOfWeek: 3,
      startTime: '08:00',
      endTime: '09:00',
    });

    const wednesday = new Date('2025-01-08T08:30:00');
    const result = await scheduleStorage.getCurrentSchedule(testClassroomId, wednesday);

    assert.ok(result !== null);
    assert.strictEqual(result.groupId, testGroupId);
  });

  void test('should return null outside scheduled times', async () => {
    await scheduleStorage.createSchedule({
      classroomId: testClassroomId,
      teacherId: testTeacherId,
      groupId: testGroupId,
      dayOfWeek: 3,
      startTime: '08:00',
      endTime: '09:00',
    });

    const wednesday = new Date('2025-01-08T10:00:00');
    const result = await scheduleStorage.getCurrentSchedule(testClassroomId, wednesday);
    assert.strictEqual(result, null);
  });
});
