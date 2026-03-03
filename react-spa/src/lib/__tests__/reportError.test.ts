import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportError } from '../reportError';

describe('reportError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs message + error when meta is not provided', () => {
    const err = new Error('boom');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    reportError('Something failed', err);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Something failed', { error: err });
  });

  it('logs message + error + meta when meta is provided', () => {
    const err = new Error('boom');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    reportError('Something failed', err, { source: 'test', attempt: 2 });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Something failed', {
      error: err,
      meta: { source: 'test', attempt: 2 },
    });
  });
});
