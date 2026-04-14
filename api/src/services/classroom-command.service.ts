import * as auth from '../lib/auth.js';
import * as classroomStorage from '../lib/classroom-storage.js';
import { config } from '../config.js';
import {
  MachineExemptionError,
  createMachineExemption,
  deleteMachineExemption,
  getActiveMachineExemptionsByClassroom,
  getMachineExemptionById,
} from '../lib/exemption-storage.js';
import { logger } from '../lib/logger.js';
import {
  buildWhitelistUrl,
  generateMachineToken,
  hashMachineToken,
} from '../lib/machine-download-token.js';
import DomainEventsService from './domain-events.service.js';
import { ensureUserCanAccessClassroom } from './classroom-access.service.js';
import { getClassroom } from './classroom-query.service.js';
import type {
  ClassroomResult,
  ClassroomUser,
  ClassroomWithMachines,
  CreateClassroomInput,
  CreateMachineExemptionInput,
  MachineExemptionInfo,
  MachineRegistrationResult,
  RegisterMachineInput,
  RotateMachineTokenResult,
  SetActiveGroupInput,
  UpdateClassroomData,
} from './classroom-service-shared.js';
import { formatErrorMessage, toMachineExemptionInfo } from './classroom-service-shared.js';

export async function registerMachine(
  input: RegisterMachineInput
): Promise<ClassroomResult<MachineRegistrationResult>> {
  if (!input.hostname || input.hostname.trim() === '') {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Hostname required' },
    };
  }

  let classroomId = input.classroomId;
  if (!classroomId && input.classroomName) {
    const classroom = await classroomStorage.getClassroomByName(input.classroomName);
    if (classroom) {
      classroomId = classroom.id;
    }
  }

  if (!classroomId) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Valid classroom_id or classroom_name is required' },
    };
  }

  const classroom = await classroomStorage.getClassroomById(classroomId);
  if (!classroom) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Classroom not found' },
    };
  }

  const reportedHostname = input.hostname.trim();
  const machineHostname = classroomStorage.buildMachineKey(classroom.id, reportedHostname);
  const machine = await classroomStorage.registerMachine({
    hostname: machineHostname,
    reportedHostname,
    classroomId: classroom.id,
    ...(input.version ? { version: input.version } : {}),
  });

  return {
    ok: true,
    data: {
      hostname: machine.reportedHostname ?? reportedHostname,
      classroomId: machine.classroomId ?? classroom.id,
      classroomName: classroom.name,
      lastSeen: machine.lastSeen?.toISOString() ?? new Date().toISOString(),
      ...(machine.version !== null && { version: machine.version }),
    },
  };
}

export async function createClassroom(
  input: CreateClassroomInput
): Promise<ClassroomResult<Awaited<ReturnType<typeof classroomStorage.createClassroom>>>> {
  try {
    const createData = {
      name: input.name,
      displayName: input.displayName,
      ...(input.defaultGroupId !== undefined ? { defaultGroupId: input.defaultGroupId } : {}),
    };
    const created = await classroomStorage.createClassroom(createData);
    return { ok: true, data: created };
  } catch (error) {
    logger.error('classrooms.create error', { error: formatErrorMessage(error), input });
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return { ok: false, error: { code: 'CONFLICT', message: error.message } };
      }
      if (error.message.includes('invalid')) {
        return { ok: false, error: { code: 'BAD_REQUEST', message: error.message } };
      }
    }

    return {
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create classroom' },
    };
  }
}

export async function updateClassroom(
  id: string,
  updates: UpdateClassroomData
): Promise<ClassroomResult<Awaited<ReturnType<typeof classroomStorage.updateClassroom>>>> {
  const updated = await classroomStorage.updateClassroom(id, updates);
  if (!updated) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Classroom not found' } };
  }

  if (updates.defaultGroupId !== undefined) {
    DomainEventsService.publishClassroomChanged(updated.id);
  }

  return { ok: true, data: updated };
}

