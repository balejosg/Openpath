import * as auth from '../lib/auth.js';
import * as classroomStorage from '../lib/classroom-storage.js';
import type {
  ClassroomMachineListItem,
  ClassroomResult,
  ClassroomUser,
  ClassroomWithMachines,
} from './classroom-service-shared.js';
import {
  buildClassroomWithMachines,
  toClassroomMachineListItem,
} from './classroom-service-shared.js';
import { canAccessClassroomScope } from './classroom-access.service.js';

export async function listClassrooms(user?: ClassroomUser): Promise<ClassroomWithMachines[]> {
  const classrooms = await classroomStorage.getAllClassrooms();
  const now = new Date();
  const [machinesByClassroomId, scopeByClassroomId] = await Promise.all([
    classroomStorage.getMachinesByClassroomIds(classrooms.map((classroom) => classroom.id)),
    classroomStorage.resolveClassroomPolicyScopesForClassrooms(classrooms, now),
  ]);

  const result = classrooms.map((classroom) =>
    buildClassroomWithMachines(
      classroom,
      machinesByClassroomId.get(classroom.id) ?? [],
      scopeByClassroomId.get(classroom.id)
    )
  );

  if (!user || auth.isAdminToken(user)) {
    return result;
  }

  return result.filter((classroom) => canAccessClassroomScope(user, classroom));
}

export async function getClassroom(
  id: string,
  user?: ClassroomUser
): Promise<ClassroomResult<ClassroomWithMachines>> {
  const classroom = await classroomStorage.getClassroomById(id);
  if (!classroom) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Classroom not found' } };
  }

  const [rawMachines, scope] = await Promise.all([
    classroomStorage.getMachinesByClassroom(id),
    classroomStorage.resolveClassroomPolicyScope(id),
  ]);
  const result = buildClassroomWithMachines(classroom, rawMachines, scope);

  if (user && !canAccessClassroomScope(user, result)) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'You do not have access to this classroom' },
    };
  }

  return { ok: true, data: result };
}

export async function getStats(): Promise<Awaited<ReturnType<typeof classroomStorage.getStats>>> {
  return await classroomStorage.getStats();
}

export async function listMachines(classroomId?: string): Promise<ClassroomMachineListItem[]> {
  const allMachines = await classroomStorage.getAllMachines(classroomId);
  return allMachines.map(toClassroomMachineListItem);
}
