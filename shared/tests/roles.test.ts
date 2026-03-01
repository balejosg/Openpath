import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeUserRoleString } from '../src/roles.js';

describe('normalizeUserRoleString', () => {
  it('returns canonical roles unchanged (case/whitespace tolerant)', () => {
    assert.strictEqual(normalizeUserRoleString('admin'), 'admin');
    assert.strictEqual(normalizeUserRoleString(' teacher '), 'teacher');
    assert.strictEqual(normalizeUserRoleString('STUDENT'), 'student');
  });

  it('maps legacy aliases to canonical roles', () => {
    assert.strictEqual(normalizeUserRoleString('openpath-admin'), 'admin');
    assert.strictEqual(normalizeUserRoleString('user'), 'student');
    assert.strictEqual(normalizeUserRoleString('viewer'), 'student');
  });

  it('returns null for unknown role strings', () => {
    assert.strictEqual(normalizeUserRoleString('superadmin'), null);
    assert.strictEqual(normalizeUserRoleString(''), null);
    assert.strictEqual(normalizeUserRoleString('   '), null);
  });

  it('returns null for non-string inputs', () => {
    assert.strictEqual(normalizeUserRoleString(null), null);
    assert.strictEqual(normalizeUserRoleString(undefined), null);
    assert.strictEqual(normalizeUserRoleString(123), null);
    assert.strictEqual(normalizeUserRoleString({ role: 'admin' }), null);
  });
});
