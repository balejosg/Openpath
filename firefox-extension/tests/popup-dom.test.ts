import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createPopupElements, registerPopupEventHandlers } from '../src/lib/popup-dom.js';

class FakeElement {
  listeners = new Map<string, ((event?: { target?: unknown }) => void)[]>();
  dataset: { hostname?: string } = {};

  addEventListener(type: string, listener: (event?: { target?: unknown }) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string, event?: { target?: unknown }): void {
    (this.listeners.get(type) ?? []).forEach((listener) => {
      listener(event);
    });
  }
}

class FakeDocument {
  listeners = new Map<string, (() => void)[]>();

  constructor(private readonly elements: Record<string, FakeElement>) {}

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string): void {
    (this.listeners.get(type) ?? []).forEach((listener) => {
      listener();
    });
  }

  getElementById(id: string): HTMLElement | null {
    return (this.elements[id] as HTMLElement | undefined) ?? null;
  }
}

function createPopupDocument(): {
  doc: FakeDocument;
  elements: Record<string, FakeElement>;
} {
  const elements = Object.fromEntries(
    [
      'tab-domain',
      'count',
      'domains-list',
      'empty-message',
      'btn-copy',
      'btn-verify',
      'btn-clear',
      'btn-request',
      'toast',
      'native-status',
      'verify-results',
      'verify-list',
      'request-section',
      'request-domain-select',
      'request-reason',
      'btn-submit-request',
      'request-status',
    ].map((id) => [id, new FakeElement()])
  ) as Record<string, FakeElement>;

  return {
    doc: new FakeDocument(elements),
    elements,
  };
}

function requireElement(elements: Record<string, FakeElement>, id: string): FakeElement {
  const element = elements[id];
  assert.ok(element, `Expected fake element ${id}`);
  return element;
}

await describe('popup dom helpers', async () => {
  await test('creates popup element references from the document', () => {
    const { doc, elements } = createPopupDocument();

    const popupElements = createPopupElements(doc);

    assert.equal(popupElements.btnCopy, elements['btn-copy']);
    assert.equal(popupElements.requestDomainSelectEl, elements['request-domain-select']);
    assert.equal(popupElements.verifyListEl, elements['verify-list']);
  });

  await test('throws when a required element is missing', () => {
    const { doc } = createPopupDocument();
    const missingDoc = {
      addEventListener: doc.addEventListener.bind(doc),
      getElementById(id: string): HTMLElement | null {
        if (id === 'btn-copy') {
          return null;
        }
        return doc.getElementById(id);
      },
    };

    assert.throws(() => createPopupElements(missingDoc), /Required element #btn-copy not found/);
  });

  await test('registers popup event handlers and forwards retry clicks', () => {
    const { doc, elements } = createPopupDocument();
    const calls: string[] = [];

    registerPopupEventHandlers({
      doc,
      elements: {
        btnCopy: requireElement(elements, 'btn-copy') as unknown as HTMLButtonElement,
        btnClear: requireElement(elements, 'btn-clear') as unknown as HTMLButtonElement,
        btnRequest: requireElement(elements, 'btn-request') as unknown as HTMLButtonElement,
        btnSubmitRequest: requireElement(
          elements,
          'btn-submit-request'
        ) as unknown as HTMLButtonElement,
        btnVerify: requireElement(elements, 'btn-verify') as unknown as HTMLButtonElement,
        domainsListEl: requireElement(elements, 'domains-list') as unknown as HTMLElement,
        requestDomainSelectEl: requireElement(
          elements,
          'request-domain-select'
        ) as unknown as HTMLSelectElement,
        requestReasonEl: requireElement(elements, 'request-reason') as unknown as HTMLInputElement,
      },
      onClear: () => calls.push('clear'),
      onCopy: () => calls.push('copy'),
      onDomReady: () => calls.push('ready'),
      onRequestInputChange: () => calls.push('input'),
      onRetryUpdate: (hostname) => calls.push(`retry:${hostname}`),
      onSubmitRequest: () => calls.push('submit'),
      onToggleRequest: () => calls.push('toggle'),
      onVerify: () => calls.push('verify'),
    });

    requireElement(elements, 'btn-copy').dispatch('click');
    requireElement(elements, 'btn-clear').dispatch('click');
    requireElement(elements, 'btn-verify').dispatch('click');
    requireElement(elements, 'btn-request').dispatch('click');
    requireElement(elements, 'btn-submit-request').dispatch('click');
    requireElement(elements, 'request-domain-select').dispatch('change');
    requireElement(elements, 'request-reason').dispatch('input');
    requireElement(elements, 'domains-list').dispatch('click', {
      target: {
        classList: {
          contains(className: string): boolean {
            return className === 'retry-update-btn';
          },
        },
        dataset: { hostname: 'cdn.example.com' },
      },
    });
    doc.dispatch('DOMContentLoaded');

    assert.deepEqual(calls, [
      'copy',
      'clear',
      'verify',
      'toggle',
      'submit',
      'input',
      'input',
      'retry:cdn.example.com',
      'ready',
    ]);
  });
});
