import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'express';

import {
  clearSessionCookies,
  getSessionCookieConfig,
  readAccessTokenFromRequest,
  readRefreshTokenFromRequest,
  setSessionCookies,
} from '../src/lib/session-cookies.js';

const ORIGINAL_ACCESS_COOKIE = process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;
const ORIGINAL_REFRESH_COOKIE = process.env.OPENPATH_REFRESH_TOKEN_COOKIE_NAME;

afterEach(() => {
  if (ORIGINAL_ACCESS_COOKIE === undefined) {
    delete process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;
  } else {
    process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = ORIGINAL_ACCESS_COOKIE;
  }

  if (ORIGINAL_REFRESH_COOKIE === undefined) {
    delete process.env.OPENPATH_REFRESH_TOKEN_COOKIE_NAME;
  } else {
    process.env.OPENPATH_REFRESH_TOKEN_COOKIE_NAME = ORIGINAL_REFRESH_COOKIE;
  }
});

void describe('session cookie helpers', () => {
  void test('returns null when cookie sessions are disabled', () => {
    delete process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;
    delete process.env.OPENPATH_REFRESH_TOKEN_COOKIE_NAME;

    assert.equal(getSessionCookieConfig(), null);
  });

  void test('sets and clears configured session cookies', () => {
    process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = 'op_access';
    process.env.OPENPATH_REFRESH_TOKEN_COOKIE_NAME = 'op_refresh';

    const calls: { name: string; value: string; options: Record<string, unknown> }[] = [];
    const res = {
      cookie(name: string, value: string, options: Record<string, unknown>): void {
        calls.push({ name, value, options });
      },
    };

    const setResult = setSessionCookies(res as Pick<Response, 'cookie'>, {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    const clearResult = clearSessionCookies(res as Pick<Response, 'cookie'>);

    assert.equal(setResult, true);
    assert.equal(clearResult, true);
    assert.equal(calls.length, 4);
    const [setAccess, setRefresh, clearAccess, clearRefresh] = calls;
    assert.ok(setAccess);
    assert.ok(setRefresh);
    assert.ok(clearAccess);
    assert.ok(clearRefresh);
    assert.equal(setAccess.name, 'op_access');
    assert.equal(setRefresh.name, 'op_refresh');
    assert.equal(setAccess.value, 'access-token');
    assert.equal(setRefresh.value, 'refresh-token');
    assert.equal(clearAccess.value, '');
    assert.equal(clearRefresh.value, '');
    assert.equal(setAccess.options.httpOnly, true);
    assert.equal(setAccess.options.sameSite, 'lax');
    assert.equal(setAccess.options.path, '/');
    assert.ok(clearAccess.options.expires instanceof Date);
    assert.ok(clearRefresh.options.expires instanceof Date);
  });

  void test('reads access and refresh tokens from the Cookie header', () => {
    process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = 'op_access';
    process.env.OPENPATH_REFRESH_TOKEN_COOKIE_NAME = 'op_refresh';

    const req = {
      headers: {
        cookie: 'other=1; op_access=access.value; op_refresh=refresh.value',
      },
    };

    assert.equal(readAccessTokenFromRequest(req), 'access.value');
    assert.equal(readRefreshTokenFromRequest(req), 'refresh.value');
  });
});
