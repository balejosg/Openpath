import type { QueryResult, QueryResultRow } from 'pg';

const GROUP_ID_MAX_LENGTH = 50;

interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<T>>;
}

export interface GroupFkRepairSummary {
  nullifiedClassroomDefaultGroupIds: number;
  nullifiedClassroomActiveGroupIds: number;
  deletedRequests: number;
  deletedSchedules: number;
}

async function tableExists(queryable: Queryable, table: string): Promise<boolean> {
  const result = await queryable.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [table]
  );

  return result.rows[0]?.exists ?? false;
}

async function columnExists(queryable: Queryable, table: string, column: string): Promise<boolean> {
  const result = await queryable.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [table, column]
  );

  return result.rows[0]?.exists ?? false;
}

async function countChangedRows(
  queryable: Queryable,
  query: string,
  values: readonly unknown[] = []
): Promise<number> {
  const result = await queryable.query<{ count: string }>(query, values);
  return Number.parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function repairGroupForeignKeyCompatibility(
  queryable: Queryable
): Promise<GroupFkRepairSummary> {
  const summary: GroupFkRepairSummary = {
    nullifiedClassroomDefaultGroupIds: 0,
    nullifiedClassroomActiveGroupIds: 0,
    deletedRequests: 0,
    deletedSchedules: 0,
  };

  if (!(await tableExists(queryable, 'whitelist_groups'))) {
    return summary;
  }

  if (
    (await tableExists(queryable, 'classrooms')) &&
    (await columnExists(queryable, 'classrooms', 'default_group_id'))
  ) {
    summary.nullifiedClassroomDefaultGroupIds = await countChangedRows(
      queryable,
      `
        WITH updated AS (
          UPDATE classrooms
          SET default_group_id = NULL
          WHERE default_group_id IS NOT NULL
            AND (
              char_length(default_group_id) > $1
              OR NOT EXISTS (
                SELECT 1
                FROM whitelist_groups
                WHERE whitelist_groups.id = classrooms.default_group_id
              )
            )
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count FROM updated
      `,
      [GROUP_ID_MAX_LENGTH]
    );
  }

  if (
    (await tableExists(queryable, 'classrooms')) &&
    (await columnExists(queryable, 'classrooms', 'active_group_id'))
  ) {
    summary.nullifiedClassroomActiveGroupIds = await countChangedRows(
      queryable,
      `
        WITH updated AS (
          UPDATE classrooms
          SET active_group_id = NULL
          WHERE active_group_id IS NOT NULL
            AND (
              char_length(active_group_id) > $1
              OR NOT EXISTS (
                SELECT 1
                FROM whitelist_groups
                WHERE whitelist_groups.id = classrooms.active_group_id
              )
            )
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count FROM updated
      `,
      [GROUP_ID_MAX_LENGTH]
    );
  }

  if (
    (await tableExists(queryable, 'requests')) &&
    (await columnExists(queryable, 'requests', 'group_id'))
  ) {
    summary.deletedRequests = await countChangedRows(
      queryable,
      `
        WITH deleted AS (
          DELETE FROM requests
          WHERE char_length(group_id) > $1
             OR NOT EXISTS (
              SELECT 1
              FROM whitelist_groups
              WHERE whitelist_groups.id = requests.group_id
            )
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count FROM deleted
      `,
      [GROUP_ID_MAX_LENGTH]
    );
  }

  if (
    (await tableExists(queryable, 'schedules')) &&
    (await columnExists(queryable, 'schedules', 'group_id'))
  ) {
    summary.deletedSchedules = await countChangedRows(
      queryable,
      `
        WITH deleted AS (
          DELETE FROM schedules
          WHERE char_length(group_id) > $1
             OR NOT EXISTS (
              SELECT 1
              FROM whitelist_groups
              WHERE whitelist_groups.id = schedules.group_id
            )
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count FROM deleted
      `,
      [GROUP_ID_MAX_LENGTH]
    );
  }

  return summary;
}
