import { v4 as uuidv4 } from 'uuid';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db, machineExemptions, machines, schedules } from '../db/index.js';

export const UNRESTRICTED_GROUP_ID = '__unrestricted__';

export type MachineExemptionErrorCode = 'NOT_FOUND' | 'BAD_REQUEST' | 'CONFLICT';

export class MachineExemptionError extends Error {
  public readonly code: MachineExemptionErrorCode;

  public constructor(code: MachineExemptionErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function parseTimeHHMM(time: string): { hours: number; minutes: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return { hours, minutes };
}

function buildExpiresAtForScheduleEnd(now: Date, endTimeRaw: string): Date {
  const parts = parseTimeHHMM(endTimeRaw);
  if (!parts) {
    throw new MachineExemptionError('BAD_REQUEST', 'Invalid schedule endTime');
  }

  const expiresAt = new Date(now);
  expiresAt.setHours(parts.hours, parts.minutes, 0, 0);

  if (expiresAt.getTime() <= now.getTime()) {
    throw new MachineExemptionError('BAD_REQUEST', 'Schedule is not active');
  }

  return expiresAt;
}

export interface CreateMachineExemptionInput {
  machineId: string;
  classroomId: string;
  scheduleId: string;
  createdBy: string | null;
  now?: Date | undefined;
}

export type MachineExemptionRow = typeof machineExemptions.$inferSelect;

export async function createMachineExemption(
  input: CreateMachineExemptionInput
): Promise<MachineExemptionRow> {
  const now = input.now ?? new Date();

  const machineRows = await db
    .select({ id: machines.id, classroomId: machines.classroomId })
    .from(machines)
    .where(eq(machines.id, input.machineId))
    .limit(1);
  const machine = machineRows[0];
  if (!machine) {
    throw new MachineExemptionError('NOT_FOUND', 'Machine not found');
  }

  if (machine.classroomId !== input.classroomId) {
    throw new MachineExemptionError('BAD_REQUEST', 'Machine does not belong to classroom');
  }

  const dayOfWeek = now.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new MachineExemptionError('BAD_REQUEST', 'Schedules are inactive on weekends');
  }

  const currentTime = now.toTimeString().slice(0, 5);

  const scheduleRows = await db
    .select({ id: schedules.id, endTime: schedules.endTime })
    .from(schedules)
    .where(
      and(
        eq(schedules.id, input.scheduleId),
        eq(schedules.classroomId, input.classroomId),
        eq(schedules.dayOfWeek, dayOfWeek),
        sql`${schedules.startTime} <= ${currentTime}::time`,
        sql`${schedules.endTime} > ${currentTime}::time`
      )
    )
    .limit(1);

  const schedule = scheduleRows[0];
  if (!schedule) {
    throw new MachineExemptionError('BAD_REQUEST', 'Schedule is not active');
  }

  const expiresAt = buildExpiresAtForScheduleEnd(now, schedule.endTime);

  const id = `exempt_${uuidv4().slice(0, 8)}`;
  const inserted = await db
    .insert(machineExemptions)
    .values({
      id,
      machineId: input.machineId,
      classroomId: input.classroomId,
      scheduleId: input.scheduleId,
      createdBy: input.createdBy,
      expiresAt,
    })
    .onConflictDoNothing({
      target: [
        machineExemptions.machineId,
        machineExemptions.scheduleId,
        machineExemptions.expiresAt,
      ],
    })
    .returning();

  const created = inserted[0];
  if (created) {
    return created;
  }

  const existing = await db
    .select()
    .from(machineExemptions)
    .where(
      and(
        eq(machineExemptions.machineId, input.machineId),
        eq(machineExemptions.scheduleId, input.scheduleId),
        eq(machineExemptions.expiresAt, expiresAt)
      )
    )
    .limit(1);

  const row = existing[0];
  if (!row) {
    throw new MachineExemptionError('CONFLICT', 'Could not create exemption');
  }

  return row;
}

export async function deleteMachineExemption(id: string): Promise<{ classroomId: string } | null> {
  const deleted = await db
    .delete(machineExemptions)
    .where(eq(machineExemptions.id, id))
    .returning({ classroomId: machineExemptions.classroomId });

  const row = deleted[0];
  if (!row) return null;
  return { classroomId: row.classroomId };
}

export async function isMachineExempt(
  machineId: string,
  classroomId: string,
  now: Date = new Date()
): Promise<boolean> {
  const rows = await db
    .select({ id: machineExemptions.id })
    .from(machineExemptions)
    .where(
      and(
        eq(machineExemptions.machineId, machineId),
        eq(machineExemptions.classroomId, classroomId),
        gt(machineExemptions.expiresAt, now)
      )
    )
    .limit(1);

  return rows.length > 0;
}

export interface ActiveMachineExemption {
  id: string;
  machineId: string;
  machineHostname: string;
  classroomId: string;
  scheduleId: string;
  createdBy: string | null;
  createdAt: Date | null;
  expiresAt: Date;
}

export async function getActiveMachineExemptionsByClassroom(
  classroomId: string,
  now: Date = new Date()
): Promise<ActiveMachineExemption[]> {
  const rows = await db
    .select({
      id: machineExemptions.id,
      machineId: machineExemptions.machineId,
      machineHostname: machines.hostname,
      classroomId: machineExemptions.classroomId,
      scheduleId: machineExemptions.scheduleId,
      createdBy: machineExemptions.createdBy,
      createdAt: machineExemptions.createdAt,
      expiresAt: machineExemptions.expiresAt,
    })
    .from(machineExemptions)
    .innerJoin(machines, eq(machines.id, machineExemptions.machineId))
    .where(
      and(eq(machineExemptions.classroomId, classroomId), gt(machineExemptions.expiresAt, now))
    );

  return rows.map((r) => ({
    id: r.id,
    machineId: r.machineId,
    machineHostname: r.machineHostname,
    classroomId: r.classroomId,
    scheduleId: r.scheduleId,
    createdBy: r.createdBy ?? null,
    createdAt: r.createdAt ?? null,
    expiresAt: r.expiresAt,
  }));
}

export async function getActiveExemptHostnamesByClassroom(
  classroomId: string,
  now: Date = new Date()
): Promise<ReadonlySet<string>> {
  const rows = await db
    .select({ hostname: machines.hostname })
    .from(machineExemptions)
    .innerJoin(machines, eq(machines.id, machineExemptions.machineId))
    .where(
      and(eq(machineExemptions.classroomId, classroomId), gt(machineExemptions.expiresAt, now))
    );

  return new Set(rows.map((r) => r.hostname));
}
