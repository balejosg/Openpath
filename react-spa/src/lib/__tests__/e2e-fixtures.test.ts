import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTestDomain,
  createTestGroup,
  createTestUser,
} from '../../../e2e/fixtures/test-utils';

describe('E2E fixture factories', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates unique test domains even when the clock does not advance', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);

    const first = createTestDomain();
    const second = createTestDomain();

    expect(first.domain).not.toBe(second.domain);
  });

  it('creates unique test users even when the clock does not advance', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);

    const first = createTestUser();
    const second = createTestUser();

    expect(first.email).not.toBe(second.email);
    expect(first.name).not.toBe(second.name);
  });

  it('creates unique test groups even when the clock does not advance', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);

    const first = createTestGroup();
    const second = createTestGroup();

    expect(first.name).not.toBe(second.name);
  });
});
