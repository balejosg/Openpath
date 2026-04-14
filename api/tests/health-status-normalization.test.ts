import { describe, test } from 'node:test';
import assert from 'node:assert';

import { normalizeHealthStatus, PROBLEM_HEALTH_STATUSES } from '../src/lib/health-status.js';

void describe('health-status normalization', () => {
  void test('keeps canonical status values', () => {
    const normalized = normalizeHealthStatus('HEALTHY');

    assert.strictEqual(normalized.status, 'HEALTHY');
    assert.strictEqual(normalized.wasNormalized, false);
    assert.strictEqual(normalized.source, 'HEALTHY');
  });

  void test('maps legacy status values', () => {
    assert.strictEqual(normalizeHealthStatus('OK').status, 'HEALTHY');
    assert.strictEqual(normalizeHealthStatus('WARNING').status, 'DEGRADED');
    assert.strictEqual(normalizeHealthStatus('error').status, 'CRITICAL');
    assert.strictEqual(normalizeHealthStatus('RECOVERED').status, 'DEGRADED');
    assert.strictEqual(normalizeHealthStatus('FAILED').status, 'CRITICAL');
  });

  void test('maps unknown statuses to DEGRADED', () => {
    const normalized = normalizeHealthStatus('SOMETHING_NEW');

    assert.strictEqual(normalized.status, 'DEGRADED');
    assert.strictEqual(normalized.wasNormalized, true);
  });

  void test('problem status set does not include HEALTHY', () => {
    assert.strictEqual(PROBLEM_HEALTH_STATUSES.has('HEALTHY'), false);
    assert.strictEqual(PROBLEM_HEALTH_STATUSES.has('CRITICAL'), true);
    assert.strictEqual(PROBLEM_HEALTH_STATUSES.has('DEGRADED'), true);
  });
});
