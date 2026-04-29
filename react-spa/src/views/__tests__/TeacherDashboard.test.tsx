import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import TeacherDashboard from '../TeacherDashboard';
import { renderWithQueryClient } from '../../test-utils/query';
import type { ClassroomListItem } from '../../lib/classrooms';
import type { OneOffScheduleWithPermissions, ScheduleWithPermissions } from '../../types';

let queryClient: ReturnType<typeof renderWithQueryClient>['queryClient'] | null = null;
const RealDate = Date;

type MockClassroomListItem = ClassroomListItem & {
  defaultGroupDisplayName?: string | null;
  currentGroupDisplayName?: string | null;
};

const {
  mockClassroomsListQuery,
  mockGroupsListQuery,
  mockGetByClassroomQuery,
  mockSetActiveGroup,
  mockSchedulesUpdate,
  mockSchedulesUpdateOneOff,
  mockSchedulesDelete,
  mockReportError,
} = vi.hoisted(() => ({
  mockClassroomsListQuery: vi.fn(),
  mockGroupsListQuery: vi.fn(),
  mockGetByClassroomQuery: vi.fn(),
  mockSetActiveGroup: vi.fn(),
  mockSchedulesUpdate: vi.fn(),
  mockSchedulesUpdateOneOff: vi.fn(),
  mockSchedulesDelete: vi.fn(),
  mockReportError: vi.fn(),
}));

vi.mock('../../lib/trpc', () => ({
  trpc: {
    classrooms: {
      list: { query: (): unknown => mockClassroomsListQuery() },
      setActiveGroup: { mutate: (input: unknown): unknown => mockSetActiveGroup(input) },
    },
    groups: {
      list: { query: (): unknown => mockGroupsListQuery() },
    },
    schedules: {
      getByClassroom: { query: (input: unknown): unknown => mockGetByClassroomQuery(input) },
      update: { mutate: (input: unknown): unknown => mockSchedulesUpdate(input) },
      updateOneOff: { mutate: (input: unknown): unknown => mockSchedulesUpdateOneOff(input) },
      delete: { mutate: (input: unknown): unknown => mockSchedulesDelete(input) },
    },
  },
}));

vi.mock('../../lib/reportError', () => ({
  reportError: mockReportError,
}));

vi.mock('../../components/ScheduleFormModal', () => ({
  default: ({
    schedule,
    onClose,
  }: {
    schedule: ScheduleWithPermissions | null;
    onClose: () => void;
  }) => (
    <div data-testid="schedule-form-modal">
      Horario semanal:{schedule?.id ?? 'nuevo'}
      <button onClick={onClose}>Cerrar horario semanal</button>
    </div>
  ),
}));

vi.mock('../../components/OneOffScheduleFormModal', () => ({
  default: ({
    schedule,
    onClose,
  }: {
    schedule: OneOffScheduleWithPermissions | null;
    onClose: () => void;
  }) => (
    <div data-testid="one-off-schedule-form-modal">
      Horario puntual:{schedule?.id ?? 'nuevo'}
      <button onClick={onClose}>Cerrar horario puntual</button>
    </div>
  ),
}));

function renderTeacherDashboard(props?: React.ComponentProps<typeof TeacherDashboard>) {
  const rendered = renderWithQueryClient(<TeacherDashboard {...props} />);
  queryClient = rendered.queryClient;
  return rendered;
}

async function renderTeacherDashboardReady(props?: React.ComponentProps<typeof TeacherDashboard>) {
  return renderTeacherDashboard(props);
}

function mockNow(isoString: string) {
  const fixed = new RealDate(isoString);

  class MockDate extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(fixed.valueOf());
        return;
      }

      const [value] = args;
      super(value);
    }

    static now() {
      return fixed.valueOf();
    }

    static parse = RealDate.parse;
    static UTC = RealDate.UTC;
  }

  vi.stubGlobal('Date', MockDate);
}

