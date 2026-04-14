import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, test } from 'node:test';

await describe('groups suite compatibility contract', async () => {
  await test('split group suites remain present for the groups router', () => {
    const suiteFiles = [
      'groups-auth.test.ts',
      'groups-disabled-export.test.ts',
      'groups-export.test.ts',
      'groups-rule-ops.test.ts',
      'groups-teacher-access.test.ts',
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
