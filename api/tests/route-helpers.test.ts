import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

interface MockResponse {
  headersSent: boolean;
  status: (code: number) => MockResponse;
  json: (body: unknown) => MockResponse;
  send: (body: unknown) => MockResponse;
}

function createMockResponse(): {
  response: never;
  readonly statusCode: number;
  readonly jsonBody: unknown;
  readonly textBody: unknown;
} {
  let statusCode = 200;
  let jsonBody: unknown;
  let textBody: unknown;

  const response: MockResponse = {
    headersSent: false,
    status(code: number): MockResponse {
      statusCode = code;
      return this;
    },
    json(body: unknown): MockResponse {
      jsonBody = body;
      return this;
    },
    send(body: unknown): MockResponse {
      textBody = body;
      return this;
    },
  };

  return {
    response: response as never,
    get statusCode(): number {
      return statusCode;
    },
    get jsonBody(): unknown {
      return jsonBody;
    },
    get textBody(): unknown {
      return textBody;
    },
  };
}

await describe('route helpers', async () => {
  const {
    createAsyncRouteHandler,
    sendJsonError,
    sendJsonInternalError,
    sendTextError,
    sendTextInternalError,
  } = await import('../src/routes/route-helpers.js');

  await test('sendJsonError and sendTextError write the expected payloads', () => {
    const json = createMockResponse();
    sendJsonError(json.response, 418, 'teapot', { reason: 'unit-test' });
    assert.equal(json.statusCode, 418);
    assert.deepEqual(json.jsonBody, {
      success: false,
      error: 'teapot',
      reason: 'unit-test',
    });

    const text = createMockResponse();
    sendTextError(text.response, 503, 'unavailable');
    assert.equal(text.statusCode, 503);
    assert.equal(text.textBody, 'unavailable');
  });

  await test('internal error helpers use the default message', () => {
    const json = createMockResponse();
    sendJsonInternalError(json.response);
    assert.equal(json.statusCode, 500);
    assert.deepEqual(json.jsonBody, { success: false, error: 'Internal error' });

    const text = createMockResponse();
    sendTextInternalError(text.response);
    assert.equal(text.statusCode, 500);
    assert.equal(text.textBody, 'Internal error');
  });

  await test('createAsyncRouteHandler catches failures and delegates to the error responder', async () => {
    const target = createMockResponse();
    const handler = createAsyncRouteHandler(
      'route failed',
      (res) => {
        sendJsonInternalError(res, 'caught');
      },
      () => {
        return Promise.reject(new Error('boom'));
      }
    );

    handler({} as never, target.response);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(target.statusCode, 500);
    assert.deepEqual(target.jsonBody, { success: false, error: 'caught' });
  });

  await test('createAsyncRouteHandler does not write a fallback response after headers are sent', async () => {
    let onErrorCalls = 0;
    const target = createMockResponse();
    (target.response as { headersSent: boolean }).headersSent = true;

    const handler = createAsyncRouteHandler(
      'route failed after write',
      () => {
        onErrorCalls += 1;
      },
      () => {
        return Promise.reject(new Error('boom'));
      }
    );

    handler({} as never, target.response);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(onErrorCalls, 0);
    assert.equal(target.statusCode, 200);
    assert.equal(target.jsonBody, undefined);
  });
});
