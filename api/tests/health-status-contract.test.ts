import { describe, test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

import { CANONICAL_HEALTH_STATUSES } from '../src/lib/health-status.js';

void describe('health-status shared contract', () => {
  void test('matches shared contract fixture', () => {
    const fixturePath = new URL('../../tests/contracts/health-statuses.txt', import.meta.url);
    const expected = readFileSync(fixturePath, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));

    assert.deepStrictEqual(CANONICAL_HEALTH_STATUSES, expected);
  });
});
