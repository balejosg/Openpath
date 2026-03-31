import { describe, test, before } from 'node:test';
import assert from 'node:assert';

import { sql } from 'drizzle-orm';
import { ensureTestSchema, TEST_RUN_ID } from '../test-utils.js';
import * as classroomStorage from '../../src/lib/classroom-storage.js';
import * as scheduleStorage from '../../src/lib/schedule-storage.js';
import { db } from '../../src/db/index.js';
import {
  UNRESTRICTED_GROUP_ID,
  createMachineExemption,
  getActiveMachineExemptionsByClassroom,
  isMachineExempt,
} from '../../src/lib/exemption-storage.js';

await describe('exemption-storage', async () => {
  before(async () => {
    await ensureTestSchema();

    await db.execute(
      sql.raw(
        `INSERT INTO users (id, email, name, password_hash)
         VALUES ('legacy_admin', 'admin@openpath.dev', 'Legacy Admin', 'placeholder')
         ON CONFLICT (id) DO NOTHING`
      )
    );

    await db.execute(
      sql.raw(
        `INSERT INTO whitelist_groups (id, name, display_name, enabled)
         VALUES
           ('default-group', 'default-group', 'Default Group', 1),
           ('group-scheduled', 'group-scheduled', 'Scheduled Group', 1),
           ('group-one-off', 'group-one-off', 'One Off Group', 1)
         ON CONFLICT (id) DO NOTHING`
      )
    );

    await db.execute(
      sql.raw(
        `CREATE TABLE IF NOT EXISTS "machine_exemptions" (
          "id" varchar(50) PRIMARY KEY NOT NULL,
          "machine_id" varchar(50) NOT NULL,
          "classroom_id" varchar(50) NOT NULL,
          "schedule_id" uuid NOT NULL,
          "created_by" varchar(50),
          "created_at" timestamp with time zone DEFAULT now(),
          "expires_at" timestamp with time zone NOT NULL
        );`
      )
    );
    await db.execute(
      sql.raw(
        'CREATE UNIQUE INDEX IF NOT EXISTS "machine_exemptions_machine_schedule_expires_key" ON "machine_exemptions" ("machine_id","schedule_id","expires_at");'
      )
    );
    await db.execute(
      sql.raw(
        'CREATE INDEX IF NOT EXISTS "machine_exemptions_classroom_expires_idx" ON "machine_exemptions" ("classroom_id","expires_at");'
      )
    );
    await db.execute(
      sql.raw(
        'CREATE INDEX IF NOT EXISTS "machine_exemptions_machine_expires_idx" ON "machine_exemptions" ("machine_id","expires_at");'
      )
    );
    await db.execute(
      sql.raw(
        `DO $$ BEGIN
          ALTER TABLE "machine_exemptions" ADD CONSTRAINT "machine_exemptions_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;`
      )
    );
    await db.execute(
      sql.raw(
        `DO $$ BEGIN
          ALTER TABLE "machine_exemptions" ADD CONSTRAINT "machine_exemptions_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;`
      )
    );
    await db.execute(
      sql.raw(
        `DO $$ BEGIN
          ALTER TABLE "machine_exemptions" ADD CONSTRAINT "machine_exemptions_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;`
      )
    );
    await db.execute(
      sql.raw(
        `DO $$ BEGIN
          ALTER TABLE "machine_exemptions" ADD CONSTRAINT "machine_exemptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;`
      )
    );
  });

  await test('creates exemption for current schedule occurrence and bypasses enforcement', async () => {
    const classroom = await classroomStorage.createClassroom({
      name: `exempt-room-${TEST_RUN_ID}`,
      displayName: 'Exemption Room',
      defaultGroupId: 'default-group',
    });

    const machine = await classroomStorage.registerMachine({
      hostname: `pc-exempt-${TEST_RUN_ID}`,
      classroomId: classroom.id,
    });

    const schedule = await scheduleStorage.createSchedule({
      classroomId: classroom.id,
      teacherId: 'legacy_admin',
      groupId: 'group-scheduled',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
    });

    const now = new Date(2026, 1, 23, 9, 15, 30);
    const exemption = await createMachineExemption({
      machineId: machine.id,
      classroomId: classroom.id,
      scheduleId: schedule.id,
      createdBy: 'legacy_admin',
      now,
    });

    const expectedExpiresAt = new Date(2026, 1, 23, 10, 0, 0, 0);
    assert.strictEqual(exemption.expiresAt.getTime(), expectedExpiresAt.getTime());

    assert.strictEqual(await isMachineExempt(machine.id, classroom.id, now), true);

    const baseContext = await classroomStorage.resolveMachineGroupContext(machine.hostname, now);
    assert.ok(baseContext);
    assert.strictEqual(baseContext.groupId, 'group-scheduled');

    const enforcementContext = await classroomStorage.resolveMachineEnforcementContext(
      machine.hostname,
      now
    );
    assert.ok(enforcementContext);
    assert.strictEqual(enforcementContext.groupId, UNRESTRICTED_GROUP_ID);
  });

  await test('creates exemption for active one-off schedule and bypasses enforcement (weekend)', async () => {
    const classroom = await classroomStorage.createClassroom({
      name: `exempt-oneoff-room-${TEST_RUN_ID}`,
      displayName: 'OneOff Exemption Room',
      defaultGroupId: 'default-group',
    });

    const machine = await classroomStorage.registerMachine({
      hostname: `pc-exempt-oneoff-${TEST_RUN_ID}`,
      classroomId: classroom.id,
    });

    const schedule = await scheduleStorage.createOneOffSchedule({
      classroomId: classroom.id,
      teacherId: 'legacy_admin',
      groupId: 'group-one-off',
      startAt: new Date(2026, 1, 28, 9, 0, 0, 0),
      endAt: new Date(2026, 1, 28, 10, 0, 0, 0),
    });

    const now = new Date(2026, 1, 28, 9, 15, 30);
    const exemption = await createMachineExemption({
      machineId: machine.id,
      classroomId: classroom.id,
      scheduleId: schedule.id,
      createdBy: 'legacy_admin',
      now,
    });

    const expectedExpiresAt = new Date(2026, 1, 28, 10, 0, 0, 0);
    assert.strictEqual(exemption.expiresAt.getTime(), expectedExpiresAt.getTime());

    assert.strictEqual(await isMachineExempt(machine.id, classroom.id, now), true);

    const baseContext = await classroomStorage.resolveMachineGroupContext(machine.hostname, now);
    assert.ok(baseContext);
    assert.strictEqual(baseContext.groupId, 'group-one-off');

    const enforcementContext = await classroomStorage.resolveMachineEnforcementContext(
      machine.hostname,
      now
    );
    assert.ok(enforcementContext);
    assert.strictEqual(enforcementContext.groupId, UNRESTRICTED_GROUP_ID);
  });

  await test('does not treat exemption as active after expiry', async () => {
    const classroom = await classroomStorage.createClassroom({
      name: `exempt-expire-room-${TEST_RUN_ID}`,
      displayName: 'Expire Room',
      defaultGroupId: 'default-group',
    });

    const machine = await classroomStorage.registerMachine({
      hostname: `pc-exempt-expire-${TEST_RUN_ID}`,
      classroomId: classroom.id,
    });

    const schedule = await scheduleStorage.createSchedule({
      classroomId: classroom.id,
      teacherId: 'legacy_admin',
      groupId: 'group-scheduled',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
    });

    const now = new Date(2026, 1, 23, 9, 30, 0);
    await createMachineExemption({
      machineId: machine.id,
      classroomId: classroom.id,
      scheduleId: schedule.id,
      createdBy: 'legacy_admin',
      now,
    });

    const after = new Date(2026, 1, 23, 10, 0, 1);
    assert.strictEqual(await isMachineExempt(machine.id, classroom.id, after), false);
  });

  await test('prevents duplicates for the same occurrence', async () => {
    const classroom = await classroomStorage.createClassroom({
      name: `exempt-dup-room-${TEST_RUN_ID}`,
      displayName: 'Dup Room',
      defaultGroupId: 'default-group',
    });

    const machine = await classroomStorage.registerMachine({
      hostname: `pc-exempt-dup-${TEST_RUN_ID}`,
      classroomId: classroom.id,
    });

    const schedule = await scheduleStorage.createSchedule({
      classroomId: classroom.id,
      teacherId: 'legacy_admin',
      groupId: 'group-scheduled',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
    });

    const now = new Date(2026, 1, 23, 9, 45, 0);
    const a = await createMachineExemption({
      machineId: machine.id,
      classroomId: classroom.id,
      scheduleId: schedule.id,
      createdBy: 'legacy_admin',
      now,
    });

    const b = await createMachineExemption({
      machineId: machine.id,
      classroomId: classroom.id,
      scheduleId: schedule.id,
      createdBy: 'legacy_admin',
      now,
    });

    assert.strictEqual(a.id, b.id);
  });

  await test('deletes exemptions when schedule is deleted (cascade)', async () => {
    const classroom = await classroomStorage.createClassroom({
      name: `exempt-cascade-room-${TEST_RUN_ID}`,
      displayName: 'Cascade Room',
      defaultGroupId: 'default-group',
    });

    const machine = await classroomStorage.registerMachine({
      hostname: `pc-exempt-cascade-${TEST_RUN_ID}`,
      classroomId: classroom.id,
    });

    const schedule = await scheduleStorage.createSchedule({
      classroomId: classroom.id,
      teacherId: 'legacy_admin',
      groupId: 'group-scheduled',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
    });

    const now = new Date(2026, 1, 23, 9, 15, 0);
    await createMachineExemption({
      machineId: machine.id,
      classroomId: classroom.id,
      scheduleId: schedule.id,
      createdBy: 'legacy_admin',
      now,
    });

    await scheduleStorage.deleteSchedule(schedule.id);

    const exemptions = await getActiveMachineExemptionsByClassroom(classroom.id, now);
    assert.strictEqual(exemptions.length, 0);
  });
});
