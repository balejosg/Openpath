import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, test } from 'node:test';

await describe('integration suite compatibility contract', async () => {
  await test('split integration workflow suites remain present', () => {
    const suiteFiles = [
      'integration-user-workflow.test.ts',
      'integration-health-report.test.ts',
      'integration-classroom-management.test.ts',
      'integration-domain-request.test.ts',
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
