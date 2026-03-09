/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 *
 * ClassroomService - Business logic for classroom and machine management
 */

import * as classroomStorage from '../lib/classroom-storage.js';
import * as scheduleStorage from '../lib/schedule-storage.js';
import * as auth from '../lib/auth.js';

import {
  calculateClassroomMachineStatus as calculateMachineStatus,
  calculateClassroomStatus,
  resolveCurrentGroup,
  type ClassroomMachineStatus as SharedMachineStatus,
  type ClassroomStatus as SharedClassroomStatus,
  type CurrentGroupSource as SharedCurrentGroupSource,
} from '@openpath/shared';
import type { JWTPayload } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

export interface RegisterMachineInput {
  hostname: string;
  classroomId?: string | undefined;
  classroomName?: string | undefined;
  version?: string | undefined;
}

export type MachineStatus = SharedMachineStatus;
export type ClassroomStatus = SharedClassroomStatus;

export interface MachineInfo {
  id: string;
  hostname: string;
  lastSeen: string | null;
  status: MachineStatus;
}

export interface MachineRegistrationResult {
  hostname: string;
  classroomId: string;
  classroomName: string;
  version?: string;
  lastSeen: string;
}

export type CurrentGroupSource = SharedCurrentGroupSource;

export interface ClassroomWithMachines {
  id: string;
  name: string;
  displayName: string;
  defaultGroupId: string | null;
  activeGroupId: string | null;
  createdAt: string;
  updatedAt: string;
  currentGroupId: string | null;
  currentGroupSource: CurrentGroupSource;
  machines: MachineInfo[];
  machineCount: number;
  status: ClassroomStatus;
  onlineMachineCount: number;
}

export interface ClassroomAccessScope {
  id: string;
  name: string;
  displayName: string;
  defaultGroupId: string | null;
  activeGroupId: string | null;
  currentGroupId: string | null;
  currentGroupSource: CurrentGroupSource;
}

export interface UpdateClassroomData {
  name?: string;
  displayName?: string;
  defaultGroupId?: string;
  activeGroupId?: string;
}

// Use standard tRPC error codes for easy mapping
export type ClassroomServiceError =
  | { code: 'BAD_REQUEST'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'CONFLICT'; message: string }
  | { code: 'INTERNAL_SERVER_ERROR'; message: string };

export type ClassroomResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ClassroomServiceError };

export type ClassroomAccessResult =
  | { ok: true; data: ClassroomAccessScope }
  | { ok: false; error: { code: 'FORBIDDEN' | 'NOT_FOUND'; message: string } };

// =============================================================================
// Service Implementation
// =============================================================================

function canAccessClassroomScope(
  user: JWTPayload,
  scope: Pick<ClassroomAccessScope, 'defaultGroupId' | 'activeGroupId' | 'currentGroupId'>
): boolean {
  if (auth.isAdminToken(user)) {
    return true;
  }

  const candidateGroupIds = [
    scope.activeGroupId,
    scope.currentGroupId,
    scope.defaultGroupId,
  ].filter((groupId): groupId is string => typeof groupId === 'string' && groupId.length > 0);

  return candidateGroupIds.some((groupId) => auth.canApproveGroup(user, groupId));
}

export async function ensureUserCanAccessClassroom(
  user: JWTPayload,
  classroomId: string
): Promise<ClassroomAccessResult> {
  const classroom = await classroomStorage.getClassroomById(classroomId);
  if (!classroom) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Classroom not found' } };
  }

  const currentSchedule = await scheduleStorage.getCurrentSchedule(classroom.id);
  const currentGroup = resolveCurrentGroup({
    activeGroupId: classroom.activeGroupId,
    scheduleGroupId: currentSchedule?.groupId ?? null,
    defaultGroupId: classroom.defaultGroupId,
  });

  const scope: ClassroomAccessScope = {
    id: classroom.id,
    name: classroom.name,
    displayName: classroom.displayName,
    defaultGroupId: classroom.defaultGroupId,
    activeGroupId: classroom.activeGroupId,
    currentGroupId: currentGroup.id,
    currentGroupSource: currentGroup.source,
  };

  if (!canAccessClassroomScope(user, scope)) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'You do not have access to this classroom' },
    };
  }

  return { ok: true, data: scope };
}

/**
 * List all classrooms with their machine counts and current state
 */
