import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildOpenPathPromotionContract,
  serializeOpenPathPromotionContract,
} from '../scripts/openpath-promotion-contract.mjs';

describe('OpenPath promotion contract', () => {
  test('builds a standalone promotion contract for an exact OpenPath SHA', () => {
    const contract = buildOpenPathPromotionContract({
      openpathSha: '0123456789abcdef0123456789abcdef01234567',
      packageVersion: '0.0.412',
      linuxAgentVersion: '0.0.412',
      aptSuite: 'unstable',
      firefoxExtensionVersion: '4.1.25',
      browserPolicySpecSha256: 'meta123',
    });

    assert.deepEqual(contract, {
      version: 1,
      openpathSha: '0123456789abcdef0123456789abcdef01234567',
      packageVersion: '0.0.412',
      linuxAgentVersion: '0.0.412',
      aptSuite: 'unstable',
      firefoxExtensionVersion: '4.1.25',
      browserPolicySpecSha256: 'meta123',
    });
  });

  test('serializes the promotion contract as stable JSON', () => {
    const serialized = serializeOpenPathPromotionContract({
      version: 1,
      openpathSha: '0123456789abcdef0123456789abcdef01234567',
      packageVersion: '4.1.25',
      linuxAgentVersion: '4.1.25',
      aptSuite: 'stable',
      firefoxExtensionVersion: '4.1.25',
      browserPolicySpecSha256: 'meta123',
    });

    assert.equal(
      serialized,
      `${JSON.stringify(
        {
          version: 1,
          openpathSha: '0123456789abcdef0123456789abcdef01234567',
          packageVersion: '4.1.25',
          linuxAgentVersion: '4.1.25',
          aptSuite: 'stable',
          firefoxExtensionVersion: '4.1.25',
          browserPolicySpecSha256: 'meta123',
        },
        null,
        2
      )}\n`
    );
  });
});
