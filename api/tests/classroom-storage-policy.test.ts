import assert from 'node:assert/strict';
import test from 'node:test';

const ClassroomStoragePolicy = await import('../src/lib/classroom-storage-policy.js');

await test('classroom-storage policy module exposes policy resolution entrypoints', () => {
  assert.equal(typeof ClassroomStoragePolicy.resolveMachineGroupContext, 'function');
  assert.equal(typeof ClassroomStoragePolicy.resolveClassroomPolicyScope, 'function');
  assert.equal(typeof ClassroomStoragePolicy.resolveClassroomPolicyScopesForClassrooms, 'function');
  assert.equal(typeof ClassroomStoragePolicy.resolveEffectiveClassroomPolicyContext, 'function');
  assert.equal(typeof ClassroomStoragePolicy.resolveEffectiveMachinePolicyContext, 'function');
  assert.equal(typeof ClassroomStoragePolicy.resolveMachineEnforcementContext, 'function');
  assert.equal(
    typeof ClassroomStoragePolicy.resolveEffectiveMachineEnforcementPolicyContext,
    'function'
  );
  assert.equal(typeof ClassroomStoragePolicy.getWhitelistUrlForMachine, 'function');
});
