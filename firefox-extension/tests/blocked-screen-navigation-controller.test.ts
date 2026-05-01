import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { WebRequest } from 'webextension-polyfill';

import { createBlockedScreenNavigationController } from '../src/lib/blocked-screen-navigation-controller.js';

interface BlockedScreenContext {
  tabId: number;
  hostname: string;
  error: string;
  origin: string | null;
}

void describe('blocked screen navigation controller', () => {
  void test('native policy preflight records and redirects only after confirmation succeeds', async () => {
    const addedBlocks: BlockedScreenContext[] = [];
    const redirects: BlockedScreenContext[] = [];
    const controller = createBlockedScreenNavigationController({
      addBlockedDomain: (tabId, hostname, error, origin) => {
        addedBlocks.push({ tabId, hostname, error, origin: origin ?? null });
      },
      confirmBlockedScreenNavigation: () => Promise.resolve(true),
      getBlockedScreenUrl: () => 'moz-extension://unit-test/blocked/blocked.html',
      getCurrentTabUrl: () => Promise.resolve('https://blocked.example/lesson'),
      now: () => 1000,
      redirectToBlockedScreen: (context) => {
        redirects.push(context);
        return Promise.resolve();
      },
    });

    controller.handleNativePolicyNavigationPreflight({
      frameId: 0,
      tabId: 4,
      url: 'https://blocked.example/lesson',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(addedBlocks, [
      {
        tabId: 4,
        hostname: 'blocked.example',
        error: 'OPENPATH_NATIVE_POLICY_BLOCKED',
        origin: null,
      },
    ]);
    assert.deepEqual(redirects, [
      {
        tabId: 4,
        hostname: 'blocked.example',
        error: 'OPENPATH_NATIVE_POLICY_BLOCKED',
        origin: null,
      },
    ]);
  });

  void test('duplicate redirect window suppresses late duplicate errors', async () => {
    const redirects: BlockedScreenContext[] = [];
    const controller = createBlockedScreenNavigationController({
      addBlockedDomain: () => undefined,
      confirmBlockedScreenNavigation: () => Promise.resolve(true),
      getBlockedScreenUrl: () => 'moz-extension://unit-test/blocked/blocked.html',
      getCurrentTabUrl: () => Promise.resolve('https://late.example/lesson'),
      now: () => 2000,
      redirectToBlockedScreen: (context) => {
        redirects.push(context);
        return Promise.resolve();
      },
    });

    controller.handleNativePolicyNavigationPreflight({
      frameId: 0,
      tabId: 8,
      url: 'https://late.example/lesson',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.handleBlockedScreenNavigationError(
      {
        error: 'NS_ERROR_NET_TIMEOUT',
        tabId: 8,
        type: 'main_frame',
        url: 'https://late.example/lesson',
      } as WebRequest.OnErrorOccurredDetailsType,
      { recordBlockedDomain: true, requestType: 'main_frame' }
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(redirects, [
      {
        tabId: 8,
        hostname: 'late.example',
        error: 'OPENPATH_NATIVE_POLICY_BLOCKED',
        origin: null,
      },
    ]);
  });

  void test('already-on-blocked-screen tabs do not reload', async () => {
    const redirects: BlockedScreenContext[] = [];
    const controller = createBlockedScreenNavigationController({
      addBlockedDomain: () => undefined,
      confirmBlockedScreenNavigation: () => Promise.resolve(true),
      getBlockedScreenUrl: () => 'moz-extension://unit-test/blocked/blocked.html',
      getCurrentTabUrl: () =>
        Promise.resolve('moz-extension://unit-test/blocked/blocked.html?domain=blocked.example'),
      redirectToBlockedScreen: (context) => {
        redirects.push(context);
        return Promise.resolve();
      },
    });

    controller.handleBlockedScreenNavigationError(
      {
        error: 'NS_ERROR_NET_TIMEOUT',
        tabId: 9,
        type: 'main_frame',
        url: 'https://blocked.example/favicon.ico',
      } as WebRequest.OnErrorOccurredDetailsType,
      { recordBlockedDomain: true, requestType: 'main_frame' }
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(redirects, []);
  });

  void test('subresource errors never trigger blocked-screen redirects', async () => {
    const redirects: BlockedScreenContext[] = [];
    const controller = createBlockedScreenNavigationController({
      addBlockedDomain: () => undefined,
      confirmBlockedScreenNavigation: () => Promise.resolve(true),
      getBlockedScreenUrl: () => 'moz-extension://unit-test/blocked/blocked.html',
      getCurrentTabUrl: () => Promise.resolve('https://allowed.example/app'),
      redirectToBlockedScreen: (context) => {
        redirects.push(context);
        return Promise.resolve();
      },
    });

    controller.handleBlockedScreenNavigationError(
      {
        error: 'NS_ERROR_NET_TIMEOUT',
        originUrl: 'https://allowed.example/app',
        tabId: 3,
        type: 'xmlhttprequest',
        url: 'https://api.blocked.example/data.json',
      } as WebRequest.OnErrorOccurredDetailsType,
      { recordBlockedDomain: true, requestType: 'xmlhttprequest' }
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(redirects, []);
  });
});
