import * as auth from '../lib/auth.js';
import * as classroomStorage from '../lib/classroom-storage.js';
import type {
  ClassroomAccessResult,
  ClassroomAccessScope,
  ClassroomUser,
} from './classroom-service-shared.js';
import { normalizeCurrentGroupSource } from './classroom-service-shared.js';

function canAccessClassroomScope(
  user: ClassroomUser,
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

type ClassroomAccessPurpose = 'view' | 'enroll';

async function resolveClassroomAccessScope(
  classroomId: string
): Promise<ClassroomAccessScope | null> {
  const scope = await classroomStorage.resolveClassroomPolicyScope(classroomId);
  if (!scope) {
    return null;
  }

  return {
    id: scope.classroomId,
    name: scope.classroomName,
    displayName: scope.classroomDisplayName,
    defaultGroupId: scope.defaultGroupId,
    activeGroupId: scope.activeGroupId,
    currentGroupId: scope.currentGroupId,
    currentGroupSource: normalizeCurrentGroupSource(scope.currentGroupSource),
  };
}

function canUseClassroomScope(
  user: ClassroomUser,
  scope: ClassroomAccessScope,
  purpose: ClassroomAccessPurpose
): boolean {
  if (purpose === 'enroll' && scope.currentGroupSource === 'none') {
    return true;
  }

  return canAccessClassroomScope(user, scope);
}

async function ensureUserCanUseClassroom(
  user: ClassroomUser,
  classroomId: string,
  purpose: ClassroomAccessPurpose
): Promise<ClassroomAccessResult> {
  const scope = await resolveClassroomAccessScope(classroomId);
  if (!scope) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Classroom not found' } };
  }

  if (!canUseClassroomScope(user, scope, purpose)) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'You do not have access to this classroom' },
    };
  }

  return { ok: true, data: scope };
}

export async function ensureUserCanAccessClassroom(
  user: ClassroomUser,
  classroomId: string
): Promise<ClassroomAccessResult> {
  return ensureUserCanUseClassroom(user, classroomId, 'view');
}

export async function ensureUserCanEnrollClassroom(
  user: ClassroomUser,
  classroomId: string
): Promise<ClassroomAccessResult> {
  return ensureUserCanUseClassroom(user, classroomId, 'enroll');
}

export {
  canAccessClassroomScope,
  canUseClassroomScope,
  resolveClassroomAccessScope,
  ensureUserCanUseClassroom,
};
