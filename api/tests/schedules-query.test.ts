import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';

import * as scheduleStorage from '../src/lib/schedule-storage.js';
import {
  oneOffGroupId,
  registerSchedulesLifecycle,
  secondaryGroupId,
  testClassroomId,
  testGroupId,
  testTeacherId,
} from './schedules-test-harness.js';

registerSchedulesLifecycle();

void describe('Schedule storage - query operations', () => {
  beforeEach(async () => {
    await scheduleStorage.createSchedule({
      classroomId: testClassroomId,
      teacherId: testTeacherId,
      groupId: testGroupId,
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:00',
    });
    await scheduleStorage.createSchedule({
      classroomId: testClassroomId,
      teacherId: testTeacherId,
      groupId: secondaryGroupId,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
    });

    await scheduleStorage.createOneOffSchedule({
      classroomId: testClassroomId,
      teacherId: testTeacherId,
      groupId: oneOffGroupId,
      startAt: new Date(2026, 1, 23, 11, 0, 0, 0),
      endAt: new Date(2026, 1, 23, 12, 0, 0, 0),
    });
  });

  void test('should get schedules by classroom', async () => {
    const weeklySchedules = await scheduleStorage.getSchedulesByClassroom(testClassroomId);
    assert.strictEqual(weeklySchedules.length, 2);
  });

  void test('should get one-off schedules by classroom', async () => {
    const oneOffSchedules = await scheduleStorage.getOneOffSchedulesByClassroom(testClassroomId);
    assert.strictEqual(oneOffSchedules.length, 1);
    assert.strictEqual(oneOffSchedules[0]?.recurrence, 'one_off');
  });

  void test('should get schedules by teacher', async () => {
    const weeklySchedules = await scheduleStorage.getSchedulesByTeacher(testTeacherId);
    assert.strictEqual(weeklySchedules.length, 2);
    assert.strictEqual(weeklySchedules[0]?.teacherId, testTeacherId);
  });

  void test('should get one-off schedules by teacher', async () => {
    const oneOffSchedules = await scheduleStorage.getOneOffSchedulesByTeacher(testTeacherId);
    assert.strictEqual(oneOffSchedules.length, 1);
    assert.strictEqual(oneOffSchedules[0]?.recurrence, 'one_off');
  });
});
