#!/usr/bin/env tsx

import 'dotenv/config';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  repairGroupForeignKeyCompatibility,
  type GroupFkRepairSummary,
} from '../src/lib/group-fk-compat.js';

const { Pool } = pg;

function createPool(): pg.Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST ?? 'localhost',
    port: process.env.DB_PORT ? Number.parseInt(process.env.DB_PORT, 10) : 5432,
    database: process.env.DB_NAME ?? 'openpath',
    user: process.env.DB_USER ?? 'openpath',
    password: process.env.DB_PASSWORD ?? 'openpath_dev',
  });
}

function resolveConnectionTarget(): string {
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      return `${url.hostname}:${url.port || '5432'}/${url.pathname.replace(/^\//u, '')}`;
    } catch {
      return 'DATABASE_URL';
    }
  }

  return `${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5432'}/${process.env.DB_NAME ?? 'openpath'}`;
}

function countTotalRepairs(summary: GroupFkRepairSummary): number {
  return (
    summary.nullifiedClassroomDefaultGroupIds +
    summary.nullifiedClassroomActiveGroupIds +
    summary.deletedRequests +
    summary.deletedSchedules
  );
}

function logSummary(summary: GroupFkRepairSummary): void {
  console.log(
    `  classrooms.default_group_id nullified: ${String(summary.nullifiedClassroomDefaultGroupIds)}`
  );
  console.log(
    `  classrooms.active_group_id nullified: ${String(summary.nullifiedClassroomActiveGroupIds)}`
  );
  console.log(`  requests deleted: ${String(summary.deletedRequests)}`);
  console.log(`  schedules deleted: ${String(summary.deletedSchedules)}`);
}

async function main(): Promise<void> {
  const pool = createPool();
  const client = await pool.connect();

  try {
    console.log('🔧 Repairing group-linked rows before foreign-key enforcement...\n');
    await client.query('BEGIN');
    const summary = await repairGroupForeignKeyCompatibility(client);
    await client.query('COMMIT');

    logSummary(summary);

    if (countTotalRepairs(summary) === 0) {
      console.log('\n✅ Group-linked foreign key compatibility already clean');
      return;
    }

    console.log('\n✅ Repaired group-linked foreign key compatibility');
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to repair group-linked foreign key compatibility: ${message}`);
    console.error(`Database target: ${resolveConnectionTarget()}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

const isEntrypoint =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  await main();
}
