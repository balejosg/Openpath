/**
 * OpenPath Firefox Extension - Popup Script
 * Handles the popup UI and communication with background script
 */

import { logger, getErrorMessage } from './lib/logger.js';
import { buildSubmitBlockedDomainRequestMessage } from './lib/blocked-screen-contract.js';
import { createPopupElements, registerPopupEventHandlers } from './lib/popup-dom.js';
import {
  applyPopupNativeAvailability,
  applyPopupNativeError,
  hidePopupRequestStatus,
  hidePopupVerifyResults,
  renderPopupVerifyResults,
  resetPopupVerifyButton,
  showPopupRequestStatus,
  showPopupToast,
  showPopupVerifyCommunicationError,
  showPopupVerifyError,
  showPopupVerifyLoading,
} from './lib/popup-feedback.js';
import {
  DEFAULT_REQUEST_CONFIG,
  hasValidRequestConfig,
  loadRequestConfig,
  type RequestConfig,
} from './lib/config-storage.js';
import { shouldEnableRequestAction, type BlockedDomainsData } from './lib/popup-state.js';
import {
  buildRequestDomainOptions,
  retryPopupDomainLocalUpdate,
  shouldEnableSubmitRequest,
  submitPopupDomainRequest,
} from './lib/popup-request-actions.js';
import { verifyPopupDomains } from './lib/popup-native-actions.js';
import {
  buildBlockedDomainsClipboardText,
  checkPopupNativeAvailability,
  clearPopupDomainsForTab,
  loadPopupDomainSnapshot,
  loadPopupDomainStatuses,
  resolveActivePopupTab,
} from './lib/popup-runtime.js';
import { buildBlockedDomainListItems } from './lib/popup-view-models.js';
const {
  tabDomainEl,
  countEl,
  domainsListEl,
  emptyMessageEl,
  btnCopy,
  btnVerify,
  btnClear,
  btnRequest,
  toastEl,
  nativeStatusEl,
  verifyResultsEl,
  verifyListEl,
  requestSectionEl,
  requestDomainSelectEl,
  requestReasonEl,
  btnSubmitRequest,
  requestStatusEl,
} = createPopupElements();

// Current tab ID
let currentTabId: number | null = null;

// Current blocked domains data
let blockedDomainsData: BlockedDomainsData = {};

// Native Messaging availability
let isNativeAvailable = false;
let domainStatusesData: Record<string, DomainStatus> = {};

function showToast(message: string, duration = 3000): void {
  showPopupToast({
    duration,
    message,
    toastEl,
  });
}

function isRequestConfigured(): boolean {
  return hasValidRequestConfig(CONFIG);
}

function refreshRequestButtonState(): void {
  const hasDomains = Object.keys(blockedDomainsData).length > 0;
  const canRequest = shouldEnableRequestAction({
    hasDomains,
    nativeAvailable: isNativeAvailable,
    requestConfigured: isRequestConfigured(),
  });

  if (canRequest) {
    btnRequest.classList.remove('hidden');
    btnRequest.disabled = false;
  } else {
    btnRequest.classList.add('hidden');
    btnRequest.disabled = true;
    hideRequestSection();
  }
}

/**
 * Load blocked domains for the current tab
 */
async function loadBlockedDomains(): Promise<void> {
  if (currentTabId === null) return;

  try {
    const snapshot = await loadPopupDomainSnapshot(currentTabId, (message) =>
      browser.runtime.sendMessage(message)
    );
    blockedDomainsData = snapshot.blockedDomainsData;
    domainStatusesData = snapshot.domainStatusesData;
    renderDomainsList();
  } catch (error) {
    logger.error('[Popup] Error loading blocked domains', { error: getErrorMessage(error) });
    blockedDomainsData = {};
    domainStatusesData = {};
    renderDomainsList();
  }
}

async function loadDomainStatuses(): Promise<void> {
  if (currentTabId === null) return;

  domainStatusesData = await loadPopupDomainStatuses(currentTabId, (message) =>
    browser.runtime.sendMessage(message)
  );
}

/**
 * Render the list of blocked domains in the UI
 */
