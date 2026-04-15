import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DomainSchema } from '../src/schemas/index.js';

describe('DomainSchema', () => {
  it('accepts valid domains', () => {
    const valid = [
      'google.com',
      'sub.domain.co.uk',
      '*.example.com',
      'a-b.test.org',
      'test.io',
      'www.example.com',
      'api.v2.example.org',
    ];
    valid.forEach((domain) => {
      assert.doesNotThrow(() => DomainSchema.parse(domain), `Should accept: ${domain}`);
    });
  });

  it('rejects invalid domains', () => {
    const invalid = ['', 'a', 'ab', 'abc', '-invalid.com', 'double..dots.com', '.startdot.com'];
    invalid.forEach((domain) => {
      assert.throws(() => DomainSchema.parse(domain), `Should reject: ${domain}`);
    });
  });

  it('accepts wildcard domains', () => {
    assert.doesNotThrow(() => DomainSchema.parse('*.example.com'));
    assert.doesNotThrow(() => DomainSchema.parse('*.sub.domain.org'));
  });

  it('enforces max length (253 chars)', () => {
    const longDomain = `${'a'.repeat(250)}.com`;
    assert.throws(() => DomainSchema.parse(longDomain));
  });

  it('enforces label max length (63 chars)', () => {
    const longLabel = `${'a'.repeat(64)}.com`;
    assert.throws(() => DomainSchema.parse(longLabel));
  });

  it('accepts labels up to 63 chars', () => {
    const maxLabel = `${'a'.repeat(63)}.com`;
    assert.doesNotThrow(() => DomainSchema.parse(maxLabel));
  });
});
