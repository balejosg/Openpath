import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';

process.env.NODE_ENV = 'test';

const { db, pool, closeConnection } = await import('../src/db/index.js');
const { getRows } = await import('../src/lib/utils.js');
const { createRequest } = await import('../src/lib/storage.js');
const { repairGroupForeignKeyCompatibility } = await import('../src/lib/group-fk-compat.js');
const { resetDb } = await import('./test-utils.js');

await describe('group foreign-key compatibility', async () => {
  beforeEach(async () => {
    delete process.env.DEFAULT_GROUP;
    await resetDb();
  });

  after(async () => {
    await closeConnection();
  });

  await test('repairGroupForeignKeyCompatibility cleans orphaned legacy group references', async () => {
    const classroomId = 'room-group-fk-compat';
    const scheduleId = '11111111-1111-4111-8111-111111111111';

    await db.execute(
      sql.raw(
        'ALTER TABLE "requests" DROP CONSTRAINT IF EXISTS "requests_group_id_whitelist_groups_id_fk"'
      )
    );
    await db.execute(
      sql.raw(
        'ALTER TABLE "schedules" DROP CONSTRAINT IF EXISTS "schedules_group_id_whitelist_groups_id_fk"'
      )
    );
    await db.execute(
      sql.raw(
        'ALTER TABLE "classrooms" DROP CONSTRAINT IF EXISTS "classrooms_default_group_id_whitelist_groups_id_fk"'
      )
    );
    await db.execute(
      sql.raw(
        'ALTER TABLE "classrooms" DROP CONSTRAINT IF EXISTS "classrooms_active_group_id_whitelist_groups_id_fk"'
      )
    );

    await db.execute(sql.raw("DELETE FROM whitelist_groups WHERE id = 'default'"));

    await db.execute(
      sql.raw(`
        INSERT INTO classrooms (id, name, display_name, default_group_id, active_group_id)
        VALUES ('${classroomId}', '${classroomId}', '${classroomId}', 'default', 'default')
      `)
    );
    await db.execute(
      sql.raw(`
        INSERT INTO requests (id, domain, reason, requester_email, group_id, status)
        VALUES ('req-group-fk', 'legacy.example.com', 'Legacy request', 'legacy@example.com', 'default', 'pending')
      `)
    );
    await db.execute(
      sql.raw(`
        INSERT INTO schedules (id, classroom_id, teacher_id, group_id, day_of_week, start_time, end_time, recurrence)
        VALUES ('${scheduleId}', '${classroomId}', 'legacy_admin', 'default', 1, '08:00', '09:00', 'weekly')
      `)
    );

    const summary = await repairGroupForeignKeyCompatibility(pool);

    assert.deepStrictEqual(summary, {
      nullifiedClassroomDefaultGroupIds: 1,
      nullifiedClassroomActiveGroupIds: 1,
      deletedRequests: 1,
      deletedSchedules: 1,
    });

    const classrooms = getRows<{ default_group_id: string | null; active_group_id: string | null }>(
      await db.execute(
        sql.raw(`
          SELECT default_group_id, active_group_id
          FROM classrooms
          WHERE id = '${classroomId}'
          LIMIT 1
        `)
      )
    );
    assert.deepStrictEqual(classrooms[0], {
      default_group_id: null,
      active_group_id: null,
    });

    const requestCount = getRows<{ count: string }>(
      await db.execute(
        sql.raw("SELECT COUNT(*)::text AS count FROM requests WHERE id = 'req-group-fk'")
      )
    );
    assert.strictEqual(requestCount[0]?.count, '0');

    const scheduleCount = getRows<{ count: string }>(
      await db.execute(
        sql.raw(`SELECT COUNT(*)::text AS count FROM schedules WHERE id = '${scheduleId}'::uuid`)
      )
    );
    assert.strictEqual(scheduleCount[0]?.count, '0');
  });

  await test('createRequest rejects a configured default group that does not exist', async () => {
    process.env.DEFAULT_GROUP = 'missing-group';

    await assert.rejects(
      () => createRequest({ domain: 'missing-default.example.com' }),
      /DEFAULT_GROUP "missing-group" does not exist/
    );
  });

  await test('createRequest falls back to the legacy default group when it exists', async () => {
    const created = await createRequest({ domain: 'legacy-default.example.com' });

    assert.strictEqual(created.groupId, 'default');
  });
});
