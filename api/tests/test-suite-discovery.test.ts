import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';

import { resolveTestInputs } from '../scripts/test-suite-discovery.js';

const sandboxDir = mkdtempSync(join(tmpdir(), 'openpath-test-suite-discovery-'));

after(() => {
  rmSync(sandboxDir, { force: true, recursive: true });
});

function seedFixture(relativePath: string): void {
  const absolutePath = join(sandboxDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, '// fixture\n', 'utf8');
}

seedFixture('tests/auth-registration.test.ts');
seedFixture('tests/auth-google-login.test.ts');
seedFixture('tests/nested/token-delivery-core.test.ts');
seedFixture('tests/nested/token-delivery-linux-agent.test.ts');
seedFixture('tests/nested/helper.ts');

void describe('resolveTestInputs', () => {
  void test('expands glob patterns into a sorted list of matching test files', () => {
    const result = resolveTestInputs(['tests/auth-*.test.ts'], { cwd: sandboxDir });

    assert.deepEqual(result, [
      'tests/auth-google-login.test.ts',
      'tests/auth-registration.test.ts',
    ]);
  });

  void test('expands directories and ignores non-test files', () => {
    const result = resolveTestInputs(['tests/nested'], { cwd: sandboxDir });

    assert.deepEqual(result, [
      'tests/nested/token-delivery-core.test.ts',
      'tests/nested/token-delivery-linux-agent.test.ts',
    ]);
  });

  void test('deduplicates overlapping explicit files, directories, and patterns', () => {
    const result = resolveTestInputs(
      ['tests/nested', 'tests/nested/token-delivery-core.test.ts', 'tests/**/*.test.ts'],
      { cwd: sandboxDir }
    );

    assert.deepEqual(result, [
      'tests/auth-google-login.test.ts',
      'tests/auth-registration.test.ts',
      'tests/nested/token-delivery-core.test.ts',
      'tests/nested/token-delivery-linux-agent.test.ts',
    ]);
  });
});
