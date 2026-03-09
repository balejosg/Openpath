import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportError, setReportErrorSink, type ReportErrorEvent } from '../reportError';

describe('reportError', () => {
  afterEach(() => {
    setReportErrorSink(null);
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('emits a structured payload to the configured sink', () => {
    window.history.pushState({}, '', '/settings');
    const err = new Error('boom');
    const sink = vi.fn<(event: ReportErrorEvent) => void>();
    setReportErrorSink(sink);

    reportError('Something failed', err, {
      source: 'test',
      attempt: 2,
      action: 'load-settings',
      userRole: 'admin',
    });

    expect(sink).toHaveBeenCalledTimes(1);
    const [payload] = sink.mock.calls[0];

    expect(payload.app).toBe('openpath-spa');
    expect(payload.message).toBe('Something failed');
    expect(payload.route).toBe('/settings');
    expect(payload.action).toBe('load-settings');
    expect(payload.userRole).toBe('admin');
    expect(payload.meta).toEqual({
      source: 'test',
      attempt: 2,
      action: 'load-settings',
      userRole: 'admin',
    });
    expect(payload.error.message).toBe('boom');
    expect(typeof payload.timestamp).toBe('string');
  });

  it('falls back to console.error when no sink is configured', () => {
    const err = new Error('boom');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    reportError('Something failed', err);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      app: 'openpath-spa',
      message: 'Something failed',
      route: '/',
      meta: {},
    });
  });
});
