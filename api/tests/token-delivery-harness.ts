import assert from 'node:assert';
import type { Server } from 'node:http';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bearerAuth,
  getAvailablePort,
  parseTRPC,
  resetDb,
  trpcMutate as _trpcMutate,
} from './test-utils.js';
import { closeConnection } from '../src/db/index.js';
import { clearLinuxAgentAptMetadataCache } from '../src/lib/server-assets.js';

const currentFilePath = fileURLToPath(import.meta.url);
const apiTestsDir = dirname(currentFilePath);
const apiRoot = resolve(apiTestsDir, '..');
const serverVersionFilePath = resolve(apiRoot, '../VERSION');

export const tokenDeliveryArtifacts = {
  linuxAgentVersion: readFileSync(serverVersionFilePath, 'utf8').trim() || '0.0.0',
  linuxAgentBuildRoot: resolve(apiRoot, '../build'),
  firefoxExtensionRoot: resolve(apiRoot, '../firefox-extension'),
};

export const linuxAgentPackageFileName = `openpath-dnsmasq_${tokenDeliveryArtifacts.linuxAgentVersion}-1_amd64.deb`;
export const linuxAgentPackageFilePath = resolve(
  tokenDeliveryArtifacts.linuxAgentBuildRoot,
  linuxAgentPackageFileName
);
export const firefoxReleaseBuildRoot = resolve(
  tokenDeliveryArtifacts.firefoxExtensionRoot,
  'build/firefox-release'
);
export const firefoxReleaseMetadataPath = resolve(firefoxReleaseBuildRoot, 'metadata.json');
export const firefoxReleaseXpiPath = resolve(
  firefoxReleaseBuildRoot,
  'openpath-firefox-extension.xpi'
);
export const chromiumManagedBuildRoot = resolve(
  tokenDeliveryArtifacts.firefoxExtensionRoot,
  'build/chromium-managed'
);
export const chromiumManagedMetadataPath = resolve(chromiumManagedBuildRoot, 'metadata.json');
export const chromiumManagedCrxPath = resolve(
  chromiumManagedBuildRoot,
  'openpath-chromium-extension.crx'
);

export interface TokenDeliveryHarness {
  apiUrl: string;
  adminEmail: string;
  adminPassword: string;
  registrationToken: string;
  close: () => Promise<void>;
  getEnrollmentToken: (classroomId: string) => Promise<string>;
  loginAdmin: () => Promise<string>;
  trpcMutate: (procedure: string, input: unknown) => Promise<Response>;
}

export function extractMachineToken(whitelistUrl: string): string {
  const match = /\/w\/([^/]+)\//.exec(whitelistUrl);
  assert.ok(match, `Expected tokenized whitelist URL, got: ${whitelistUrl}`);
  const token = match[1];
  assert.ok(token, `Expected machine token in URL: ${whitelistUrl}`);
  return token;
}

export function mockStableAptPackagesManifest(content: string): () => void {
  const originalFetch = globalThis.fetch;
  clearLinuxAgentAptMetadataCache();

  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);

    if (url.endsWith('/dists/stable/main/binary-amd64/Packages')) {
      return new Response(content, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
    clearLinuxAgentAptMetadataCache();
  };
}

export function cleanTokenDeliveryArtifacts(): void {
  rmSync(tokenDeliveryArtifacts.linuxAgentBuildRoot, { recursive: true, force: true });
  rmSync(firefoxReleaseBuildRoot, { recursive: true, force: true });
  rmSync(chromiumManagedBuildRoot, { recursive: true, force: true });
}

export function writeLinuxAgentPackage(
  content: string,
  version = tokenDeliveryArtifacts.linuxAgentVersion
): {
  packageFileName: string;
  packageFilePath: string;
} {
  const packageFileName = `openpath-dnsmasq_${version}-1_amd64.deb`;
  const packageFilePath = resolve(tokenDeliveryArtifacts.linuxAgentBuildRoot, packageFileName);
  mkdirSync(tokenDeliveryArtifacts.linuxAgentBuildRoot, { recursive: true });
  writeFileSync(packageFilePath, content);
  return { packageFileName, packageFilePath };
}

