import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as scheduleCommandService from '../src/services/schedule-command.service.js';

void test('schedule-command service exports expected mutation entrypoints', () => {
  assert.equal(typeof scheduleCommandService.createSchedule, 'function');
  assert.equal(typeof scheduleCommandService.updateSchedule, 'function');
  assert.equal(typeof scheduleCommandService.deleteSchedule, 'function');
});
