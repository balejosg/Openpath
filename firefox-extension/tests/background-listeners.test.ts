import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Browser, WebRequest } from 'webextension-polyfill';

import { registerBackgroundListeners } from '../src/lib/background-listeners.js';

interface BlockedScreenContext {
  tabId: number;
  hostname: string;
  error: string;
  origin: string | null;
}

interface ConfirmBlockedScreenContext extends BlockedScreenContext {
  url: string;
}

type WebRequestErrorListener = (details: WebRequest.OnErrorOccurredDetailsType) => void;
type WebNavigationErrorListener = (details: {
  error: string;
  frameId: number;
  tabId: number;
  url: string;
}) => void;

function waitForAsyncListeners(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function createListenerHarness(
  options: {
    confirmBlockedScreenNavigation?: (context: ConfirmBlockedScreenContext) => Promise<boolean>;
  } = {}
): {
  addedBlocks: BlockedScreenContext[];
  confirmCalls: ConfirmBlockedScreenContext[];
  redirects: BlockedScreenContext[];
  webNavigationError: WebNavigationErrorListener | null;
  webRequestError: WebRequestErrorListener | null;
} {
  const addedBlocks: BlockedScreenContext[] = [];
  const confirmCalls: ConfirmBlockedScreenContext[] = [];
  const redirects: BlockedScreenContext[] = [];
  let webRequestError: WebRequestErrorListener | null = null;
  let webNavigationError: WebNavigationErrorListener | null = null;

  const browser = {
    webRequest: {
      onBeforeRequest: {
        addListener: () => undefined,
      },
      onErrorOccurred: {
        addListener: (listener: WebRequestErrorListener) => {
          webRequestError = listener;
        },
      },
    },
    webNavigation: {
      onBeforeNavigate: {
        addListener: () => undefined,
      },
      onErrorOccurred: {
        addListener: (listener: WebNavigationErrorListener) => {
          webNavigationError = listener;
        },
      },
    },
    runtime: {
      getURL: (path: string) => `moz-extension://unit-test/${path}`,
      onMessage: {
        addListener: () => undefined,
      },
    },
    tabs: {
      onRemoved: {
        addListener: () => undefined,
      },
    },
  } as unknown as Browser;

  const listenerOptions = {
    addBlockedDomain: (tabId: number, hostname: string, error: string, origin?: string | null) => {
      addedBlocks.push({
        tabId,
        hostname,
        error,
        origin: origin ?? null,
      });
    },
    autoAllowBlockedDomain: () => Promise.resolve(),
    browser,
    clearTabRuntimeState: () => undefined,
    disposeTab: () => undefined,
    evaluateBlockedPath: () => null,
    handleRuntimeMessage: () => undefined,
    redirectToBlockedScreen: (context: BlockedScreenContext) => {
      redirects.push(context);
      return Promise.resolve();
    },
    confirmBlockedScreenNavigation: async (context: ConfirmBlockedScreenContext) => {
      confirmCalls.push(context);
      return options.confirmBlockedScreenNavigation
        ? await options.confirmBlockedScreenNavigation(context)
        : false;
    },
  } as Parameters<typeof registerBackgroundListeners>[0] & {
    confirmBlockedScreenNavigation: (context: ConfirmBlockedScreenContext) => Promise<boolean>;
  };

  registerBackgroundListeners(listenerOptions);

  return {
    addedBlocks,
    confirmCalls,
    redirects,
    get webNavigationError(): WebNavigationErrorListener | null {
      return webNavigationError;
    },
    get webRequestError(): WebRequestErrorListener | null {
      return webRequestError;
    },
  };
}

void describe('background listeners blocked-screen routing', () => {
  void test('redirects a main-frame timeout when native policy confirms the hostname is blocked', async () => {
    const harness = createListenerHarness({
      confirmBlockedScreenNavigation: () => Promise.resolve(true),
    });
    assert.ok(harness.webRequestError);

    harness.webRequestError({
      error: 'NS_ERROR_NET_TIMEOUT',
      tabId: 7,
      type: 'main_frame',
      url: 'https://blocked.example/lesson',
    } as WebRequest.OnErrorOccurredDetailsType);

    await waitForAsyncListeners();

    assert.deepEqual(harness.confirmCalls, [
      {
        tabId: 7,
        hostname: 'blocked.example',
        error: 'NS_ERROR_NET_TIMEOUT',
        origin: null,
        url: 'https://blocked.example/lesson',
      },
    ]);
    assert.deepEqual(harness.redirects, [
      {
        tabId: 7,
        hostname: 'blocked.example',
        error: 'NS_ERROR_NET_TIMEOUT',
        origin: null,
      },
    ]);
  });

  void test('does not redirect a main-frame refused connection when native policy says it is allowed', async () => {
    const harness = createListenerHarness({
      confirmBlockedScreenNavigation: () => Promise.resolve(false),
    });
    assert.ok(harness.webRequestError);

    harness.webRequestError({
      error: 'NS_ERROR_CONNECTION_REFUSED',
      tabId: 8,
      type: 'main_frame',
      url: 'https://allowed.example/lesson',
    } as WebRequest.OnErrorOccurredDetailsType);

    await waitForAsyncListeners();

    assert.equal(harness.confirmCalls.length, 1);
    assert.deepEqual(harness.redirects, []);
  });

  void test('keeps unknown-host main-frame redirects immediate without native confirmation', async () => {
    const harness = createListenerHarness({
      confirmBlockedScreenNavigation: () => Promise.reject(new Error('should not be called')),
    });
    assert.ok(harness.webRequestError);

    harness.webRequestError({
      error: 'NS_ERROR_UNKNOWN_HOST',
      tabId: 9,
      type: 'main_frame',
      url: 'https://missing.example/lesson',
    } as WebRequest.OnErrorOccurredDetailsType);

    await waitForAsyncListeners();

    assert.deepEqual(harness.confirmCalls, []);
    assert.deepEqual(harness.redirects, [
      {
        tabId: 9,
        hostname: 'missing.example',
        error: 'NS_ERROR_UNKNOWN_HOST',
        origin: null,
      },
    ]);
  });

  void test('uses webNavigation top-frame errors as a fallback for native-confirmed blocks', async () => {
    const harness = createListenerHarness({
      confirmBlockedScreenNavigation: () => Promise.resolve(true),
    });
    assert.ok(harness.webNavigationError);

    harness.webNavigationError({
      error: 'NS_ERROR_NET_TIMEOUT',
      frameId: 0,
      tabId: 10,
      url: 'https://navigation-blocked.example/lesson',
    });

    await waitForAsyncListeners();

    assert.deepEqual(harness.redirects, [
      {
        tabId: 10,
        hostname: 'navigation-blocked.example',
        error: 'NS_ERROR_NET_TIMEOUT',
        origin: null,
      },
    ]);
  });

  void test('deduplicates webRequest and webNavigation redirects for the same blocked navigation', async () => {
    let resolveConfirmation: (confirmed: boolean) => void = () => undefined;
    const confirmation = new Promise<boolean>((resolve) => {
      resolveConfirmation = resolve;
    });
    const harness = createListenerHarness({
      confirmBlockedScreenNavigation: () => confirmation,
    });
    assert.ok(harness.webRequestError);
    assert.ok(harness.webNavigationError);

    const blockedNavigation = {
      error: 'NS_ERROR_NET_TIMEOUT',
      tabId: 12,
      url: 'https://deduped-blocked.example/lesson',
    };

    harness.webRequestError({
      ...blockedNavigation,
      type: 'main_frame',
    } as WebRequest.OnErrorOccurredDetailsType);
    harness.webNavigationError({
      ...blockedNavigation,
      frameId: 0,
    });

    await waitForAsyncListeners();
    assert.equal(harness.confirmCalls.length, 1);
    assert.deepEqual(harness.redirects, []);

    resolveConfirmation(true);
    await waitForAsyncListeners();

    assert.deepEqual(harness.redirects, [
      {
        tabId: 12,
        hostname: 'deduped-blocked.example',
        error: 'NS_ERROR_NET_TIMEOUT',
        origin: null,
      },
    ]);
  });

  void test('does not redirect subresource blocking errors to the blocked screen', async () => {
    const harness = createListenerHarness({
      confirmBlockedScreenNavigation: () => Promise.resolve(true),
    });
    assert.ok(harness.webRequestError);

    harness.webRequestError({
      error: 'NS_ERROR_NET_TIMEOUT',
      tabId: 11,
      type: 'xmlhttprequest',
      url: 'https://api.blocked.example/data.json',
    } as WebRequest.OnErrorOccurredDetailsType);

    await waitForAsyncListeners();

    assert.deepEqual(harness.confirmCalls, []);
    assert.deepEqual(harness.redirects, []);
    assert.equal(harness.addedBlocks.length, 1);
  });
});
