#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const scriptDir = dirname(currentFilePath);
const projectRoot = resolve(scriptDir, '..');
const FIREFOX_MANIFEST_PATH = resolve(projectRoot, 'firefox-extension/manifest.json');
const BROWSER_POLICY_SPEC_PATH = resolve(projectRoot, 'runtime/browser-policy-spec.json');

/**
 * @typedef {{
 *   version: 1;
 *   openpathSha: string;
 *   packageVersion: string;
 *   linuxAgentVersion: string;
 *   aptSuite: 'stable' | 'unstable';
 *   firefoxExtensionVersion: string;
 *   browserPolicySpecSha256: string;
 * }} OpenPathPromotionContract
 */

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function buildOpenPathPromotionContract({
  openpathSha,
  packageVersion,
  linuxAgentVersion,
  aptSuite,
  firefoxExtensionVersion,
  browserPolicySpecSha256,
}) {
  const normalizedAptSuite = String(aptSuite ?? '').trim();
  if (normalizedAptSuite !== 'stable' && normalizedAptSuite !== 'unstable') {
    throw new Error(`Unsupported aptSuite: ${normalizedAptSuite || 'unset'}`);
  }

  for (const [key, value] of Object.entries({
    openpathSha,
    packageVersion,
    linuxAgentVersion,
    firefoxExtensionVersion,
    browserPolicySpecSha256,
  })) {
    if (!String(value ?? '').trim()) {
      throw new Error(`${key} is required`);
    }
  }

  return /** @type {OpenPathPromotionContract} */ ({
    version: 1,
    openpathSha: String(openpathSha).trim(),
    packageVersion: String(packageVersion).trim(),
    linuxAgentVersion: String(linuxAgentVersion).trim(),
    aptSuite: normalizedAptSuite,
    firefoxExtensionVersion: String(firefoxExtensionVersion).trim(),
    browserPolicySpecSha256: String(browserPolicySpecSha256).trim(),
  });
}

export function serializeOpenPathPromotionContract(contract) {
  return `${JSON.stringify(contract, null, 2)}\n`;
}

function parseCliArgs(argv) {
  /** @type {Record<string, string>} */
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1] ?? '';

    switch (arg) {
      case '--output':
        parsed.output = value;
        index += 1;
        break;
      case '--openpath-sha':
        parsed.openpathSha = value;
        index += 1;
        break;
      case '--package-version':
        parsed.packageVersion = value;
        index += 1;
        break;
      case '--linux-agent-version':
        parsed.linuxAgentVersion = value;
        index += 1;
        break;
      case '--apt-suite':
        parsed.aptSuite = value;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function buildOpenPathPromotionContractFromRepo({
  openpathSha,
  packageVersion,
  linuxAgentVersion,
  aptSuite,
}) {
  const firefoxManifest = JSON.parse(readFileSync(FIREFOX_MANIFEST_PATH, 'utf8'));
  return buildOpenPathPromotionContract({
    openpathSha,
    packageVersion,
    linuxAgentVersion: linuxAgentVersion || packageVersion,
    aptSuite,
    firefoxExtensionVersion: String(firefoxManifest.version ?? '').trim(),
    browserPolicySpecSha256: sha256File(BROWSER_POLICY_SPEC_PATH),
  });
}

function runCli() {
  const [command, ...args] = process.argv.slice(2);
  if (command !== 'write') {
    return;
  }

  const parsed = parseCliArgs(args);
  const output = String(parsed.output ?? '').trim();
  if (!output) {
    throw new Error('--output is required');
  }

  const contract = buildOpenPathPromotionContractFromRepo({
    openpathSha: parsed.openpathSha,
    packageVersion: parsed.packageVersion,
    linuxAgentVersion: parsed.linuxAgentVersion,
    aptSuite: parsed.aptSuite,
  });

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, serializeOpenPathPromotionContract(contract), 'utf8');
}

runCli();
