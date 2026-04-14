import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, test } from 'node:test';

await describe('machine auth scope suite compatibility contract', async () => {
  await test('split machine auth scope suites remain present for scoped machine auth regressions', () => {
    const suiteFiles = [
      'machine-auth-scope-enrollment.test.ts',
      'machine-auth-scope-boundaries.test.ts',
      'machine-auth-scope-operational.test.ts',
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
