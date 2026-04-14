import { eq, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db, machines } from '../db/index.js';
import { getRowCount } from './utils.js';
import type { DBMachine } from './classroom-storage-shared.js';

export async function getAllMachines(classroomId?: string): Promise<DBMachine[]> {
  if (classroomId) {
    return await db
      .select()
      .from(machines)
      .where(eq(machines.classroomId, classroomId))
      .orderBy(sql`${machines.createdAt} DESC`);
  }

  return await db
    .select()
    .from(machines)
    .orderBy(sql`${machines.createdAt} DESC`);
}

export async function getMachineById(id: string): Promise<DBMachine | null> {
  const result = await db.select().from(machines).where(eq(machines.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getMachinesByClassroom(classroomId: string): Promise<DBMachine[]> {
  return await db.select().from(machines).where(eq(machines.classroomId, classroomId));
}

export async function getMachinesByClassroomIds(
  classroomIds: string[]
): Promise<Map<string, DBMachine[]>> {
  const normalizedClassroomIds = [...new Set(classroomIds.filter((id) => id.length > 0))];
  const machinesByClassroomId = new Map<string, DBMachine[]>(
    normalizedClassroomIds.map((id) => [id, []])
  );

  if (normalizedClassroomIds.length === 0) {
    return machinesByClassroomId;
  }

  const result = await db
    .select()
    .from(machines)
    .where(inArray(machines.classroomId, normalizedClassroomIds))
    .orderBy(sql`${machines.createdAt} DESC`);

  for (const machine of result) {
    if (!machine.classroomId) {
      continue;
    }

    const machineList = machinesByClassroomId.get(machine.classroomId);
    if (machineList) {
      machineList.push(machine);
    } else {
      machinesByClassroomId.set(machine.classroomId, [machine]);
    }
  }

  return machinesByClassroomId;
}

export async function getMachineByHostname(hostname: string): Promise<DBMachine | null> {
  const normalizedHostname = hostname.toLowerCase().trim();
  const result = await db
    .select()
    .from(machines)
    .where(eq(machines.hostname, normalizedHostname))
    .limit(1);

  return result[0] ?? null;
}

export async function registerMachine(machineData: {
  hostname: string;
  reportedHostname?: string;
  classroomId: string;
  version?: string;
}): Promise<DBMachine> {
  const { hostname, reportedHostname, classroomId, version } = machineData;
  const normalizedHostname = hostname.toLowerCase();
  const normalizedReportedHostname = reportedHostname?.trim() ?? normalizedHostname;

  const existing = await getMachineByHostname(normalizedHostname);
  if (existing) {
    const [result] = await db
      .update(machines)
      .set({
        classroomId,
        reportedHostname: normalizedReportedHostname,
        version: version ?? existing.version,
        lastSeen: new Date(),
      })
      .where(eq(machines.id, existing.id))
      .returning();

    if (!result) {
      throw new Error(`Failed to update machine "${hostname}"`);
    }
    return result;
  }

  const id = `machine_${uuidv4().slice(0, 8)}`;
  const [result] = await db
    .insert(machines)
    .values({
      id,
      hostname: normalizedHostname,
      reportedHostname: normalizedReportedHostname,
      classroomId,
      version: version ?? 'unknown',
    })
    .returning();

  if (!result) {
    throw new Error('Failed to register machine');
  }

  return result;
}

export async function updateMachineLastSeen(hostname: string): Promise<DBMachine | null> {
  const machine = await getMachineByHostname(hostname);
  if (!machine) return null;

  const [result] = await db
    .update(machines)
    .set({ lastSeen: new Date() })
    .where(eq(machines.id, machine.id))
    .returning();

  return result ?? null;
}

export async function getMachineOnlyByHostname(hostname: string): Promise<DBMachine | null> {
  const normalizedHostname = hostname.toLowerCase().trim();
  const result = await db
    .select()
    .from(machines)
    .where(eq(machines.hostname, normalizedHostname))
    .limit(1);

  return result[0] ?? null;
}

export async function deleteMachine(hostname: string): Promise<boolean> {
  const machine = await getMachineByHostname(hostname);
  if (!machine) return false;

  return getRowCount(await db.delete(machines).where(eq(machines.id, machine.id))) > 0;
}

export async function removeMachinesByClassroom(classroomId: string): Promise<number> {
  return getRowCount(await db.delete(machines).where(eq(machines.classroomId, classroomId)));
}

export async function getMachineByDownloadTokenHash(tokenHash: string): Promise<DBMachine | null> {
  const result = await db
    .select()
    .from(machines)
    .where(eq(machines.downloadTokenHash, tokenHash))
    .limit(1);

  return result[0] ?? null;
}

export async function setMachineDownloadTokenHash(
  machineId: string,
  tokenHash: string
): Promise<DBMachine | null> {
  const [result] = await db
    .update(machines)
    .set({
      downloadTokenHash: tokenHash,
      downloadTokenLastRotatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(machines.id, machineId))
    .returning();

  return result ?? null;
}

export async function getMachineTokenStatus(machineId: string): Promise<{
  hasToken: boolean;
  lastRotatedAt: Date | null;
} | null> {
  const result = await db
    .select({
      downloadTokenHash: machines.downloadTokenHash,
      downloadTokenLastRotatedAt: machines.downloadTokenLastRotatedAt,
    })
    .from(machines)
    .where(eq(machines.id, machineId))
    .limit(1);

  if (!result[0]) return null;

  return {
    hasToken: result[0].downloadTokenHash !== null,
    lastRotatedAt: result[0].downloadTokenLastRotatedAt,
  };
}
