import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

void test('native host probes the installed OpenPath CLI before legacy whitelist command', () => {
  const source = readFileSync(
    new URL('../native/openpath-native-host.py', import.meta.url),
    'utf8'
  );

  const openpathIndex = source.indexOf('"/usr/local/bin/openpath"');
  const legacyIndex = source.indexOf('"/usr/local/bin/whitelist"');

  assert.notEqual(openpathIndex, -1);
  assert.notEqual(legacyIndex, -1);
  assert.ok(openpathIndex < legacyIndex);
  assert.doesNotMatch(source, /^WHITELIST_CMD = "\/usr\/local\/bin\/whitelist"$/m);
});
