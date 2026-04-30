import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Runtime, WebRequest } from 'webextension-polyfill';

import {
  buildAutoAllowCandidateFromMessage,
  buildAutoAllowCandidateFromWebRequest,
  isEligibleAutoAllowCandidate,
} from '../src/lib/page-resource-auto-allow-intake.js';

function messageSender(tab: { id: number; url: string }): Runtime.MessageSender {
  return { tab } as Runtime.MessageSender;
}

void describe('page resource auto-allow intake', () => {
  void test('maps content-script fetch candidates to xmlhttprequest candidates', () => {
    const result = buildAutoAllowCandidateFromMessage(
      {
        action: 'openpathPageResourceCandidate',
        kind: 'fetch',
        pageUrl: 'https://lesson.example/app',
        resourceUrl: 'https://api.lesson-cdn.example/data.json',
      },
      messageSender({ id: 9, url: 'https://lesson.example/fallback' })
    );

    assert.deepEqual(result, {
      ok: true,
      candidate: {
        tabId: 9,
        hostname: 'api.lesson-cdn.example',
        originPage: 'https://lesson.example/app',
        requestType: 'xmlhttprequest',
        targetUrl: 'https://api.lesson-cdn.example/data.json',
      },
    });
  });

  void test('keeps content-script resource types for static subresources', () => {
    const kinds = ['image', 'script', 'stylesheet', 'font'] as const;

    for (const kind of kinds) {
      const result = buildAutoAllowCandidateFromMessage(
        {
          action: 'openpathPageResourceCandidate',
          kind,
          pageUrl: 'https://lesson.example/app',
          resourceUrl: `https://${kind}.lesson-cdn.example/resource`,
        },
        messageSender({ id: 4, url: 'https://lesson.example/fallback' })
      );

      assert.deepEqual(result, {
        ok: true,
        candidate: {
          tabId: 4,
          hostname: `${kind}.lesson-cdn.example`,
          originPage: 'https://lesson.example/app',
          requestType: kind,
          targetUrl: `https://${kind}.lesson-cdn.example/resource`,
        },
      });
    }
  });

  void test('rejects malformed content-script messages without a workflow candidate', () => {
    const result = buildAutoAllowCandidateFromMessage(
      {
        action: 'openpathPageResourceCandidate',
        kind: 'fetch',
        pageUrl: 'https://lesson.example/app',
      },
      messageSender({ id: 9, url: 'https://lesson.example/fallback' })
    );

    assert.deepEqual(result, { ok: false, error: 'resourceUrl is required' });
  });

  void test('rejects main-frame and sub-frame webRequest candidates', async () => {
    for (const requestType of ['main_frame', 'sub_frame'] as const) {
      const result = await buildAutoAllowCandidateFromWebRequest(
        {
          originUrl: 'https://lesson.example/app',
          tabId: 9,
          type: requestType,
          url: 'https://blocked.example/resource',
        } as WebRequest.OnBeforeRequestDetailsType,
        { getTabUrl: () => Promise.resolve('https://lesson.example/app') }
      );

      assert.deepEqual(result, {
        ok: false,
        error: `${requestType} requests are not eligible for page-resource auto-allow`,
      });
    }
  });

  void test('maps missing webRequest type with originUrl to other', async () => {
    const result = await buildAutoAllowCandidateFromWebRequest(
      {
        originUrl: 'https://lesson.example/app',
        tabId: 12,
        url: 'https://api.blocked.example/data.json',
      } as WebRequest.OnBeforeRequestDetailsType,
      { getTabUrl: () => Promise.resolve(undefined) }
    );

    assert.deepEqual(result, {
      ok: true,
      candidate: {
        tabId: 12,
        hostname: 'api.blocked.example',
        originPage: 'https://lesson.example/app',
        requestType: 'other',
        targetUrl: 'https://api.blocked.example/data.json',
      },
    });
  });

  void test('rejects extension URLs', async () => {
    const result = await buildAutoAllowCandidateFromWebRequest(
      {
        originUrl: 'https://lesson.example/app',
        tabId: 12,
        type: 'script',
        url: 'moz-extension://openpath/content.js',
      } as WebRequest.OnBeforeRequestDetailsType,
      { getTabUrl: () => Promise.resolve('https://lesson.example/app') }
    );

    assert.deepEqual(result, {
      ok: false,
      error: 'target URL is not eligible for page-resource auto-allow',
    });
  });

  void test('prefers valid tab URL origin when it differs from target', async () => {
    const result = await buildAutoAllowCandidateFromWebRequest(
      {
        originUrl: 'https://fonts.googleapis.com/css2?family=Inter',
        tabId: 41,
        type: 'font',
        url: 'https://fonts.gstatic.com/s/inter/v12/font.woff2',
      } as WebRequest.OnBeforeRequestDetailsType,
      { getTabUrl: () => Promise.resolve('https://www.reddit.com/r/openpath') }
    );

    assert.deepEqual(result, {
      ok: true,
      candidate: {
        tabId: 41,
        hostname: 'fonts.gstatic.com',
        originPage: 'https://www.reddit.com/r/openpath',
        requestType: 'font',
        targetUrl: 'https://fonts.gstatic.com/s/inter/v12/font.woff2',
      },
    });
  });

  void test('uses originUrl or documentUrl when tab lookup fails', async () => {
    const originResult = await buildAutoAllowCandidateFromWebRequest(
      {
        originUrl: 'https://lesson.example/app',
        tabId: 13,
        type: 'xmlhttprequest',
        url: 'https://api.blocked.example/data.json',
      } as WebRequest.OnBeforeRequestDetailsType,
      { getTabUrl: () => Promise.reject(new Error('tab closed')) }
    );

    assert.deepEqual(originResult, {
      ok: true,
      candidate: {
        tabId: 13,
        hostname: 'api.blocked.example',
        originPage: 'https://lesson.example/app',
        requestType: 'xmlhttprequest',
        targetUrl: 'https://api.blocked.example/data.json',
      },
    });

    const documentResult = await buildAutoAllowCandidateFromWebRequest(
      {
        documentUrl: 'https://lesson.example/doc',
        tabId: 13,
        type: 'script',
        url: 'https://cdn.blocked.example/asset.js',
      } as WebRequest.OnBeforeRequestDetailsType,
      { getTabUrl: () => Promise.resolve(undefined) }
    );

    assert.deepEqual(documentResult, {
      ok: true,
      candidate: {
        tabId: 13,
        hostname: 'cdn.blocked.example',
        originPage: 'https://lesson.example/doc',
        requestType: 'script',
        targetUrl: 'https://cdn.blocked.example/asset.js',
      },
    });
  });

  void test('uses current reddit tab URL when Firefox omits origin and type for preview image requests', async () => {
    const result = await buildAutoAllowCandidateFromWebRequest(
      {
        tabId: 27,
        url: 'https://preview.redd.it/my-paprika-had-no-seeds-v0-0q7k5y7403yg1.jpeg?width=1080&crop=smart',
      } as WebRequest.OnBeforeRequestDetailsType,
      { getTabUrl: () => Promise.resolve('https://www.reddit.com/r/openpath/comments/demo') }
    );

    assert.deepEqual(result, {
      ok: true,
      candidate: {
        tabId: 27,
        hostname: 'preview.redd.it',
        originPage: 'https://www.reddit.com/r/openpath/comments/demo',
        requestType: 'other',
        targetUrl:
          'https://preview.redd.it/my-paprika-had-no-seeds-v0-0q7k5y7403yg1.jpeg?width=1080&crop=smart',
      },
    });
  });

  void test('checks normalized candidate eligibility', () => {
    assert.equal(
      isEligibleAutoAllowCandidate({
        tabId: -1,
        hostname: 'api.blocked.example',
        originPage: null,
        requestType: 'script',
        targetUrl: 'https://api.blocked.example/data.json',
      }),
      false
    );
  });
});
