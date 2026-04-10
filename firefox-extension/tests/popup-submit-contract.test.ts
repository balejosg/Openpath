import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

void describe('popup submit contract', () => {
  void test('delegates blocked-domain request submission to the background script', () => {
    const popupSource = readFileSync(new URL('../src/popup.ts', import.meta.url), 'utf8');

    assert.match(popupSource, /buildSubmitBlockedDomainRequestMessage/);
    assert.doesNotMatch(popupSource, /action:\s*'getHostname'/);
    assert.doesNotMatch(popupSource, /action:\s*'getMachineToken'/);
    assert.doesNotMatch(popupSource, /\/api\/requests\/submit/);
    assert.doesNotMatch(popupSource, /checkRequestApiAvailable/);
    assert.doesNotMatch(popupSource, /isRequestApiAvailable/);
  });
});
