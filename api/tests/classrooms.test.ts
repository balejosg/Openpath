import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, test } from 'node:test';

await describe('classrooms suite compatibility contract', async () => {
  await test('split classroom suites remain present for the classrooms router', () => {
    const suiteFiles = [
      'classroom-authorization.test.ts',
      'classroom-policy-context.test.ts',
      'classroom-status.test.ts',
      'classrooms-cleanup.test.ts',
      'classrooms-crud.test.ts',
      'classrooms-machines.test.ts',
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
