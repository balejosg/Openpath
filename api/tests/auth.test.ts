import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, test } from 'node:test';

await describe('auth suite compatibility contract', async () => {
  await test('split auth suites remain present for the auth router and helpers', () => {
    const suiteFiles = [
      'auth-admin-guards.test.ts',
      'auth-google-login.test.ts',
      'auth-password.test.ts',
      'auth-registration.test.ts',
      'auth-session.test.ts',
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
