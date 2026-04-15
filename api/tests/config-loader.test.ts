import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { loadConfig } from '../src/config-loader.js';

void describe('config loader', () => {
  void test('normalizes the legacy GitHub Pages APT repository override to the raw gh-pages origin', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      APT_REPO_URL: 'https://balejosg.github.io/openpath/apt',
    });

    assert.equal(
      config.aptRepoUrl,
      'https://raw.githubusercontent.com/balejosg/openpath/gh-pages/apt'
    );
  });
});
