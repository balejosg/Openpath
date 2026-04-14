import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as scheduleQueryService from '../src/services/schedule-query.service.js';

void test('schedule-query service exports expected query entrypoints', () => {
  assert.equal(typeof scheduleQueryService.getSchedulesByClassroom, 'function');
  assert.equal(typeof scheduleQueryService.getCurrentSchedule, 'function');
  assert.equal(typeof scheduleQueryService.getSchedulesByTeacher, 'function');
});
