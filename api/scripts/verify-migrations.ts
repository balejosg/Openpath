#!/usr/bin/env tsx

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface JournalEntry {
  idx: number;
  tag: string;
}

interface Journal {
  entries: JournalEntry[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readJournal(journalPath: string): Journal {
  return JSON.parse(readFileSync(journalPath, 'utf-8')) as Journal;
}

function readMigrationTags(drizzleDir: string): string[] {
  return readdirSync(drizzleDir)
    .filter((entry) => entry.endsWith('.sql'))
    .map((entry) => entry.replace(/\.sql$/u, ''))
    .sort();
}

function reportList(prefix: string, values: string[]): void {
  for (const value of values) {
    console.error(`${prefix} ${value}`);
  }
}

function main(): void {
  const drizzleDir = join(__dirname, '../drizzle');
  const journalPath = join(drizzleDir, 'meta/_journal.json');

  const journal = readJournal(journalPath);
  const journalTags = journal.entries.map((entry) => entry.tag).sort();
  const migrationTags = readMigrationTags(drizzleDir);

  const extraSqlFiles = migrationTags.filter((tag) => !journalTags.includes(tag));
  const missingSqlFiles = journalTags.filter((tag) => !migrationTags.includes(tag));
  const duplicateJournalTags = journal.entries
    .map((entry) => entry.tag)
    .filter((tag, index, tags) => tags.indexOf(tag) !== index)
    .sort();

  if (
    extraSqlFiles.length === 0 &&
    missingSqlFiles.length === 0 &&
    duplicateJournalTags.length === 0
  ) {
    console.log('✅ Drizzle migration metadata is consistent');
    return;
  }

  console.error('❌ Drizzle migration metadata is inconsistent');

  if (extraSqlFiles.length > 0) {
    reportList('Unexpected SQL file without journal entry:', extraSqlFiles);
  }

  if (missingSqlFiles.length > 0) {
    reportList('Journal entry without SQL file:', missingSqlFiles);
  }

  if (duplicateJournalTags.length > 0) {
    reportList('Duplicate journal tag:', duplicateJournalTags);
  }

  process.exit(1);
}

main();