export async function setClassroomActiveGroup(
  user: ClassroomUser,
  input: SetActiveGroupInput
): Promise<ClassroomResult<{ classroom: ClassroomWithMachines; currentGroupId: string | null }>> {
  const access = await ensureUserCanAccessClassroom(user, input.id);
  if (!access.ok) {
    return access;
  }

  if (
    input.groupId !== null &&
    !auth.isAdminToken(user) &&
    !auth.canApproveGroup(user, input.groupId)
  ) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'You can only set groups within your assigned scope' },
    };
  }

  const updated = await classroomStorage.setActiveGroup(input.id, input.groupId);
  if (!updated) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Classroom not found' } };
  }

  DomainEventsService.publishClassroomChanged(updated.id);

  const result = await getClassroom(input.id, user);
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: {
      classroom: result.data,
      currentGroupId: result.data.currentGroupId,
    },
  };
}

export async function createExemptionForClassroom(
  user: ClassroomUser,
  input: CreateMachineExemptionInput
): Promise<ClassroomResult<MachineExemptionInfo>> {
  const access = await ensureUserCanAccessClassroom(user, input.classroomId);
  if (!access.ok) {
    return access;
  }

  try {
    const created = await createMachineExemption({
      machineId: input.machineId,
      classroomId: input.classroomId,
      scheduleId: input.scheduleId,
      createdBy: input.createdBy,
    });

    DomainEventsService.publishClassroomChanged(input.classroomId);
    return { ok: true, data: toMachineExemptionInfo(created) };
  } catch (error: unknown) {
    if (error instanceof MachineExemptionError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }

    return {
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create machine exemption' },
    };
  }
}

export async function deleteExemptionForClassroom(
  user: ClassroomUser,
  exemptionId: string
): Promise<ClassroomResult<{ success: true }>> {
  const existing = await getMachineExemptionById(exemptionId);
  if (!existing) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Exemption not found' } };
  }

  const access = await ensureUserCanAccessClassroom(user, existing.classroomId);
  if (!access.ok) {
    return access;
  }

  const deleted = await deleteMachineExemption(exemptionId);
  if (!deleted) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Exemption not found' } };
  }

  DomainEventsService.publishClassroomChanged(deleted.classroomId);
  return { ok: true, data: { success: true } };
}

export async function listExemptionsForClassroom(
  user: ClassroomUser,
  classroomId: string
): Promise<ClassroomResult<{ classroomId: string; exemptions: MachineExemptionInfo[] }>> {
  const access = await ensureUserCanAccessClassroom(user, classroomId);
  if (!access.ok) {
    return access;
  }

  const rows = await getActiveMachineExemptionsByClassroom(classroomId, new Date());
  return {
    ok: true,
    data: {
      classroomId,
      exemptions: rows.map(toMachineExemptionInfo),
    },
  };
}

export async function deleteClassroom(id: string): Promise<ClassroomResult<{ success: true }>> {
  if (!(await classroomStorage.deleteClassroom(id))) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Classroom not found' } };
  }

  return { ok: true, data: { success: true } };
}

export async function deleteMachine(hostname: string): Promise<ClassroomResult<{ success: true }>> {
  if (!(await classroomStorage.deleteMachine(hostname))) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Machine not found' } };
  }

  return { ok: true, data: { success: true } };
}

export async function rotateMachineToken(
  machineId: string
): Promise<ClassroomResult<RotateMachineTokenResult>> {
  const machine = await classroomStorage.getMachineById(machineId);
  if (!machine) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Machine not found' } };
  }

  const token = generateMachineToken();
  const tokenHash = hashMachineToken(token);
  await classroomStorage.setMachineDownloadTokenHash(machineId, tokenHash);

  const publicUrl = config.publicUrl ?? `http://${config.host}:${String(config.port)}`;
  const whitelistUrl = buildWhitelistUrl(publicUrl, token);

  logger.info('Machine download token rotated via dashboard', {
    machineId,
    hostname: machine.hostname,
  });

  return { ok: true, data: { whitelistUrl } };
}
