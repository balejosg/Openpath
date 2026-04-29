import { describe, expect, it } from 'vitest';

import type { OneOffScheduleWithPermissions, ScheduleWithPermissions } from '../../../types';
import {
  buildTeacherScheduleEntries,
  getTeacherScheduleFocus,
  getWeekMonday,
  type TeacherScheduleEntry,
} from '../teacher-schedule-model';

function makeSchedule(overrides: Partial<ScheduleWithPermissions> = {}): ScheduleWithPermissions {
  return {
    id: 'schedule-1',
    classroomId: 'classroom-1',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '09:00',
    groupId: 'group-1',
    groupDisplayName: 'Group One',
    teacherId: 'teacher-1',
    teacherName: 'Ada',
    recurrence: 'weekly',
    createdAt: '2026-04-01T00:00:00',
    updatedAt: '2026-04-01T00:00:00',
    isMine: true,
    canEdit: true,
    ...overrides,
  };
}

function makeOneOffSchedule(
  overrides: Partial<OneOffScheduleWithPermissions> = {}
): OneOffScheduleWithPermissions {
  return {
    id: 'one-off-1',
    classroomId: 'classroom-1',
    startAt: '2026-04-29T08:00:00',
    endAt: '2026-04-29T09:00:00',
    groupId: 'group-1',
    groupDisplayName: 'Group One',
    teacherId: 'teacher-1',
    teacherName: 'Ada',
    recurrence: 'one_off',
    createdAt: '2026-04-01T00:00:00',
    updatedAt: '2026-04-01T00:00:00',
    isMine: true,
    canEdit: true,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<TeacherScheduleEntry> = {}): TeacherScheduleEntry {
  return {
    kind: 'weekly',
    id: 'entry-1',
    schedule: makeSchedule(),
    dayOfWeek: 1,
    startAt: new Date(2026, 3, 27, 9, 0, 0, 0),
    endAt: new Date(2026, 3, 27, 10, 0, 0, 0),
    startTime: '09:00',
    endTime: '10:00',
    startMinutes: 9 * 60,
    endMinutes: 10 * 60,
    classroomId: 'classroom-1',
    colorKey: 'classroom-1',
    label: 'Group One - Lab A',
    groupName: 'Group One',
    classroomName: 'Lab A',
    canEdit: true,
    laneIndex: 0,
    laneCount: 1,
    ...overrides,
  };
}

describe('teacher-schedule-model', () => {
  it('returns Monday at local midnight for the selected week', () => {
    const monday = getWeekMonday(new Date('2026-04-29T12:00:00'));

    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(3);
    expect(monday.getDate()).toBe(27);
    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);
    expect(monday.getSeconds()).toBe(0);
    expect(monday.getMilliseconds()).toBe(0);
  });

  it('builds weekly dated entries, clips one-offs, labels classrooms, and assigns overlap lanes', () => {
    const weekMonday = new Date(2026, 3, 27, 0, 0, 0, 0);
    const entries = buildTeacherScheduleEntries({
      weeklySchedules: [
        makeSchedule({
          id: 'weekly-overlap-a',
          classroomId: 'classroom-1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '10:00',
          groupId: 'group-1',
        }),
        makeSchedule({
          id: 'weekly-overlap-b',
          classroomId: 'classroom-2',
          dayOfWeek: 1,
          startTime: '09:15',
          endTime: '10:15',
          groupId: 'group-1',
        }),
        makeSchedule({
          id: 'weekly-wednesday',
          classroomId: 'classroom-1',
          dayOfWeek: 3,
          startTime: '14:00',
          endTime: '15:30',
          groupId: 'group-2',
          groupDisplayName: 'Group Two',
        }),
      ],
      oneOffSchedules: [
        makeOneOffSchedule({
          id: 'one-off-cross-midnight',
          classroomId: 'classroom-1',
          groupId: 'group-2',
          groupDisplayName: 'Group Two',
          startAt: '2026-04-29T23:30:00',
          endAt: '2026-04-30T01:15:00',
        }),
        makeOneOffSchedule({
          id: 'one-off-outside-week',
          classroomId: 'classroom-1',
          startAt: '2026-05-04T08:00:00',
          endAt: '2026-05-04T09:00:00',
        }),
      ],
      classroomNameMap: new Map([
        ['classroom-1', 'Lab A'],
        ['classroom-2', 'Lab B'],
      ]),
      groupNameMap: new Map([
        ['group-1', 'Group One'],
        ['group-2', 'Group Two'],
      ]),
      weekMonday,
    });

    const weeklyWednesday = entries.find((entry) => entry.schedule.id === 'weekly-wednesday');
    expect(weeklyWednesday).toMatchObject({
      kind: 'weekly',
      dayOfWeek: 3,
      startTime: '14:00',
      endTime: '15:30',
      colorKey: 'classroom-1',
      label: 'Group Two - Lab A',
    });
    expect(weeklyWednesday?.startAt.getTime()).toBe(new Date(2026, 3, 29, 14, 0, 0, 0).getTime());
    expect(weeklyWednesday?.endAt.getTime()).toBe(new Date(2026, 3, 29, 15, 30, 0, 0).getTime());

    expect(entries.some((entry) => entry.schedule.id === 'one-off-outside-week')).toBe(false);

    const splitOneOffEntries = entries
      .filter((entry) => entry.schedule.id === 'one-off-cross-midnight')
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    expect(splitOneOffEntries).toHaveLength(2);
    expect(splitOneOffEntries[0]).toMatchObject({
      kind: 'one_off',
      dayOfWeek: 3,
      startTime: '23:30',
      endTime: '24:00',
      startMinutes: 23 * 60 + 30,
      endMinutes: 24 * 60,
      label: 'Group Two - Lab A',
    });
    expect(splitOneOffEntries[1]).toMatchObject({
      kind: 'one_off',
      dayOfWeek: 4,
      startTime: '00:00',
      endTime: '01:15',
      startMinutes: 0,
      endMinutes: 75,
      label: 'Group Two - Lab A',
    });

    const mondayOverlapEntries = entries
      .filter(
        (entry) =>
          entry.schedule.id === 'weekly-overlap-a' || entry.schedule.id === 'weekly-overlap-b'
      )
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    expect(mondayOverlapEntries.map((entry) => entry.label)).toEqual([
      'Group One - Lab A',
      'Group One - Lab B',
    ]);
    expect(mondayOverlapEntries.map((entry) => entry.laneCount)).toEqual([2, 2]);
    expect(new Set(mondayOverlapEntries.map((entry) => entry.laneIndex))).toEqual(new Set([0, 1]));
  });

  it('returns the earliest-ending current entry and a sorted agenda for today', () => {
    const now = new Date(2026, 3, 27, 9, 30, 0, 0);
    const entries = [
      makeEntry({
        id: 'entry-current-long',
        startAt: new Date(2026, 3, 27, 9, 0, 0, 0),
        endAt: new Date(2026, 3, 27, 10, 0, 0, 0),
        startTime: '09:00',
        endTime: '10:00',
        startMinutes: 9 * 60,
        endMinutes: 10 * 60,
      }),
      makeEntry({
        id: 'entry-current-short',
        startAt: new Date(2026, 3, 27, 9, 15, 0, 0),
        endAt: new Date(2026, 3, 27, 9, 45, 0, 0),
        startTime: '09:15',
        endTime: '09:45',
        startMinutes: 9 * 60 + 15,
        endMinutes: 9 * 60 + 45,
      }),
      makeEntry({
        id: 'entry-later-today',
        startAt: new Date(2026, 3, 27, 11, 0, 0, 0),
        endAt: new Date(2026, 3, 27, 12, 0, 0, 0),
        startTime: '11:00',
        endTime: '12:00',
        startMinutes: 11 * 60,
        endMinutes: 12 * 60,
      }),
      makeEntry({
        id: 'entry-other-day',
        dayOfWeek: 2,
        startAt: new Date(2026, 3, 28, 9, 0, 0, 0),
        endAt: new Date(2026, 3, 28, 10, 0, 0, 0),
      }),
    ];

    const focus = getTeacherScheduleFocus(entries, now);

    expect(focus.currentEntry?.id).toBe('entry-current-short');
    expect(focus.nextEntry).toBeNull();
    expect(focus.todayEntries.map((entry) => entry.id)).toEqual([
      'entry-current-long',
      'entry-current-short',
      'entry-later-today',
    ]);
  });

  it('returns the next entry when no class is active and one remains today', () => {
    const now = new Date(2026, 3, 27, 8, 30, 0, 0);
    const entries = [
      makeEntry({
        id: 'entry-next',
        startAt: new Date(2026, 3, 27, 9, 0, 0, 0),
        endAt: new Date(2026, 3, 27, 10, 0, 0, 0),
        startTime: '09:00',
        endTime: '10:00',
        startMinutes: 9 * 60,
        endMinutes: 10 * 60,
      }),
      makeEntry({
        id: 'entry-late',
        startAt: new Date(2026, 3, 27, 13, 0, 0, 0),
        endAt: new Date(2026, 3, 27, 14, 0, 0, 0),
        startTime: '13:00',
        endTime: '14:00',
        startMinutes: 13 * 60,
        endMinutes: 14 * 60,
      }),
    ];

    const focus = getTeacherScheduleFocus(entries, now);

    expect(focus.currentEntry).toBeNull();
    expect(focus.nextEntry?.id).toBe('entry-next');
    expect(focus.todayEntries.map((entry) => entry.id)).toEqual(['entry-next', 'entry-late']);
  });
});
