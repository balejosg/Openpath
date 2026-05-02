export interface FirefoxReleaseMetadata {
  extensionId: string;
  version: string;
  installUrl?: string;
  payloadHash: string;
}

export function verifyFirefoxReleaseArtifacts(options: {
  releaseDir?: string;
  payloadHash: string;
}): FirefoxReleaseMetadata;
