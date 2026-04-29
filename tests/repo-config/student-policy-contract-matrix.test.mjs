import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const matrixRelativePath = 'docs/testing/student-policy-contract-matrix.md';
const matrixPath = path.join(repoRoot, matrixRelativePath);
const scenariosPath = path.join(repoRoot, 'tests/selenium/student-policy-scenarios.ts');
const indexPath = path.join(repoRoot, 'docs/INDEX.md');

function expandScenarioRange(start, end) {
  const startNumber = Number(start);
  const endNumber = Number(end);
  return Array.from({ length: endNumber - startNumber + 1 }, (_, index) => {
    return `SP-${String(startNumber + index).padStart(3, '0')}`;
  });
}

function extractScenarioIds(source) {
  const ids = new Set();
  for (const match of source.matchAll(/SP-(\d{3})(?:\s+to\s+SP-(\d{3}))?|SP-FB-\d{3}/g)) {
    if (match[0].startsWith('SP-FB-')) {
      ids.add(match[0]);
      continue;
    }

    if (match[2] !== undefined) {
      for (const id of expandScenarioRange(match[1], match[2])) {
        ids.add(id);
      }
      continue;
    }

    ids.add(`SP-${match[1]}`);
  }
  return [...ids].sort();
}

function parseMarkdownTableRows(markdown) {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .filter((line) => !/^\|\s*:?-{3,}:?\s*\|/.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim())
    );
}

test('student policy contract matrix exists and is indexed', () => {
  assert.equal(existsSync(matrixPath), true, `${matrixRelativePath} must exist`);

  const index = readFileSync(indexPath, 'utf8');
  assert.match(
    index,
    /\[.*student-policy-contract-matrix\.md.*\]\(testing\/student-policy-contract-matrix\.md\)/,
    'docs/INDEX.md must link to the student policy contract matrix'
  );
});

test('student policy contract matrix tracks every Selenium scenario id', () => {
  const matrix = readFileSync(matrixPath, 'utf8');
  const source = readFileSync(scenariosPath, 'utf8');

  for (const id of extractScenarioIds(source)) {
    assert.match(matrix, new RegExp(`\\b${id}\\b`), `${id} must appear in ${matrixRelativePath}`);
  }
});

test('student policy contract matrix keeps required coverage columns populated', () => {
  const matrix = readFileSync(matrixPath, 'utf8');
  const rows = parseMarkdownTableRows(matrix);
  const header = rows[0];

  assert.deepEqual(header, [
    'Scenario',
    'Risk',
    'Local contract coverage',
    'Runner-only evidence',
    'Recommended local command',
    'Notes',
  ]);

  const bodyRows = rows.slice(1);
  assert.ok(bodyRows.length >= 10, 'matrix should have one row per scenario family');

  for (const row of bodyRows) {
    assert.equal(row.length, header.length, `malformed matrix row: ${row.join(' | ')}`);
    for (const [index, cell] of row.entries()) {
      assert.notEqual(cell, '', `${header[index]} must be populated for ${row[0]}`);
    }
  }
});
