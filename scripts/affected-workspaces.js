#!/usr/bin/env node
/**
 * affected-workspaces.js
 *
 * Detects which workspaces are affected by current changes and optionally runs their tests.
 *
 * Usage:
 *   node scripts/affected-workspaces.js              # List affected workspaces (working tree)
 *   node scripts/affected-workspaces.js --staged     # List affected workspaces (staged files)
 *   node scripts/affected-workspaces.js --run-tests  # Run tests for affected workspaces
 *   node scripts/affected-workspaces.js --json       # Output as JSON
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Workspace definitions: path prefix -> workspace name
const WORKSPACE_MAP = {
  'api/': '@openpath/api',
  'react-spa/': '@openpath/react-spa',
  'shared/': '@openpath/shared',
  'dashboard/': '@openpath/dashboard',
  'firefox-extension/': '@openpath/firefox-extension',
};

// Dependency graph: workspace -> workspaces that depend on it
const DEPENDENTS = {
  '@openpath/shared': ['@openpath/api', '@openpath/react-spa', '@openpath/dashboard'],
};

// Files that affect all workspaces
const GLOBAL_PATTERNS = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^tsconfig\.base\.json$/,
  /^eslint\.config\.js$/,
  /^\.prettierrc/,
];

export function getChangedFiles(staged = false) {
  if (process.env.OPENPATH_AFFECTED_FILES) {
    return process.env.OPENPATH_AFFECTED_FILES.split(/\r?\n|,/)
      .map((file) => file.trim())
      .filter(Boolean);
  }

  try {
    const cmd = staged
      ? 'git diff --cached --name-only --diff-filter=ACM'
      : 'git diff --name-only HEAD';
    const output = execSync(cmd, { cwd: ROOT, encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // Fallback: try unstaged changes
    try {
      const output = execSync('git diff --name-only', {
        cwd: ROOT,
        encoding: 'utf-8',
      });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

export function shouldUseWorkspaceFallback(files) {
  return files.some((file) => GLOBAL_PATTERNS.some((pattern) => pattern.test(file)));
}

export function parseTestFileMap(contents) {
  const mappings = new Map();

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [source, tests] = line.split('|');
    if (!source || !tests) continue;

    const testFiles = tests
      .split(',')
      .map((testFile) => testFile.trim())
      .filter(Boolean);

    if (testFiles.length > 0) {
      mappings.set(source.trim(), testFiles);
    }
  }

  return mappings;
}

export function findMappedTests(files, mappings) {
  const mapped = new Set();

  for (const file of files) {
    for (const testFile of mappings.get(file) ?? []) {
      mapped.add(testFile);
    }
  }

  return Array.from(mapped);
}

function findUnmappedFiles(files, mappings) {
  return files.filter((file) => !mappings.has(file));
}

export function groupTestsByWorkspace(testFiles) {
  const grouped = new Map();

  for (const testFile of testFiles) {
    const workspace =
      Object.entries(WORKSPACE_MAP).find(([prefix]) => testFile.startsWith(prefix))?.[1] ?? 'root';

    if (!grouped.has(workspace)) grouped.set(workspace, []);
    grouped.get(workspace).push(testFile);
  }

  return grouped;
}

export function buildMappedTestCommands(testFiles) {
  return Array.from(groupTestsByWorkspace(testFiles), ([workspace, tests]) => {
    const workspaceDir = workspace === 'root' ? null : workspace.replace('@openpath/', '');
    const relativeTests = workspaceDir
      ? tests.map((testFile) => testFile.slice(`${workspaceDir}/`.length))
      : tests;
    const command = buildExactTestCommand(workspace, workspaceDir, relativeTests);

    return { workspace, tests, command };
  });
}

function buildExactTestCommand(workspace, workspaceDir, tests) {
  if (workspace === '@openpath/react-spa') {
    return `cd ${workspaceDir} && npm exec -- vitest run ${tests.join(' ')}`;
  }

  if (workspace === '@openpath/firefox-extension') {
    return `cd ${workspaceDir} && npx tsx --test ${tests.join(' ')}`;
  }

  if (workspaceDir) {
    return `cd ${workspaceDir} && NODE_ENV=test node --import tsx --test --test-concurrency=1 --test-force-exit ${tests.join(' ')}`;
  }

  return `node --import tsx --test --test-concurrency=1 ${tests.join(' ')}`;
}

export function buildAffectedTestPlan(files, mappings) {
  if (shouldUseWorkspaceFallback(files)) {
    return {
      mappedTests: [],
      mappedCommands: [],
      fallbackWorkspaces: detectAffectedWorkspaces(files),
    };
  }

  const mappedTests = findMappedTests(files, mappings);
  const unmappedFiles = findUnmappedFiles(files, mappings);

  return {
    mappedTests,
    mappedCommands: buildMappedTestCommands(mappedTests),
    fallbackWorkspaces: detectAffectedWorkspaces(unmappedFiles),
  };
}

function readTestFileMap() {
  const mapPath = join(ROOT, '.test-file-map');
  if (!existsSync(mapPath)) return new Map();
  return parseTestFileMap(readFileSync(mapPath, 'utf-8'));
}

export function detectAffectedWorkspaces(files) {
  const affected = new Set();

  // Check for global changes that affect everything
  const hasGlobalChange = shouldUseWorkspaceFallback(files);

  if (hasGlobalChange) {
    // All workspaces are affected
    Object.values(WORKSPACE_MAP).forEach((ws) => affected.add(ws));
    return Array.from(affected);
  }

  // Map files to workspaces
  for (const file of files) {
    for (const [prefix, workspace] of Object.entries(WORKSPACE_MAP)) {
      if (file.startsWith(prefix)) {
        affected.add(workspace);

        // Add dependents
        const deps = DEPENDENTS[workspace];
        if (deps) {
          deps.forEach((dep) => affected.add(dep));
        }
        break;
      }
    }
  }

  return Array.from(affected);
}

function hasTestScript(workspace) {
  const wsPath = workspace.replace('@openpath/', '');
  const pkgPath = join(ROOT, wsPath, 'package.json');

  if (!existsSync(pkgPath)) return false;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return Boolean(pkg.scripts?.test);
  } catch {
    return false;
  }
}

function runTests(workspaces) {
  const testable = workspaces.filter(hasTestScript);

  if (testable.length === 0) {
    console.log('No affected workspaces with test scripts found.');
    return 0;
  }

  console.log(`Running tests for: ${testable.join(', ')}\n`);

  let failed = false;
  for (const ws of testable) {
    console.log(`\n--- Testing ${ws} ---\n`);
    try {
      execSync(`npm test --workspace=${ws}`, {
        cwd: ROOT,
        stdio: 'inherit',
      });
    } catch {
      failed = true;
      console.error(`\nTests failed for ${ws}`);
    }
  }

  return failed ? 1 : 0;
}

function runMappedTests(commands, fallbackWorkspaces) {
  const testFiles = commands.flatMap((command) => command.tests);
  let failed = false;

  if (commands.length > 0) {
    console.log(`Running mapped tests for: ${testFiles.join(', ')}\n`);
  }

  for (const { workspace, command } of commands) {
    console.log(`\n--- Testing ${workspace} mapped tests ---\n`);
    try {
      execSync(command, {
        cwd: ROOT,
        stdio: 'inherit',
      });
    } catch {
      failed = true;
      console.error(`\nMapped tests failed for ${workspace}`);
    }
  }

  if (fallbackWorkspaces.length > 0) {
    const fallbackStatus = runTests(fallbackWorkspaces);
    if (fallbackStatus !== 0) failed = true;
  }

  return failed ? 1 : 0;
}

function printLines(lines) {
  if (lines.length === 0) {
    console.log('No workspaces affected by current changes.');
  } else {
    lines.forEach((line) => console.log(line));
  }
}

export function main(args = process.argv.slice(2)) {
  const staged = args.includes('--staged');
  const runTestsFlag = args.includes('--run-tests');
  const listTestsFlag = args.includes('--list-tests');
  const runMappedTestsFlag = args.includes('--run-mapped-tests');
  const jsonOutput = args.includes('--json');

  const files = getChangedFiles(staged);
  const affected = detectAffectedWorkspaces(files);
  const mappings = readTestFileMap();
  const testPlan = buildAffectedTestPlan(files, mappings);
  const mappedTests = testPlan.mappedTests;
  const exactTestMode = mappedTests.length > 0;

  if (jsonOutput) {
    console.log(JSON.stringify({ files, affected, mappedTests }, null, 2));
    return 0;
  }

  if (listTestsFlag) {
    printLines(exactTestMode ? mappedTests : affected);
    return 0;
  }

  if (runMappedTestsFlag) {
    if (affected.length === 0 && mappedTests.length === 0) {
      console.log('No workspaces affected by current changes.');
      return 0;
    }
    return runMappedTests(testPlan.mappedCommands, testPlan.fallbackWorkspaces);
  }

  if (runTestsFlag) {
    if (affected.length === 0) {
      console.log('No workspaces affected by current changes.');
      return 0;
    }
    return runTests(affected);
  }

  printLines(affected);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const status = main();
  if (status !== 0) {
    process.exit(status);
  }
}