export function writeFirefoxReleaseArtifacts(version: string, payload: string): void {
  mkdirSync(firefoxReleaseBuildRoot, { recursive: true });
  writeFileSync(
    firefoxReleaseMetadataPath,
    JSON.stringify({
      extensionId: 'monitor-bloqueos@openpath',
      version,
    })
  );
  writeFileSync(firefoxReleaseXpiPath, payload);
}

export function writeChromiumManagedArtifacts(version: string, payload: string): void {
  mkdirSync(chromiumManagedBuildRoot, { recursive: true });
  writeFileSync(
    chromiumManagedMetadataPath,
    JSON.stringify({
      extensionId: 'abcdefghijklmnopabcdefghijklmnop',
      version,
    })
  );
  writeFileSync(chromiumManagedCrxPath, payload);
}

export async function startTokenDeliveryHarness(): Promise<TokenDeliveryHarness> {
  await resetDb();
  cleanTokenDeliveryArtifacts();

  const port = await getAvailablePort();
  const apiUrl = `http://localhost:${String(port)}`;
  const previousPort = process.env.PORT;
  const previousSharedSecret = process.env.SHARED_SECRET;

  process.env.PORT = String(port);
  process.env.SHARED_SECRET = 'test-shared-secret';

  const { app } = await import('../src/server.js');
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(port, () => {
      console.log(`Token delivery test server started on port ${String(port)}`);
      resolve(listener);
    });
  });

  const trpcMutate = (procedure: string, input: unknown): Promise<Response> =>
    _trpcMutate(apiUrl, procedure, input);

  const adminEmail = `token-admin-${String(Date.now())}@example.com`;
  const adminPassword = 'SecurePassword123!';
  const createAdminResponse = await trpcMutate('setup.createFirstAdmin', {
    email: adminEmail,
    name: 'Token Test Admin',
    password: adminPassword,
  });
  const createAdminParsed = await parseTRPC(createAdminResponse);
  const createAdminData = createAdminParsed.data as { registrationToken?: string };
  assert.ok(createAdminData.registrationToken);

  const loginAdmin = async (): Promise<string> => {
    const loginResponse = await trpcMutate('auth.login', {
      email: adminEmail,
      password: adminPassword,
    });
    assert.strictEqual(loginResponse.status, 200);

    const loginParsed = await parseTRPC(loginResponse);
    const loginData = loginParsed.data as { accessToken?: string };
    assert.ok(loginData.accessToken);
    return loginData.accessToken;
  };

  const getEnrollmentToken = async (classroomId: string): Promise<string> => {
    const accessToken = await loginAdmin();
    const ticketResponse = await fetch(`${apiUrl}/api/enroll/${classroomId}/ticket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.strictEqual(ticketResponse.status, 200);

    const ticketData = (await ticketResponse.json()) as {
      success: boolean;
      enrollmentToken?: string;
    };
    assert.strictEqual(ticketData.success, true);
    assert.ok(ticketData.enrollmentToken);
    return ticketData.enrollmentToken;
  };

  const restoreEnv = (): void => {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }

    if (previousSharedSecret === undefined) {
      delete process.env.SHARED_SECRET;
    } else {
      process.env.SHARED_SECRET = previousSharedSecret;
    }
  };

  return {
    apiUrl,
    adminEmail,
    adminPassword,
    registrationToken: createAdminData.registrationToken,
    trpcMutate,
    loginAdmin,
    getEnrollmentToken,
    close: async () => {
      await resetDb();
      cleanTokenDeliveryArtifacts();

      if ('closeAllConnections' in server && typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }

      await new Promise<void>((resolve) => {
        server.close(() => {
          console.log('Token delivery test server closed');
          resolve();
        });
      });

      restoreEnv();
      await closeConnection();
    },
  };
}

export async function createBlockedSubdomainRule(options: {
  apiUrl: string;
  accessToken: string;
  groupId: string;
  value: string;
  comment: string;
}): Promise<void> {
  const response = await _trpcMutate(
    options.apiUrl,
    'groups.createRule',
    {
      groupId: options.groupId,
      type: 'blocked_subdomain',
      value: options.value,
      comment: options.comment,
    },
    bearerAuth(options.accessToken)
  );
  assert.strictEqual(response.status, 200);

  const parsed = await parseTRPC(response);
  const data = parsed.data as { id?: string };
  assert.ok(data.id);
}
