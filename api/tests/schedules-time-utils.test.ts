import { describe, test } from 'node:test';
import assert from 'node:assert';

import * as scheduleStorage from '../src/lib/schedule-storage.js';

void describe('Schedule storage - time utilities', () => {
  void test('should convert time string to minutes', () => {
    assert.strictEqual(scheduleStorage.timeToMinutes('00:00'), 0);
    assert.strictEqual(scheduleStorage.timeToMinutes('01:00'), 60);
    assert.strictEqual(scheduleStorage.timeToMinutes('08:30'), 510);
    assert.strictEqual(scheduleStorage.timeToMinutes('23:59'), 1439);
  });

  void test('should detect overlapping time ranges', () => {
    assert.strictEqual(scheduleStorage.timesOverlap('08:00', '09:00', '09:00', '10:00'), false);
    assert.strictEqual(scheduleStorage.timesOverlap('08:00', '09:00', '10:00', '11:00'), false);
    assert.strictEqual(scheduleStorage.timesOverlap('08:00', '09:00', '08:30', '09:30'), true);
    assert.strictEqual(scheduleStorage.timesOverlap('08:00', '10:00', '09:00', '09:30'), true);
    assert.strictEqual(scheduleStorage.timesOverlap('08:00', '09:00', '08:00', '09:00'), true);
  });
});
