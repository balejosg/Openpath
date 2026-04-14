import {
  buildVerifyResultViewModels,
  type NativeAvailabilityState,
  type VerifyResult,
} from './popup-native-actions.js';
import { buildRequestStatusPresentation } from './popup-view-models.js';

export function showPopupToast(input: {
  duration?: number;
  message: string;
  scheduleTimeout?: (callback: () => void, delay: number) => unknown;
  toastEl: HTMLElement;
}): void {
  input.toastEl.textContent = input.message;
  input.toastEl.classList.add('show');
  (input.scheduleTimeout ?? setTimeout)(() => {
    input.toastEl.classList.remove('show');
  }, input.duration ?? 3000);
}

export function applyPopupNativeAvailability(input: {
  btnVerify: HTMLButtonElement;
  nativeState: NativeAvailabilityState;
  nativeStatusEl: HTMLElement;
}): void {
  input.nativeStatusEl.textContent = input.nativeState.label;
  input.nativeStatusEl.className = input.nativeState.className;
  input.btnVerify.disabled = !input.nativeState.available;
}

export function applyPopupNativeError(input: {
  btnVerify: HTMLButtonElement;
  nativeStatusEl: HTMLElement;
}): void {
  input.nativeStatusEl.textContent = 'Error de comunicación';
  input.nativeStatusEl.className = 'status-indicator unavailable';
  input.btnVerify.disabled = true;
}

export function showPopupVerifyLoading(input: {
  btnVerify: HTMLButtonElement;
  verifyListEl: HTMLElement;
  verifyResultsEl: HTMLElement;
}): void {
  input.btnVerify.disabled = true;
  input.btnVerify.textContent = '⌛ Verificando...';
  input.verifyListEl.innerHTML = '<div class="loading">Consultando host nativo...</div>';
  input.verifyResultsEl.classList.remove('hidden');
}

export function showPopupVerifyError(verifyListEl: HTMLElement, message: string): void {
  verifyListEl.innerHTML = `<div class="error-text">Error: ${message}</div>`;
}

export function showPopupVerifyCommunicationError(verifyListEl: HTMLElement): void {
  verifyListEl.innerHTML = '<div class="error-text">Error al comunicar con el host nativo</div>';
}

export function resetPopupVerifyButton(btnVerify: HTMLButtonElement): void {
  btnVerify.disabled = false;
  btnVerify.textContent = '🔍 Verificar en Whitelist';
}

export function renderPopupVerifyResults(input: {
  createListItem?: () => HTMLLIElement;
  results: VerifyResult[];
  verifyListEl: HTMLElement;
}): void {
  if (input.results.length === 0) {
    input.verifyListEl.innerHTML = '<div>No hay resultados</div>';
    return;
  }

  input.verifyListEl.innerHTML = '';
  const createListItem =
    input.createListItem ?? ((): HTMLLIElement => document.createElement('li'));

  buildVerifyResultViewModels(input.results).forEach((result) => {
    const item = createListItem();
    item.className = 'verify-item';

    const ipInfo = result.resolvedIp ? `<span class="ip-info">${result.resolvedIp}</span>` : '';

    item.innerHTML = `
            <span class="verify-domain">${result.domain}</span>
            <div class="verify-meta">
                ${ipInfo}
                <span class="verify-status ${result.statusClass}">${result.statusText}</span>
            </div>
        `;
    input.verifyListEl.appendChild(item);
  });
}

export function hidePopupVerifyResults(input: {
  verifyListEl: HTMLElement;
  verifyResultsEl: HTMLElement;
}): void {
  input.verifyResultsEl.classList.add('hidden');
  input.verifyListEl.innerHTML = '';
}

export function showPopupRequestStatus(input: {
  message: string;
  requestStatusEl: HTMLElement;
  type?: string;
}): void {
  const presentation = buildRequestStatusPresentation(input.type ?? 'info');
  input.requestStatusEl.classList.remove(...presentation.classesToRemove);
  input.requestStatusEl.classList.add(...presentation.classesToAdd);
  input.requestStatusEl.textContent = input.message;
}

export function hidePopupRequestStatus(requestStatusEl: HTMLElement): void {
  requestStatusEl.classList.add('hidden');
  requestStatusEl.textContent = '';
}
