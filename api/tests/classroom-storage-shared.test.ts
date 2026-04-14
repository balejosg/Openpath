import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMachineKey,
  machineHostnameMatches,
  serializePolicyGroupId,
} from '../src/lib/classroom-storage-shared.js';

await test('classroom-storage shared helpers normalize machine and policy values', () => {
  const machineKey = buildMachineKey('classroom-1', ' Lab-PC-01 ');
  assert.ok(machineKey.includes('--'));

  assert.equal(
    machineHostnameMatches({ hostname: 'lab-pc-01', reportedHostname: 'Lab-PC-01 ' }, 'lab-pc-01'),
    true
  );
  assert.equal(serializePolicyGroupId({ mode: 'grouped', groupId: 'group-1' }), 'group-1');
  assert.ok(serializePolicyGroupId({ mode: 'unrestricted', groupId: null }) !== null);
});
