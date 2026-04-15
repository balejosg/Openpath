import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import {
  DOCKER_MANIFEST_CASES,
  compareSemver,
  listStableReleaseTags,
  projectRoot,
  readJson,
  readPackageJson,
  readText,
  walkTextFiles,
} from './support.mjs';

describe('repository verification contract', () => {
  test('release-please manifest is not behind the latest stable release tag', () => {
    const manifest = readJson('.release-please-manifest.json');
    const manifestVersion = String(manifest['.'] ?? '').trim();
    const latestStableTag = listStableReleaseTags()[0] ?? '';
    const latestStableVersion = latestStableTag.replace(/^v/, '');

    assert.ok(
      manifestVersion,
      '.release-please-manifest.json should define the root release version'
    );
    assert.ok(latestStableTag, 'repository should expose at least one stable v* tag');
    assert.ok(
      compareSemver(manifestVersion, latestStableVersion) >= 0,
      `release-please manifest (${manifestVersion}) is behind the latest stable tag (${latestStableTag})`
    );
  });

  test('verify:full overlaps coverage with unit tests and overlaps e2e with security', () => {
    const packageJson = readPackageJson();
    const verifyFull = packageJson.scripts['verify:full'];
    const verifyFullScript = readText('scripts/verify-full.sh');

    assert.equal(verifyFull, 'bash scripts/verify-full.sh');
    assert.ok(verifyFullScript.includes('npm run verify:static'));
    assert.ok(verifyFullScript.includes('npm run verify:checks'));
    assert.ok(
      verifyFullScript.includes(
        "concurrently --group --names 'coverage,unit' 'npm:verify:coverage' 'npm:verify:unit'"
      )
    );
    assert.ok(
      verifyFullScript.includes(
        "concurrently --group --names 'e2e,security' 'npm:e2e:full' 'npm:verify:security'"
      )
    );
  });

  test('playwright e2e startup uses a stable API server and only reuses an existing server when explicitly requested', () => {
    const playwrightConfig = readText('react-spa/playwright.config.ts');
    const e2eStartupScript = readText('scripts/start-api-e2e.sh');

    assert.ok(
      playwrightConfig.includes("reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1'"),
      'playwright.config.ts should only reuse an existing API server when PLAYWRIGHT_REUSE_SERVER=1'
    );
    assert.ok(
      e2eStartupScript.includes('npm run build --workspace=@openpath/shared'),
      'start-api-e2e.sh should build @openpath/shared before starting the E2E API server'
    );
    assert.ok(
      e2eStartupScript.includes('npm run build --workspace=@openpath/api'),
      'start-api-e2e.sh should build @openpath/api before starting the E2E API server'
    );
    assert.ok(
      e2eStartupScript.includes('npm run start --workspace=@openpath/api'),
      'start-api-e2e.sh should launch the compiled API server for E2E runs'
    );
    assert.ok(
      !e2eStartupScript.includes('npm run dev'),
      'start-api-e2e.sh should not launch the watch-mode API server during E2E runs'
    );
  });

  test('lockfile keeps vite above the current high-severity advisory range', () => {
    const packageLock = readJson('package-lock.json');
    const viteVersion = packageLock.packages['node_modules/vite']?.version;

    assert.ok(viteVersion, 'package-lock.json should record the resolved vite version');
    assert.ok(
      compareSemver(viteVersion, '7.3.1') > 0,
      `vite ${viteVersion} is within the blocked advisory range ending at 7.3.1`
    );
  });

  test('pre-commit stays on the fast staged guard without re-running coverage', () => {
    const hook = readFileSync(resolve(projectRoot, '.husky/pre-commit'), 'utf8');

    assert.ok(
      hook.includes('[2/2] Running staged verification...'),
      'pre-commit should keep the staged verification step as its final fast guard'
    );
    assert.ok(
      !hook.includes('npm run verify:coverage'),
      'pre-commit should not run verify:coverage directly'
    );
    assert.ok(
      !hook.includes('check-test-files.sh'),
      'pre-commit should leave repo-wide test-file checks for pre-push'
    );
    assert.ok(!hook.includes('[3/3]'), 'pre-commit should keep the staged guard lean');
  });

  test('api Dockerfile uses dependency-only manifests and npm cache mounts', () => {
    const dockerfile = readFileSync(resolve(projectRoot, 'api/Dockerfile'), 'utf8');

    assert.ok(
      dockerfile.includes('# syntax=docker/dockerfile:1.7'),
      'api Dockerfile should opt into Dockerfile features required for cache mounts'
    );

    for (const manifestCase of DOCKER_MANIFEST_CASES) {
      const targetPath = manifestCase.packagePath.replace(/package\.json$/, 'package.json');
      assert.ok(
        dockerfile.includes(`COPY ${manifestCase.dockerPackagePath} ./${targetPath}`),
        `api Dockerfile should use ${manifestCase.dockerPackagePath} during npm ci`
      );
    }

    assert.ok(
      dockerfile.includes('--mount=type=cache,target=/root/.npm'),
      'api Dockerfile should cache npm downloads across repeated image builds'
    );
    assert.ok(
      dockerfile.includes('COPY runtime ./runtime') ||
        dockerfile.includes('COPY runtime/ ./runtime/'),
      'api Dockerfile should copy shared runtime assets into the builder context'
    );
    assert.ok(
      dockerfile.includes('COPY --from=builder /app/runtime ./runtime'),
      'api Dockerfile should preserve shared runtime assets in the runtime image'
    );
  });

  test('linux and windows clients do not reference the legacy classroom whitelist source', () => {
    const forbiddenFragments = ['LasEncinasIT', 'Whitelist-por-aula', 'Informatica%203.txt'];
    const clientRoots = ['linux', 'windows'];

    for (const root of clientRoots) {
      const files = walkTextFiles(root);

      for (const relativePath of files) {
        if (relativePath.includes('/node_modules/')) {
          continue;
        }

        if (
          relativePath.endsWith('.deb') ||
          relativePath.endsWith('.dll') ||
          relativePath.endsWith('.exe')
        ) {
          continue;
        }

        if (relativePath.includes('/dist/')) {
          continue;
        }

        if (relativePath.includes('/bin/')) {
          continue;
        }

        if (relativePath.includes('/obj/')) {
          continue;
        }

        const content = readText(relativePath);

        for (const forbidden of forbiddenFragments) {
          assert.ok(
            !content.includes(forbidden),
            `${relativePath} should not reference legacy classroom whitelist sources`
          );
        }
      }
    }
  });
});
