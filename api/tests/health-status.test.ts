import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, test } from 'node:test';

await describe('health status suite compatibility contract', async () => {
  await test('split health status suites remain present', () => {
    const suiteFiles = [
      'health-status-normalization.test.ts',
      'health-status-actions.test.ts',
      'health-status-contract.test.ts',
    ];

    for (const suiteFile of suiteFiles) {
      assert.equal(
        fs.existsSync(new URL(`./${suiteFile}`, import.meta.url)),
        true,
        `${suiteFile} is missing`
      );
    }
  });
});
