import assert from 'node:assert/strict';
import test from 'node:test';

void test('resolves the react-spa dist path for source and built layouts', async () => {
  const { getReactSpaPath } = await import('../src/app-bootstrap-helpers.js');

  assert.equal(
    getReactSpaPath('/workspace/OpenPath/api/src'),
    '/workspace/OpenPath/react-spa/dist'
  );
  assert.equal(
    getReactSpaPath('/workspace/OpenPath/api/dist/src'),
    '/workspace/OpenPath/react-spa/dist'
  );
});

void test('disables compression only for machine event streams', async () => {
  const { shouldBypassCompression } = await import('../src/app-bootstrap-helpers.js');

  assert.equal(shouldBypassCompression('/api/machines/events'), true);
  assert.equal(shouldBypassCompression('/health'), false);
});

void test('serves the spa fallback only for non-api urls', async () => {
  const { shouldServeSpaFallback } = await import('../src/app-bootstrap-helpers.js');

  assert.equal(shouldServeSpaFallback('/'), true);
  assert.equal(shouldServeSpaFallback('/groups'), true);
  assert.equal(shouldServeSpaFallback('/api/health'), false);
  assert.equal(shouldServeSpaFallback('/trpc/groups.list'), false);
  assert.equal(shouldServeSpaFallback('/api-docs'), false);
});