export async function listClassrooms(user?: JWTPayload): Promise<ClassroomWithMachines[]> {
  const classrooms = await classroomStorage.getAllClassrooms();
  const result = await Promise.all(
    classrooms.map(async (c) => {
      const rawMachines = await classroomStorage.getMachinesByClassroom(c.id);
      const machines: MachineInfo[] = rawMachines.map((m) => ({
        id: m.id,
        hostname: m.hostname,
        lastSeen: m.lastSeen?.toISOString() ?? null,
        status: calculateMachineStatus(m.lastSeen),
      }));

      // Use schedule service for current group
      const currentSchedule = await scheduleStorage.getCurrentSchedule(c.id);
      const currentGroup = resolveCurrentGroup({
        activeGroupId: c.activeGroupId,
        scheduleGroupId: currentSchedule?.groupId ?? null,
        defaultGroupId: c.defaultGroupId,
      });

      // Calculate classroom status based on machine health
      const status = calculateClassroomStatus(machines);
      const onlineMachineCount = machines.filter((m) => m.status === 'online').length;

      return {
        id: c.id,
        name: c.name,
        displayName: c.displayName,
        defaultGroupId: c.defaultGroupId,
        activeGroupId: c.activeGroupId,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        currentGroupId: currentGroup.id,
        currentGroupSource: currentGroup.source,
        machines,
        machineCount: machines.length,
        status,
        onlineMachineCount,
      };
    })
  );

  if (!user || auth.isAdminToken(user)) {
    return result;
  }

  return result.filter((classroom) => canAccessClassroomScope(user, classroom));
}

/**
 * Get a specific classroom with its machines and current state
 */
export async function getClassroom(
  id: string,
  user?: JWTPayload
): Promise<ClassroomResult<ClassroomWithMachines>> {
  const classroom = await classroomStorage.getClassroomById(id);
  if (!classroom)
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Classroom not found' } };

  const rawMachines = await classroomStorage.getMachinesByClassroom(id);
  const machines: MachineInfo[] = rawMachines.map((m) => ({
    id: m.id,
    hostname: m.hostname,
    lastSeen: m.lastSeen?.toISOString() ?? null,
    status: calculateMachineStatus(m.lastSeen),
  }));

  const currentSchedule = await scheduleStorage.getCurrentSchedule(id);
  const currentGroup = resolveCurrentGroup({
    activeGroupId: classroom.activeGroupId,
    scheduleGroupId: currentSchedule?.groupId ?? null,
    defaultGroupId: classroom.defaultGroupId,
  });

  // Calculate classroom status based on machine health
  const status = calculateClassroomStatus(machines);
  const onlineMachineCount = machines.filter((m) => m.status === 'online').length;

  const result: ClassroomWithMachines = {
    id: classroom.id,
    name: classroom.name,
    displayName: classroom.displayName,
    defaultGroupId: classroom.defaultGroupId,
    activeGroupId: classroom.activeGroupId,
    createdAt: (classroom.createdAt ?? new Date()).toISOString(),
    updatedAt: (classroom.updatedAt ?? new Date()).toISOString(),
    currentGroupId: currentGroup.id,
    currentGroupSource: currentGroup.source,
    machines,
    machineCount: machines.length,
    status,
    onlineMachineCount,
  };

  if (user && !canAccessClassroomScope(user, result)) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'You do not have access to this classroom' },
    };
  }

  return {
    ok: true,
    data: result,
  };
}

/**
 * Register a machine to a classroom
 */
export async function registerMachine(
  input: RegisterMachineInput
): Promise<ClassroomResult<MachineRegistrationResult>> {
  // Validate hostname
  if (!input.hostname || input.hostname.trim() === '') {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Hostname required' },
    };
  }

  // Resolve classroom ID
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

  // Register the machine
  const machine = await classroomStorage.registerMachine({
    hostname: machineHostname,
    reportedHostname,
    classroomId: classroom.id,
    ...(input.version ? { version: input.version } : {}),
  });

  // Type the result properly
  const result: MachineRegistrationResult = {
    // Preserve the human-readable hostname for clients; the persisted identity is canonicalized.
    hostname: machine.reportedHostname ?? reportedHostname,
    classroomId: machine.classroomId ?? classroom.id,
    classroomName: classroom.name,
    lastSeen: machine.lastSeen?.toISOString() ?? new Date().toISOString(),
    ...(machine.version !== null && { version: machine.version }),
  };

  return {
    ok: true,
    data: result,
  };
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  registerMachine,
  listClassrooms,
  getClassroom,
  ensureUserCanAccessClassroom,
};
