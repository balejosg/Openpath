#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(import.meta.dirname, '..');

const WORKSPACE_ORDER = [
  { prefix: 'shared/src/', workspace: '@openpath/shared' },
  { prefix: 'api/src/', workspace: '@openpath/api' },
  { prefix: 'react-spa/src/', workspace: '@openpath/react-spa' },
  { prefix: 'dashboard/src/', workspace: '@openpath/dashboard' },
  { prefix: 'firefox-extension/src/', workspace: '@openpath/firefox-extension' },
];

function getChangedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf-8',
      cwd: ROOT_DIR,
    });

    return output.split('\n').filter((file) => file.trim());
  } catch (error) {
    console.error('Failed to read staged files:', error.message);
    process.exit(1);
  }
}

function getCoverageWorkspaces(files) {
  const workspaces = new Set();

  for (const file of files) {
    if (!/\.(ts|tsx)$/.test(file)) {
      continue;
    }

    for (const { prefix, workspace } of WORKSPACE_ORDER) {
      if (file.startsWith(prefix)) {
        workspaces.add(workspace);
        break;
      }
    }
  }

  return WORKSPACE_ORDER.map(({ workspace }) => workspace).filter((workspace) =>
    workspaces.has(workspace)
  );
}

function main() {
  console.log('Preparing coverage reports for changed workspaces...');

  const files = getChangedFiles();
  const workspaces = getCoverageWorkspaces(files);

  if (workspaces.length === 0) {
    console.log('No changed source workspaces require coverage generation.');
    return;
  }

  console.log(`Generating coverage for: ${workspaces.join(', ')}`);

  for (const workspace of workspaces) {
    console.log(`\n--- Coverage for ${workspace} ---\n`);
    execSync(`npm run test:coverage --workspace=${workspace}`, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  }
}

main();
