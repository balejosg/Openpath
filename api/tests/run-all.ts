/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 *
 * Test Runner for running all test suites sequentially
 *
 * This script runs each test file in a separate child process to avoid
 * module cache conflicts when multiple test files need to start servers.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);

const testCommands: readonly (readonly [string, ...string[]])[] = [
  ['npm', 'run', 'test'],
  ['npm', 'run', 'test:auth'],
  ['npm', 'run', 'test:roles'],
  ['npm', 'run', 'test:blocked-domains'],
  ['npm', 'run', 'test:classrooms'],
  ['npm', 'run', 'test:push'],
  ['npm', 'run', 'test:security'],
  ['npm', 'run', 'test:integration'],
  ['npm', 'run', 'test:e2e'],
  ['npm', 'run', 'test:schedules'],
  ['npm', 'run', 'test:setup'],
  ['npm', 'run', 'test:machine-auth-scope'],
  ['npm', 'run', 'test:healthcheck'],
  ['npm', 'run', 'test:backup'],
  ['npm', 'run', 'test:api-tokens'],
  ['npm', 'run', 'test:server'],
  ['npm', 'run', 'test:google-auth'],
];

let currentIndex = 0;
let hasFailures = false;

function runNextTest(): void {
  if (currentIndex >= testCommands.length) {
    console.log('\n' + '='.repeat(60));
    if (hasFailures) {
      console.log('❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('✅ All test suites completed successfully');
      process.exit(0);
    }
    return;
  }

  const command = testCommands[currentIndex];
  if (command === undefined) {
    console.error('Unexpected undefined test command');
    process.exit(1);
    return;
  }

  const [cmd, ...args] = command;
  if (!cmd) {
    console.error('Unexpected empty test command');
    process.exit(1);
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Running: ${[cmd, ...args].join(' ')}`);
  console.log('='.repeat(60) + '\n');

  const child: ChildProcess = spawn(cmd, args, {
    cwd: path.join(currentDirPath, '..'),
    stdio: 'inherit',
    env: process.env,
  });

  // Timeout to kill hanging tests after 30 seconds
  const timeout = setTimeout((): void => {
    console.log(`\n⚠️  Command ${[cmd, ...args].join(' ')} timed out after 30s, killing...`);
    child.kill('SIGKILL');
  }, 30000);

  child.on('close', (code: number | null): void => {
    clearTimeout(timeout);
    if (code !== 0) {
      hasFailures = true;
    }
    currentIndex++;
    // Small delay between test files to ensure port cleanup
    setTimeout(runNextTest, 500);
  });

  child.on('error', (err: Error): void => {
    clearTimeout(timeout);
    console.error(`Failed to run ${[cmd, ...args].join(' ')}:`, err);
    hasFailures = true;
    currentIndex++;
    setTimeout(runNextTest, 500);
  });
}

console.log('🧪 Running all test suites...\n');
runNextTest();