function renderDomainsList(): void {
  const hostnames = Object.keys(blockedDomainsData).sort();

  if (hostnames.length === 0) {
    countEl.textContent = '0';
    domainsListEl.classList.add('hidden');
    emptyMessageEl.classList.remove('hidden');
    btnCopy.disabled = true;
    btnVerify.disabled = true;
    btnRequest.disabled = true;
    refreshRequestButtonState();
    return;
  }

  countEl.textContent = hostnames.length.toString();
  domainsListEl.classList.remove('hidden');
  emptyMessageEl.classList.add('hidden');
  btnCopy.disabled = false;
  btnVerify.disabled = !isNativeAvailable;
  refreshRequestButtonState();

  domainsListEl.innerHTML = '';
  buildBlockedDomainListItems({
    blockedDomainsData,
    currentTabId,
    domainStatusesData,
  }).forEach((viewModel) => {
    const item = document.createElement('li');
    item.className = 'domain-item';
    const retryButton = viewModel.retryHostname
      ? `<button class="retry-update-btn" data-hostname="${viewModel.retryHostname}" title="Reintentar actualización local">Reintentar</button>`
      : '';

    item.innerHTML = `
            <span class="domain-name" title="${viewModel.hostname}">${viewModel.hostname}</span>
            <span class="domain-meta">
                <span class="domain-count" title="Intentos de conexión">${viewModel.attempts.toString()}</span>
                <span class="domain-status ${viewModel.statusClassName}" title="${viewModel.statusLabel}">${viewModel.statusLabel}</span>
                ${retryButton}
            </span>
        `;
    domainsListEl.appendChild(item);
  });
}

/**
 * Copy blocked domains list to clipboard
 */
async function copyToClipboard(): Promise<void> {
  const text = buildBlockedDomainsClipboardText(blockedDomainsData);
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    showToast('Copiado al portapapeles');
  } catch (error) {
    logger.error('[Popup] Error copying to clipboard', { error: getErrorMessage(error) });
    showToast('Error al copiar');
  }
}

/**
 * Clear blocked domains for current tab
 */
async function clearDomains(): Promise<void> {
  if (currentTabId === null) return;

  try {
    await clearPopupDomainsForTab(currentTabId, (message) => browser.runtime.sendMessage(message));
    blockedDomainsData = {};
    domainStatusesData = {};
    renderDomainsList();
    hidePopupVerifyResults({
      verifyListEl,
      verifyResultsEl,
    });
    hideRequestSection();
    showToast('Lista limpiada');
  } catch (error) {
    logger.error('[Popup] Error clearing domains', { error: getErrorMessage(error) });
  }
}

/**
 * Hide request section
 */
function hideRequestSection(): void {
  requestSectionEl.classList.add('hidden');
}

/**
 * Check if Native Host is available
 */
async function checkNativeAvailable(): Promise<void> {
  try {
    const nativeState = await checkPopupNativeAvailability((message) =>
      browser.runtime.sendMessage(message)
    );
    isNativeAvailable = nativeState.available;
    applyPopupNativeAvailability({
      btnVerify,
      nativeState,
      nativeStatusEl,
    });
    refreshRequestButtonState();
  } catch {
    isNativeAvailable = false;
    applyPopupNativeError({
      btnVerify,
      nativeStatusEl,
    });
    refreshRequestButtonState();
  }
}

/**
 * Verify domains against local whitelist via Native Messaging
 */
async function verifyDomainsWithNative(): Promise<void> {
  const hasHostnames = Object.keys(blockedDomainsData).length > 0;
  if (!hasHostnames || !isNativeAvailable) return;

  showPopupVerifyLoading({
    btnVerify,
    verifyListEl,
    verifyResultsEl,
  });

  try {
    const result = await verifyPopupDomains({
      blockedDomainsData,
      isNativeAvailable,
      sendMessage: (message) => browser.runtime.sendMessage(message),
    });

    if (result.ok) {
      renderPopupVerifyResults({
        results: result.results,
        verifyListEl,
      });
    } else if ('errorMessage' in result) {
      showPopupVerifyError(verifyListEl, result.errorMessage);
    } else {
      hidePopupVerifyResults({
        verifyListEl,
        verifyResultsEl,
      });
    }
  } catch (error) {
    logger.error('[Popup] Error verifying domains', { error: getErrorMessage(error) });
    showPopupVerifyCommunicationError(verifyListEl);
  } finally {
    resetPopupVerifyButton(btnVerify);
  }
}

let CONFIG: RequestConfig = { ...DEFAULT_REQUEST_CONFIG };

/**
 * Toggle request section visibility
 */
function toggleRequestSection(): void {
  const isHidden = requestSectionEl.classList.contains('hidden');

  if (isHidden) {
    // Show and populate
    requestSectionEl.classList.remove('hidden');
    populateRequestDomainSelect();
    hidePopupVerifyResults({
      verifyListEl,
      verifyResultsEl,
    });
  } else {
    // Hide
    requestSectionEl.classList.add('hidden');
    hidePopupRequestStatus(requestStatusEl);
  }
}

/**
 * Populate the domain select dropdown with origin info
 */
