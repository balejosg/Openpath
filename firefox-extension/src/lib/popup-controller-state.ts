import type { RequestConfig } from './config-storage.js';
import type { BlockedDomainsData } from './popup-state.js';

export interface PopupControllerState {
  blockedDomainsData: BlockedDomainsData;
  config: RequestConfig;
  currentTabId: number | null;
  domainStatusesData: Record<string, DomainStatus>;
  isNativeAvailable: boolean;
}
