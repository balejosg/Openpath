export interface PopupElements {
  tabDomainEl: HTMLElement;
  countEl: HTMLElement;
  domainsListEl: HTMLElement;
  emptyMessageEl: HTMLElement;
  btnCopy: HTMLButtonElement;
  btnVerify: HTMLButtonElement;
  btnClear: HTMLButtonElement;
  btnRequest: HTMLButtonElement;
  toastEl: HTMLElement;
  nativeStatusEl: HTMLElement;
  verifyResultsEl: HTMLElement;
  verifyListEl: HTMLElement;
  requestSectionEl: HTMLElement;
  requestDomainSelectEl: HTMLSelectElement;
  requestReasonEl: HTMLInputElement;
  btnSubmitRequest: HTMLButtonElement;
  requestStatusEl: HTMLElement;
}

interface PopupDocumentLike {
  addEventListener(type: string, listener: () => void): void;
  getElementById(id: string): HTMLElement | null;
}

function getRequiredElement(doc: PopupDocumentLike, id: string): HTMLElement {
  const el = doc.getElementById(id);
  if (!el) {
    throw new Error(`Required element #${id} not found`);
  }
  return el;
}

export function createPopupElements(doc: PopupDocumentLike = document): PopupElements {
  return {
    tabDomainEl: getRequiredElement(doc, 'tab-domain'),
    countEl: getRequiredElement(doc, 'count'),
    domainsListEl: getRequiredElement(doc, 'domains-list'),
    emptyMessageEl: getRequiredElement(doc, 'empty-message'),
    btnCopy: getRequiredElement(doc, 'btn-copy') as HTMLButtonElement,
    btnVerify: getRequiredElement(doc, 'btn-verify') as HTMLButtonElement,
    btnClear: getRequiredElement(doc, 'btn-clear') as HTMLButtonElement,
    btnRequest: getRequiredElement(doc, 'btn-request') as HTMLButtonElement,
    toastEl: getRequiredElement(doc, 'toast'),
    nativeStatusEl: getRequiredElement(doc, 'native-status'),
    verifyResultsEl: getRequiredElement(doc, 'verify-results'),
    verifyListEl: getRequiredElement(doc, 'verify-list'),
    requestSectionEl: getRequiredElement(doc, 'request-section'),
    requestDomainSelectEl: getRequiredElement(doc, 'request-domain-select') as HTMLSelectElement,
    requestReasonEl: getRequiredElement(doc, 'request-reason') as HTMLInputElement,
    btnSubmitRequest: getRequiredElement(doc, 'btn-submit-request') as HTMLButtonElement,
    requestStatusEl: getRequiredElement(doc, 'request-status'),
  };
}

export function registerPopupEventHandlers(input: {
  doc?: Pick<PopupDocumentLike, 'addEventListener'>;
  elements: Pick<
    PopupElements,
    | 'btnCopy'
    | 'btnClear'
    | 'btnVerify'
    | 'btnRequest'
    | 'btnSubmitRequest'
    | 'requestDomainSelectEl'
    | 'requestReasonEl'
    | 'domainsListEl'
  >;
  onClear: () => void;
  onCopy: () => void;
  onDomReady: () => void;
  onRequestInputChange: () => void;
  onRetryUpdate: (hostname: string) => void;
  onSubmitRequest: () => void;
  onToggleRequest: () => void;
  onVerify: () => void;
}): void {
  input.elements.btnCopy.addEventListener('click', input.onCopy);
  input.elements.btnClear.addEventListener('click', input.onClear);
  input.elements.btnVerify.addEventListener('click', input.onVerify);
  input.elements.btnRequest.addEventListener('click', input.onToggleRequest);
  input.elements.btnSubmitRequest.addEventListener('click', input.onSubmitRequest);
  input.elements.requestDomainSelectEl.addEventListener('change', input.onRequestInputChange);
  input.elements.requestReasonEl.addEventListener('input', input.onRequestInputChange);
  input.elements.domainsListEl.addEventListener('click', (event) => {
    const target = event.target as
      | {
          classList?: { contains: (className: string) => boolean };
          dataset?: { hostname?: string };
        }
      | undefined;

    if (!target?.classList?.contains('retry-update-btn')) {
      return;
    }

    const hostname = target.dataset?.hostname;
    if (!hostname) {
      return;
    }

    input.onRetryUpdate(hostname);
  });

  (input.doc ?? document).addEventListener('DOMContentLoaded', input.onDomReady);
}
