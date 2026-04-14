import { describe, test } from 'node:test';
import assert from 'node:assert';

import { normalizeHealthActions, normalizeHealthStatus } from '../src/lib/health-status.js';

void describe('health-status actions', () => {
  void test('tags normalization alongside reported actions', () => {
    const normalized = normalizeHealthStatus('SOMETHING_NEW');
    const actions = normalizeHealthActions('watchdog_repair', normalized);

    assert.ok(actions.includes('watchdog_repair'));
    assert.ok(actions.includes('status_normalized:SOMETHING_NEW->DEGRADED'));
  });

  void test('returns only normalization reason when actions are empty', () => {
    const normalized = normalizeHealthStatus('healthy');
    const actions = normalizeHealthActions('', normalized);

    assert.strictEqual(actions, 'status_normalized:healthy->HEALTHY');
  });
});
