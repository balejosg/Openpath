import { after, before, describe, test } from 'node:test';
import assert from 'node:assert';

import { createFixtureClassroom } from './fixtures.js';
import {
  startTokenDeliveryHarness,
  type TokenDeliveryHarness,
  writeChromiumManagedArtifacts,
  writeFirefoxReleaseArtifacts,
} from './token-delivery-harness.js';

let harness: TokenDeliveryHarness;

void describe('Extension and release delivery', { timeout: 30000 }, async () => {
  before(async () => {
    harness = await startTokenDeliveryHarness();
  });

  after(async () => {
    await harness.close();
  });

  await describe('Windows bootstrap extension assets', async () => {
    let enrollmentToken = '';
    let classroomId = '';

    before(async () => {
      classroomId = await createFixtureClassroom({
        name: 'WindowsBootstrapClassroom',
        groupId: 'windows-bootstrap-group',
      });
      enrollmentToken = await harness.getEnrollmentToken(classroomId);
    });

    await test('should include Firefox extension assets in the Windows bootstrap manifest', async () => {
      const manifestResponse = await fetch(
        `${harness.apiUrl}/api/agent/windows/bootstrap/manifest`,
        {
          headers: { Authorization: `Bearer ${enrollmentToken}` },
        }
      );

      assert.strictEqual(manifestResponse.status, 200);
      const manifest = (await manifestResponse.json()) as {
        success: boolean;
        files: { path: string; sha256: string; size: number }[];
      };

      assert.strictEqual(manifest.success, true);
      assert.ok(
        manifest.files.some((file) => file.path === 'browser-extension/firefox/manifest.json')
      );
      assert.ok(
        manifest.files.some((file) => file.path === 'browser-extension/firefox/dist/background.js')
      );
    });

    await test('should include signed Firefox release artifacts in the Windows bootstrap manifest when available', async () => {
      writeFirefoxReleaseArtifacts('2.0.0', 'fake-signed-firefox-xpi');

      const manifestResponse = await fetch(
        `${harness.apiUrl}/api/agent/windows/bootstrap/manifest`,
        {
          headers: { Authorization: `Bearer ${enrollmentToken}` },
        }
      );

      assert.strictEqual(manifestResponse.status, 200);
      const manifest = (await manifestResponse.json()) as {
        success: boolean;
        files: { path: string; sha256: string; size: number }[];
      };

      assert.strictEqual(manifest.success, true);
      assert.ok(
        manifest.files.some(
          (file) => file.path === 'browser-extension/firefox-release/metadata.json'
        )
      );
      assert.ok(
        manifest.files.some(
          (file) => file.path === 'browser-extension/firefox-release/openpath-firefox-extension.xpi'
        )
      );
    });
  });

  await describe('Public extension release endpoints', async () => {
    await test('should publish Firefox release XPI endpoint when signed artifacts exist', async () => {
      writeFirefoxReleaseArtifacts('2.0.0.23002', 'fake-firefox-release-xpi');

      const xpiResponse = await fetch(`${harness.apiUrl}/api/extensions/firefox/openpath.xpi`);
      assert.strictEqual(xpiResponse.status, 200);
      assert.match(
        xpiResponse.headers.get('content-type') ?? '',
        /application\/x-xpinstall|application\/x-xpinstall;|application\/octet-stream/
      );
      assert.strictEqual(await xpiResponse.text(), 'fake-firefox-release-xpi');
    });

    await test('should publish Chromium managed rollout endpoints when build artifacts exist', async () => {
      writeChromiumManagedArtifacts('2.0.0', 'fake-crx-payload');

      const manifestResponse = await fetch(`${harness.apiUrl}/api/extensions/chromium/updates.xml`);
      assert.strictEqual(manifestResponse.status, 200);
      assert.match(manifestResponse.headers.get('content-type') ?? '', /xml/);

      const xmlBody = await manifestResponse.text();
      assert.match(xmlBody, /abcdefghijklmnopabcdefghijklmnop/);
      assert.match(xmlBody, /openpath\.crx/);
      assert.match(xmlBody, /version="2\.0\.0"/);

      const crxResponse = await fetch(`${harness.apiUrl}/api/extensions/chromium/openpath.crx`);
      assert.strictEqual(crxResponse.status, 200);
      assert.match(
        crxResponse.headers.get('content-type') ?? '',
        /application\/x-chrome-extension|application\/octet-stream/
      );
      assert.strictEqual(await crxResponse.text(), 'fake-crx-payload');
    });
  });
});
