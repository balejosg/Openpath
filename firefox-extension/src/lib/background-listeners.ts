import type { Browser, WebNavigation, WebRequest } from 'webextension-polyfill';
import { logger } from './logger.js';
import { shouldClearBlockedMonitorStateOnNavigate } from './blocked-screen-contract.js';
import {
  BLOCKED_SCREEN_PATH,
  PATH_BLOCKING_FILTER_TYPES,
  ROUTE_BLOCK_REASON,
  extractHostname,
  isExtensionUrl,
} from './path-blocking.js';
import { isAutoAllowRequestType } from './auto-allow-workflow.js';

const BLOCKING_ERRORS = [
  'NS_ERROR_UNKNOWN_HOST',
  'NS_ERROR_CONNECTION_REFUSED',
  'NS_ERROR_NET_TIMEOUT',
  'NS_ERROR_PROXY_CONNECTION_REFUSED',
];
const IGNORED_ERRORS = ['NS_BINDING_ABORTED', 'NS_ERROR_ABORT'];
const BLOCKED_SCREEN_ERRORS = new Set([
  'NS_ERROR_UNKNOWN_HOST',
  'NS_ERROR_PROXY_CONNECTION_REFUSED',
]);

interface BlockedScreenContext {
  tabId: number;
  hostname: string;
  error: string;
  origin: string | null;
}

interface BackgroundListenersOptions {
  addBlockedDomain: (
    tabId: number,
    hostname: string,
    error: string,
    origin?: string | null
  ) => void;
  autoAllowBlockedDomain: (
    tabId: number,
    hostname: string,
    origin: string | null,
    requestType: WebRequest.ResourceType
  ) => Promise<void>;
  browser: Browser;
  clearTabRuntimeState: (tabId: number) => void;
  disposeTab: (tabId: number) => void;
  evaluateBlockedPath: (
    details: WebRequest.OnBeforeRequestDetailsType
  ) => { cancel?: boolean; redirectUrl?: string; reason?: string } | null;
  handleRuntimeMessage: Parameters<Browser['runtime']['onMessage']['addListener']>[0];
  redirectToBlockedScreen: (context: BlockedScreenContext) => Promise<void>;
}

function shouldDisplayBlockedScreen(details: WebRequest.OnErrorOccurredDetailsType): boolean {
  if (details.type !== 'main_frame') {
    return false;
  }

  if (!BLOCKED_SCREEN_ERRORS.has(details.error)) {
    return false;
  }

  if (isExtensionUrl(details.url)) {
    return false;
  }

  return true;
}

export function registerBackgroundListeners(options: BackgroundListenersOptions): void {
  options.browser.webRequest.onBeforeRequest.addListener(
    (details: WebRequest.OnBeforeRequestDetailsType) => {
      const result = options.evaluateBlockedPath(details);
      if (!result) {
        return;
      }

      const hostname = extractHostname(details.url) ?? 'dominio desconocido';
      if (details.tabId >= 0) {
        const reason = result.reason ?? `${ROUTE_BLOCK_REASON}:unknown`;
        options.addBlockedDomain(
          details.tabId,
          hostname,
          reason,
          details.originUrl ?? details.documentUrl
        );
      }

      if (result.redirectUrl) {
        return { redirectUrl: result.redirectUrl };
      }

      return { cancel: true };
    },
    { urls: ['<all_urls>'], types: [...PATH_BLOCKING_FILTER_TYPES] as WebRequest.ResourceType[] },
    ['blocking']
  );

  options.browser.webRequest.onErrorOccurred.addListener(
    (details: WebRequest.OnErrorOccurredDetailsType) => {
      if (IGNORED_ERRORS.includes(details.error)) {
        return;
      }

      if (!BLOCKING_ERRORS.includes(details.error)) {
        return;
      }

      const hostname = extractHostname(details.url);
      if (!hostname || details.tabId < 0) {
        return;
      }

      const origin = extractHostname(details.originUrl ?? details.documentUrl ?? '');

      logger.info(`[Monitor] Bloqueado: ${hostname}`, {
        error: details.error,
        requestType: details.type,
      });
      options.addBlockedDomain(
        details.tabId,
        hostname,
        details.error,
        details.originUrl ?? details.documentUrl
      );

      if (shouldDisplayBlockedScreen(details)) {
        void options.redirectToBlockedScreen({
          tabId: details.tabId,
          hostname,
          error: details.error,
          origin,
        });
      }

      if (isAutoAllowRequestType(details.type)) {
        void options.autoAllowBlockedDomain(details.tabId, hostname, origin, details.type);
      }
    },
    { urls: ['<all_urls>'] }
  );

  options.browser.webNavigation.onBeforeNavigate.addListener(
    (details: WebNavigation.OnBeforeNavigateDetailsType) => {
      if (
        shouldClearBlockedMonitorStateOnNavigate(
          { frameId: details.frameId, url: details.url },
          options.browser.runtime.getURL(BLOCKED_SCREEN_PATH)
        )
      ) {
        logger.debug(`[Monitor] Limpiando bloqueos para tab ${details.tabId.toString()}`);
        options.clearTabRuntimeState(details.tabId);
      }
    }
  );

  options.browser.tabs.onRemoved.addListener((tabId: number) => {
    options.disposeTab(tabId);
    logger.debug(`[Monitor] Tab ${tabId.toString()} cerrada, datos eliminados`);
  });

  options.browser.runtime.onMessage.addListener(options.handleRuntimeMessage);
}
