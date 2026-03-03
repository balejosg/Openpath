import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeSlug } from '../src/slug.js';

describe('sanitizeSlug', () => {
  it('lowercases and trims', () => {
    assert.strictEqual(sanitizeSlug('  Mi Grupo  '), 'mi-grupo');
  });

  it('replaces invalid characters with hyphens and collapses runs', () => {
    assert.strictEqual(sanitizeSlug('A   B'), 'a-b');
    assert.strictEqual(sanitizeSlug('A@@@B'), 'a-b');
    assert.strictEqual(sanitizeSlug('---A---B---'), 'a-b');
  });

  it('preserves underscores by default', () => {
    assert.strictEqual(sanitizeSlug('mi_grupo'), 'mi_grupo');
  });

  it('can disallow underscores', () => {
    assert.strictEqual(sanitizeSlug('mi_grupo', { allowUnderscore: false }), 'mi-grupo');
  });

  it('strips diacritics', () => {
    assert.strictEqual(sanitizeSlug('Español ÁÉÍÓÚ'), 'espanol-aeiou');
  });

  it('respects maxLength and trims trailing hyphens', () => {
    assert.strictEqual(sanitizeSlug('a b c', { maxLength: 3 }), 'a-b');
    assert.strictEqual(sanitizeSlug('a b c', { maxLength: 2 }), 'a');
  });

  it('returns empty string for empty/whitespace input', () => {
    assert.strictEqual(sanitizeSlug(''), '');
    assert.strictEqual(sanitizeSlug('   '), '');
  });
});
