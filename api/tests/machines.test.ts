import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, test } from 'node:test';

await describe('machines suite compatibility contract', async () => {
  await test('split machine route suites remain present', () => {
    const suiteFiles = [
      'machines-enrollment-routes.test.ts',
      'machines-delivery-routes.test.ts',
      'machines-events-routes.test.ts',
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