function makeClassroom(overrides: Partial<MockClassroomListItem> = {}): MockClassroomListItem {
  return {
    id: 'classroom-1',
    name: 'lab-a',
    displayName: 'Lab A',
    defaultGroupId: 'group-1',
    defaultGroupDisplayName: 'Investigacion',
    activeGroupId: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    currentGroupId: 'group-1',
    currentGroupDisplayName: 'Investigacion',
    currentGroupSource: 'schedule',
    machineCount: 12,
    onlineMachineCount: 10,
    status: 'operational',
    machines: [],
    ...overrides,
  };
}

function makeWeeklySchedule(
  overrides: Partial<ScheduleWithPermissions> = {}
): ScheduleWithPermissions {
  return {
    id: 'weekly-1',
    classroomId: 'classroom-1',
    dayOfWeek: 3,
    startTime: '09:00',
    endTime: '10:00',
    groupId: 'group-1',
    groupDisplayName: 'Investigacion',
    teacherId: 'teacher-1',
    teacherName: 'Ada',
    recurrence: 'weekly',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
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
    classroomId: 'classroom-2',
    startAt: '2026-04-29T12:00:00',
    endAt: '2026-04-29T13:00:00',
    groupId: 'group-2',
    groupDisplayName: 'Examen',
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

function primeDashboardData(options?: {
  classrooms?: MockClassroomListItem[];
  schedulesByClassroom?: Record<
    string,
    {
      schedules: ScheduleWithPermissions[];
      oneOffSchedules: OneOffScheduleWithPermissions[];
    }
  >;
}) {
  const classrooms = options?.classrooms ?? [
    makeClassroom(),
    makeClassroom({
      id: 'classroom-2',
      name: 'lab-b',
      displayName: 'Lab B',
      defaultGroupId: 'group-2',
      defaultGroupDisplayName: 'Examen',
      currentGroupId: 'group-2',
      currentGroupDisplayName: 'Examen',
      machineCount: 14,
      onlineMachineCount: 14,
    }),
  ];

  const schedulesByClassroom = options?.schedulesByClassroom ?? {
    'classroom-1': {
      schedules: [makeWeeklySchedule()],
      oneOffSchedules: [],
    },
    'classroom-2': {
      schedules: [],
      oneOffSchedules: [makeOneOffSchedule()],
    },
  };

  mockClassroomsListQuery.mockResolvedValue(classrooms);
  mockGroupsListQuery.mockResolvedValue([
    { id: 'group-1', name: 'research', displayName: 'Investigacion', enabled: true },
    { id: 'group-2', name: 'exam', displayName: 'Examen', enabled: true },
  ]);
  mockSetActiveGroup.mockResolvedValue({});
  mockSchedulesUpdate.mockResolvedValue({});
  mockSchedulesUpdateOneOff.mockResolvedValue({});
  mockSchedulesDelete.mockResolvedValue({});
  mockGetByClassroomQuery.mockImplementation(({ classroomId }: { classroomId: string }) => {
    return Promise.resolve(
      schedulesByClassroom[classroomId] ?? {
        schedules: [],
        oneOffSchedules: [],
      }
    );
  });
}

afterEach(() => {
  queryClient?.clear();
  queryClient = null;
  vi.unstubAllGlobals();
});

describe('TeacherDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNow('2026-04-29T09:30:00');
    localStorage.clear();
    primeDashboardData();
  });

  it('renders the daily focus panel before the weekly calendar and shows the current class label', async () => {
    await renderTeacherDashboardReady();

    await waitFor(() => {
      expect(screen.getByText('Tu horario de hoy')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Clase actual')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Investigacion - Lab A').length).toBeGreaterThan(0);

    const renderedText = document.body.textContent ?? '';
    expect(renderedText.indexOf('Tu horario de hoy')).toBeLessThan(renderedText.indexOf('Semana'));
  });

  it('shows the next class when no entry is active', async () => {
    mockNow('2026-04-29T10:30:00');
    await renderTeacherDashboardReady();

    expect(await screen.findByText('Siguiente clase')).toBeInTheDocument();
    expect(screen.getAllByText('Examen - Lab B').length).toBeGreaterThan(0);
  });

  it('resets the selected week when pressing Hoy', async () => {
    await renderTeacherDashboardReady();

    await screen.findByRole('button', { name: 'Ver detalles Investigacion - Lab A 09:00-10:00' });

    fireEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Ver detalles Examen - Lab B 12:00-13:00' })
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(
      await screen.findByRole('button', { name: 'Ver detalles Examen - Lab B 12:00-13:00' })
    ).toBeInTheDocument();
  });

  it('opens the detail panel when selecting a calendar block', async () => {
    await renderTeacherDashboardReady();

    const block = await screen.findByRole('button', {
      name: 'Ver detalles Investigacion - Lab A 09:00-10:00',
    });

    fireEvent.click(block);

    expect(await screen.findByRole('heading', { name: 'Detalle del horario' })).toBeInTheDocument();
    expect(screen.getByText('Semanal')).toBeInTheDocument();
  });

  it('routes classroom actions from the detail panel and opens the expected edit and delete flows', async () => {
    const onNavigateToRules = vi.fn();
    await renderTeacherDashboardReady({ onNavigateToRules });

    const block = await screen.findByRole('button', {
      name: 'Ver detalles Investigacion - Lab A 09:00-10:00',
    });
    fireEvent.click(block);

    const dialog = await screen.findByRole('dialog', { name: 'Detalle del horario' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver reglas' }));
    expect(onNavigateToRules).toHaveBeenCalledWith({ id: 'group-1', name: 'Investigacion' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Tomar control' }));
    await waitFor(() => {
      expect(mockSetActiveGroup).toHaveBeenCalledWith({ id: 'classroom-1', groupId: 'group-1' });
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Liberar aula' }));
    await waitFor(() => {
      expect(mockSetActiveGroup).toHaveBeenCalledWith({ id: 'classroom-1', groupId: null });
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Editar horario' }));
    expect(await screen.findByTestId('schedule-form-modal')).toHaveTextContent(
      'Horario semanal:weekly-1'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar horario semanal' }));
    await waitFor(() => {
      expect(screen.queryByTestId('schedule-form-modal')).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver detalles Examen - Lab B 12:00-13:00',
      })
    );

    const oneOffDialog = await screen.findByRole('dialog', { name: 'Detalle del horario' });
    fireEvent.click(within(oneOffDialog).getByRole('button', { name: 'Editar horario' }));
    expect(await screen.findByTestId('one-off-schedule-form-modal')).toHaveTextContent(
      'Horario puntual:one-off-1'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar horario puntual' }));
    await waitFor(() => {
      expect(screen.queryByTestId('one-off-schedule-form-modal')).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver detalles Investigacion - Lab A 09:00-10:00',
      })
    );
    const deleteDialog = await screen.findByRole('dialog', { name: 'Detalle del horario' });
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Eliminar horario' }));

    const confirmDialog = await screen.findByRole('dialog', { name: 'Eliminar horario' });
    expect(confirmDialog).toHaveTextContent('Investigacion - Lab A');
    expect(confirmDialog).toHaveTextContent('Semanal');
    expect(confirmDialog).toHaveTextContent('09:00 - 10:00');
  });

  it('shows the legacy and feature-flag hints in the classroom control card', async () => {
    mockGroupsListQuery.mockResolvedValue([]);
    const firstRender = await renderTeacherDashboardReady();

    expect(
      await screen.findByText(
        'No tienes políticas asignadas. Pide a un administrador que te asigne una.'
      )
    ).toBeInTheDocument();

    firstRender.unmount();
    localStorage.setItem('openpath_teacher_groups_enabled', '1');
    mockGroupsListQuery.mockResolvedValue([]);
    await renderTeacherDashboardReady();

    expect(
      await screen.findByText('No tienes políticas. Ve a "Mis Políticas" para crear una.')
    ).toBeInTheDocument();
  });

  it('shows retry UI when classroom loading fails and triggers a refetch', async () => {
    mockClassroomsListQuery.mockRejectedValueOnce(new Error('boom'));
    mockClassroomsListQuery.mockResolvedValueOnce([]);

    await renderTeacherDashboardReady();

    expect(await screen.findByText('Error al cargar aulas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(mockClassroomsListQuery).toHaveBeenCalledTimes(2);
    });
    expect(mockReportError).toHaveBeenCalledWith('Failed to fetch classrooms:', expect.any(Error));
  });
});
