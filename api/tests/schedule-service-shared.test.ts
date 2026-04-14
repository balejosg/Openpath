import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  mapToOneOffSchedule,
  mapToWeeklySchedule,
} from '../src/services/schedule-service-shared.js';

test('schedule-service-shared maps weekly and one-off schedules', () => {
  const weekly = mapToWeeklySchedule({
    id: 'schedule-weekly',
    classroomId: 'classroom-1',
    dayOfWeek: 2,
    startTime: '08:00:00',
    endTime: '09:15:00',
    startAt: null,
    endAt: null,
    groupId: 'group-a',
    teacherId: 'teacher-1',
    recurrence: 'weekly',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
  });
  const oneOff = mapToOneOffSchedule({
    id: 'schedule-oneoff',
    classroomId: 'classroom-1',
    dayOfWeek: null,
    startTime: null,
    endTime: null,
    startAt: new Date('2026-01-02T10:00:00.000Z'),
    endAt: new Date('2026-01-02T11:00:00.000Z'),
    groupId: 'group-b',
    teacherId: 'teacher-2',
    recurrence: 'one_off',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
  });

  assert.equal(weekly.startTime, '08:00');
  assert.equal(oneOff.recurrence, 'one_off');
});
