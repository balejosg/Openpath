#!/usr/bin/env tsx

import 'dotenv/config';

import pg from 'pg';

interface ReadinessRow {
  relation: string;
  total_rows: string;
  referenced_rows: string;
  orphaned_rows: string;
  overlength_rows: string;
}

interface ReadinessCheck {
  relation: string;
  table: string;
  column: string;
  nullable: boolean;
}

const GROUP_ID_MAX_LENGTH = 50;

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

const CHECKS: ReadinessCheck[] = [
  { relation: 'requests.groupId', table: 'requests', column: 'group_id', nullable: false },
  {
    relation: 'classrooms.defaultGroupId',
    table: 'classrooms',
    column: 'default_group_id',
    nullable: true,
  },
  {
    relation: 'classrooms.activeGroupId',
    table: 'classrooms',
    column: 'active_group_id',
    nullable: true,
  },
  { relation: 'schedules.groupId', table: 'schedules', column: 'group_id', nullable: false },
];

async function runCheck(check: ReadinessCheck, pool: pg.Pool): Promise<ReadinessRow> {
  const nullFilter = check.nullable ? `WHERE t.${check.column} IS NOT NULL` : '';

  const query = `
    SELECT
      $1::text AS relation,
      COUNT(*)::text AS total_rows,
      COUNT(t.${check.column})::text AS referenced_rows,
      COUNT(*) FILTER (
        WHERE t.${check.column} IS NOT NULL
          AND g.id IS NULL
      )::text AS orphaned_rows,
      COUNT(*) FILTER (
        WHERE t.${check.column} IS NOT NULL
          AND char_length(t.${check.column}) > $2
      )::text AS overlength_rows
    FROM ${check.table} t
    LEFT JOIN whitelist_groups g ON g.id = t.${check.column}
    ${nullFilter}
  `;

  const result = await pool.query<ReadinessRow>(query, [check.relation, GROUP_ID_MAX_LENGTH]);
  const row = result.rows[0];
  if (!row) {
    throw new Error(`Missing readiness result for ${check.relation}`);
  }

  return row;
}

function toNumber(value: string): number {
  return Number.parseInt(value, 10);
}

async function main(): Promise<void> {
  let hasErrors = false;
  const activePool = createPool();

  try {
    console.log('🔍 Verifying group-linked foreign key readiness...\n');

    for (const check of CHECKS) {
      const row = await runCheck(check, activePool);
      const totalRows = toNumber(row.total_rows);
      const referencedRows = toNumber(row.referenced_rows);
      const orphanedRows = toNumber(row.orphaned_rows);
      const overlengthRows = toNumber(row.overlength_rows);

      console.log(`Relation: ${row.relation}`);
      console.log(`  total rows: ${String(totalRows)}`);
      console.log(`  referenced rows: ${String(referencedRows)}`);
      console.log(`  orphaned rows: ${String(orphanedRows)}`);
      console.log(
        `  values longer than ${String(GROUP_ID_MAX_LENGTH)} chars: ${String(overlengthRows)}`
      );

      if (orphanedRows > 0 || overlengthRows > 0) {
        hasErrors = true;
        console.error(`  ❌ Not ready for hard foreign key: ${row.relation}`);
      } else {
        console.log(`  ✅ Ready for hard foreign key: ${row.relation}`);
      }

      console.log('');
    }

    if (hasErrors) {
      console.error('❌ Group-linked foreign key readiness FAILED');
      process.exitCode = 1;
      return;
    }

    console.log('✅ Group-linked foreign key readiness PASSED');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to audit group-linked foreign key readiness: ${message}`);
    console.error(`Database target: ${resolveConnectionTarget()}`);
    process.exitCode = 1;
  } finally {
    await activePool.end();
  }
}

await main();
