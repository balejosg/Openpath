import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildWindowsStudentSummary } from './windows-student-summary.js';

await test('buildWindowsStudentSummary includes trace, config, and stderr excerpts', () => {
  const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpath-windows-student-summary-'));

  fs.writeFileSync(
    path.join(artifactsDir, 'windows-student-policy-trace.log'),
    'trace line 1\ntrace line 2\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(artifactsDir, 'windows-diagnostics.txt'),
    '=== OpenPath Config ===\n{"whitelistUrl":"http://127.0.0.1:3201/w/token/whitelist.txt"}\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(artifactsDir, 'reconcile-student-scenario.err.log'),
    'Could not extract machine token from http://127.0.0.1:3201/whitelist.txt\n',
    'utf8'
  );

  const summary = buildWindowsStudentSummary({
    artifactsDir,
    mode: 'failure',
  });

  assert.match(summary, /Windows Student Policy Diagnostics/);
  assert.match(summary, /trace line 1/);
  assert.match(summary, /OpenPath Config/);
  assert.match(summary, /Could not extract machine token/);
});

await test('buildWindowsStudentSummary notes when expected logs are missing', () => {
  const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpath-windows-student-summary-'));

  const summary = buildWindowsStudentSummary({
    artifactsDir,
    mode: 'failure',
  });

  assert.match(summary, /windows-student-policy-trace\.log: missing/);
  assert.match(summary, /windows-diagnostics\.txt: missing/);
});

await test('buildWindowsStudentSummary truncates oversized sections and redacts token-bearing values', () => {
  const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpath-windows-student-summary-'));
  const longTrace = Array.from({ length: 120 }, (_, index) => `trace line ${index}`).join('\n');

  fs.writeFileSync(
    path.join(artifactsDir, 'windows-student-policy-trace.log'),
    `${longTrace}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(artifactsDir, 'windows-diagnostics.txt'),
    '{"whitelistUrl":"http://127.0.0.1:3201/w/real-machine-token/whitelist.txt","machineToken":"real-machine-token"}\n',
    'utf8'
  );

  const summary = buildWindowsStudentSummary({
    artifactsDir,
    mode: 'failure',
  });

  assert.match(summary, /trace line 119/);
  assert.doesNotMatch(summary, /trace line 1\ntrace line 2/);
  assert.match(summary, /truncated/);
  assert.doesNotMatch(summary, /real-machine-token/);
  assert.match(summary, /\[redacted\]/);
});
