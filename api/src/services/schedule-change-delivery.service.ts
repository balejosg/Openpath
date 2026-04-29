import { getErrorMessage } from '@openpath/shared';
import { pool } from '../db/legacy-pool.js';
import { getClassroomIdsWithBoundaryAt } from '../lib/schedule-storage.js';
import { logger as defaultLogger } from '../lib/logger.js';

export interface ScheduleChangeDeliveryInput {
  now: Date;
}

export interface ScheduleChangeDelivery {
  classroomIds: string[];
  boundaryClassroomIds: string[];
  expiredExemptionClassroomIds: string[];
}

export interface ScheduleChangeDeliveryLogger {
  warn: (message: string, meta?: Record<string, unknown>) => void;
}

export interface ScheduleChangeDeliveryDependencies {
  getClassroomIdsWithBoundaryAt?: (now: Date) => Promise<string[]>;
  deleteExpiredMachineExemptions?: (now: Date) => Promise<string[]>;
  logger?: ScheduleChangeDeliveryLogger;
}

function uniqueClassroomIds(classroomIds: string[]): string[] {
  return [
    ...new Set(classroomIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
  ];
}

export async function deleteExpiredMachineExemptions(now: Date): Promise<string[]> {
  const result = await pool.query<{ classroom_id: string }>(
    'DELETE FROM machine_exemptions WHERE expires_at <= $1 RETURNING classroom_id',
    [now]
  );
  return uniqueClassroomIds(result.rows.map((row) => row.classroom_id));
}

export async function resolveScheduleChangeDelivery(
  input: ScheduleChangeDeliveryInput,
  deps: ScheduleChangeDeliveryDependencies = {}
): Promise<ScheduleChangeDelivery> {
  const boundarySource = deps.getClassroomIdsWithBoundaryAt ?? getClassroomIdsWithBoundaryAt;
  const exemptionCleanup = deps.deleteExpiredMachineExemptions ?? deleteExpiredMachineExemptions;
  const log = deps.logger ?? defaultLogger;

  const boundaryClassroomIds = uniqueClassroomIds(await boundarySource(input.now));
  const expiredExemptionClassroomIds = await (async (): Promise<string[]> => {
    try {
      return uniqueClassroomIds(await exemptionCleanup(input.now));
    } catch (error: unknown) {
      log.warn('Failed to cleanup expired machine exemptions', {
        error: getErrorMessage(error),
      });
      return [];
    }
  })();

  return {
    classroomIds: uniqueClassroomIds([...boundaryClassroomIds, ...expiredExemptionClassroomIds]),
    boundaryClassroomIds,
    expiredExemptionClassroomIds,
  };
}

export function emitScheduleChangeDelivery(
  delivery: ScheduleChangeDelivery,
  emitClassroomChanged: (classroomId: string, now: Date) => void,
  now: Date
): void {
  for (const classroomId of uniqueClassroomIds(delivery.classroomIds)) {
    emitClassroomChanged(classroomId, now);
  }
}
