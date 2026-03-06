import type { Classroom, CurrentGroupSource } from '../types';
import { trpc } from './trpc';

export type ClassroomListItem = Awaited<ReturnType<typeof trpc.classrooms.list.query>>[number];

export interface ClassroomListMetadata {
  defaultGroupDisplayName: string | null;
  currentGroupDisplayName: string | null;
}

export interface ClassroomControlState {
  id: string;
  name: string;
  displayName: string;
  defaultGroupId: string | null;
  defaultGroupDisplayName: string | null;
  activeGroupId: string | null;
  currentGroupId: string | null;
  currentGroupDisplayName: string | null;
  currentGroupSource: CurrentGroupSource | null;
}

function readOptionalStringField(item: unknown, key: keyof ClassroomListMetadata): string | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const value = (item as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

export function readClassroomListMetadata(item: ClassroomListItem): ClassroomListMetadata {
  return {
    defaultGroupDisplayName: readOptionalStringField(item, 'defaultGroupDisplayName'),
    currentGroupDisplayName: readOptionalStringField(item, 'currentGroupDisplayName'),
  };
}

export function toClassroom(item: ClassroomListItem): Classroom {
  const metadata = readClassroomListMetadata(item);

  return {
    id: item.id,
    name: item.name,
    displayName: item.displayName,
    defaultGroupId: item.defaultGroupId ?? null,
    defaultGroupDisplayName: metadata.defaultGroupDisplayName,
    computerCount: item.machineCount,
    activeGroup: item.activeGroupId ?? null,
    currentGroupId: item.currentGroupId ?? null,
    currentGroupDisplayName: metadata.currentGroupDisplayName,
    currentGroupSource: item.currentGroupSource,
    status: item.status,
    onlineMachineCount: item.onlineMachineCount,
    machines: item.machines,
  };
}

export function toClassrooms(items: readonly ClassroomListItem[]): Classroom[] {
  return items.map(toClassroom);
}

export function toClassroomControlState(item: ClassroomListItem): ClassroomControlState {
  const metadata = readClassroomListMetadata(item);

  return {
    id: item.id,
    name: item.name,
    displayName: item.displayName,
    defaultGroupId: item.defaultGroupId ?? null,
    defaultGroupDisplayName: metadata.defaultGroupDisplayName,
    activeGroupId: item.activeGroupId ?? null,
    currentGroupId: item.currentGroupId ?? null,
    currentGroupDisplayName: metadata.currentGroupDisplayName,
    currentGroupSource: item.currentGroupSource,
  };
}

export function toClassroomControlStates(items: readonly ClassroomListItem[]): ClassroomControlState[] {
  return items.map(toClassroomControlState);
}