function populateRequestDomainSelect(): void {
  requestDomainSelectEl.innerHTML = '<option value="">Seleccionar dominio...</option>';

  buildRequestDomainOptions(blockedDomainsData).forEach(({ hostname, origin }) => {
    const option = document.createElement('option');
    option.value = hostname;
    option.textContent = hostname;
    option.dataset.origin = origin;
    requestDomainSelectEl.appendChild(option);
  });

  updateSubmitButtonState();
}

/**
 * Update submit button enabled state
 */
function updateSubmitButtonState(): void {
  btnSubmitRequest.disabled = !shouldEnableSubmitRequest({
    hasSelectedDomain: requestDomainSelectEl.value !== '',
    hasValidReason: requestReasonEl.value.trim().length >= 3,
    isNativeAvailable,
    isRequestConfigured: isRequestConfigured(),
  });
}

/**
 * Submit a domain request to approval queue
 */
async function submitDomainRequest(): Promise<void> {
  const domain = requestDomainSelectEl.value;
  const reason = requestReasonEl.value.trim();

  // Disable button while submitting
  btnSubmitRequest.disabled = true;
  btnSubmitRequest.textContent = '⏳ Enviando...';
  showPopupRequestStatus({
    message: 'Enviando solicitud...',
    requestStatusEl,
    type: 'pending',
  });

  try {
    const result = await submitPopupDomainRequest({
      blockedDomainsData,
      buildSubmitMessage: buildSubmitBlockedDomainRequestMessage,
      domain,
      isNativeAvailable,
      isRequestConfigured: isRequestConfigured(),
      reason,
      sendMessage: (message) => browser.runtime.sendMessage(message),
    });

    showPopupRequestStatus({
      message: result.userMessage,
      requestStatusEl,
      type: result.success ? 'success' : 'error',
    });

    if (result.success) {
      showToast('✅ Solicitud enviada');
      if (result.shouldResetForm) {
        requestDomainSelectEl.value = '';
        requestReasonEl.value = '';
      }
      if (result.shouldReloadDomainStatuses) {
        await loadDomainStatuses();
        renderDomainsList();
      }
    } else {
      showToast(result.userMessage);
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    showPopupRequestStatus({
      message: `❌ ${errorMessage}`,
      requestStatusEl,
      type: 'error',
    });
    showToast('❌ Error al enviar');

    if (CONFIG.debugMode) {
      logger.error('[Popup] Request error', { error: errorMessage });
    }
  } finally {
    btnSubmitRequest.disabled = false;
    btnSubmitRequest.textContent = 'Enviar Solicitud';
    updateSubmitButtonState();
  }
}

async function retryDomainLocalUpdate(hostname: string): Promise<void> {
  try {
    const result = await retryPopupDomainLocalUpdate({
      hostname,
      sendMessage: (message) => browser.runtime.sendMessage(message),
      tabId: currentTabId,
    });
    if (result.success) {
      showToast('Whitelist local actualizada');
    } else {
      showToast('No se pudo actualizar whitelist local');
    }
    await loadDomainStatuses();
    renderDomainsList();
  } catch (error) {
    logger.error('[Popup] Error retrying local update', { error: getErrorMessage(error) });
    showToast('Error al reintentar actualización local');
  }
}

/**
 * Inicializa el popup
 */
async function init(): Promise<void> {
  try {
    CONFIG = await loadRequestConfig();

    // Obtener pestaña activa
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = resolveActivePopupTab(tabs);
    if (activeTab.errorText) {
      tabDomainEl.textContent = activeTab.errorText;
      return;
    }
    currentTabId = activeTab.currentTabId ?? null;

    // Mostrar hostname de la pestaña actual
    tabDomainEl.textContent = activeTab.currentTabHostname ?? 'Error';

    // Cargar dominios bloqueados
    await loadBlockedDomains();

    // Verificar si Native Messaging está disponible
    await checkNativeAvailable();

    refreshRequestButtonState();
  } catch (error) {
    logger.error('[Popup] Error de inicialización', { error: getErrorMessage(error) });
    tabDomainEl.textContent = 'Error';
  }
}

registerPopupEventHandlers({
  elements: {
    btnCopy,
    btnClear,
    btnRequest,
    btnSubmitRequest,
    btnVerify,
    domainsListEl,
    requestDomainSelectEl,
    requestReasonEl,
  },
  onClear: () => {
    void clearDomains();
  },
  onCopy: () => {
    void copyToClipboard();
  },
  onDomReady: () => {
    void init();
  },
  onRequestInputChange: updateSubmitButtonState,
  onRetryUpdate: (hostname) => {
    void retryDomainLocalUpdate(hostname);
  },
  onSubmitRequest: () => {
    void submitDomainRequest();
  },
  onToggleRequest: toggleRequestSection,
  onVerify: () => {
    void verifyDomainsWithNative();
  },
});
