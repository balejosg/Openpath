import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, test } from 'node:test';

await describe('schedules suite compatibility contract', async () => {
  await test('split schedule suites remain present for the schedules router', () => {
    const suiteFiles = [
      'schedules-crud.test.ts',
      'schedules-current.test.ts',
      'schedules-query.test.ts',
      'schedules-time-utils.test.ts',
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
