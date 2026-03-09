#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const createReport = require('c8/lib/report.js');
const { checkCoverages } = require('c8/lib/commands/check-coverage.js');

function getCommand() {
  const command = process.argv[2];

  if (command) {
    return command;
  }

  console.error('Usage: node ../scripts/run-c8-coverage.js "<test command>"');
  process.exit(1);
}

function getReportOptions(config, workspaceDir) {
  const reportsDirectory = resolve(workspaceDir, config['reports-dir'] ?? 'coverage');
  const tempDirectory = resolve(workspaceDir, config['temp-directory'] ?? 'coverage/tmp');
  const configuredReporters = Array.isArray(config.reporter)
    ? config.reporter
    : [config.reporter ?? 'text'];
  const reporter = Array.from(new Set([...configuredReporters, 'json']));

  return {
    report: createReport({
      include: config.include ?? [],
      exclude: config.exclude,
      extension: config.extension,
      excludeAfterRemap: config['exclude-after-remap'] ?? false,
      reporter,
      reporterOptions: config['reporter-options'] ?? {},
      reportsDirectory,
      tempDirectory,
      watermarks: config.watermarks,
      resolve: config.resolve ?? '',
      omitRelative: config['omit-relative'] ?? true,
      wrapperLength: config['wrapper-length'],
      all: config.all ?? false,
      src: config.src,
      allowExternal: config.allowExternal ?? false,
      skipFull: config['skip-full'] ?? false,
      excludeNodeModules: config['exclude-node-modules'] ?? true,
      mergeAsync: config['merge-async'] ?? false,
    }),
    reportsDirectory,
    tempDirectory,
  };
}

async function main() {
  const command = getCommand();
  const workspaceDir = process.cwd();
  const packageJson = JSON.parse(readFileSync(resolve(workspaceDir, 'package.json'), 'utf8'));
  const config = packageJson.c8 ?? {};
  const { report, reportsDirectory, tempDirectory } = getReportOptions(config, workspaceDir);

  rmSync(reportsDirectory, { recursive: true, force: true });
  mkdirSync(tempDirectory, { recursive: true });

  try {
    const result = spawnSync(command, {
      cwd: workspaceDir,
      stdio: 'inherit',
      shell: process.env.SHELL || '/bin/sh',
      env: {
        ...process.env,
        NODE_V8_COVERAGE: tempDirectory,
      },
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }

    await report.run();

    if (config['check-coverage']) {
      await checkCoverages(
        {
          lines: config.lines ?? 90,
          functions: config.functions ?? 0,
          branches: config.branches ?? 0,
          statements: config.statements ?? 0,
          perFile: config['per-file'] ?? false,
        },
        report
      );
    }

    if (process.exitCode && process.exitCode !== 0) {
      process.exit(process.exitCode);
    }
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

await main();
