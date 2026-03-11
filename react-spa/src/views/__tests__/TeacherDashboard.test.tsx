import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import TeacherDashboard from '../TeacherDashboard';
import { renderWithQueryClient } from '../../test-utils/query';

let queryClient: ReturnType<typeof renderWithQueryClient>['queryClient'] | null = null;

const { mockClassroomsListQuery, mockGroupsListQuery, mockSetActiveGroup, mockReportError } =
  vi.hoisted(() => ({
    mockClassroomsListQuery: vi.fn(),
    mockGroupsListQuery: vi.fn(),
    mockSetActiveGroup: vi.fn(),
    mockReportError: vi.fn(),
  }));

vi.mock('../../lib/trpc', () => ({
  trpc: {
    classrooms: {
      list: { query: mockClassroomsListQuery },
      setActiveGroup: { mutate: mockSetActiveGroup },
    },
    groups: {
      list: { query: mockGroupsListQuery },
    },
  },
}));

vi.mock('../../lib/reportError', () => ({
  reportError: mockReportError,
}));

function renderTeacherDashboard(props?: React.ComponentProps<typeof TeacherDashboard>) {
  const rendered = renderWithQueryClient(<TeacherDashboard {...props} />);
  queryClient = rendered.queryClient;
  return rendered;
}

afterEach(() => {
  queryClient?.clear();
  queryClient = null;
});

describe('TeacherDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockClassroomsListQuery.mockResolvedValue([]);
    mockGroupsListQuery.mockResolvedValue([]);
    mockSetActiveGroup.mockResolvedValue({});
  });

  it('renders the teacher dashboard greeting', async () => {
    renderTeacherDashboard();

    expect(await screen.findByText('¡Hola, Profesor!')).toBeInTheDocument();
  });

  it('shows legacy hint when feature flag is disabled', async () => {
    renderTeacherDashboard();

    expect(
      await screen.findByText(
        'No tienes políticas asignadas. Pide a un administrador que te asigne una.'
      )
    ).toBeInTheDocument();
  });

  it('shows create-policy hint when feature flag is enabled', async () => {
    localStorage.setItem('openpath_teacher_groups_enabled', '1');
    renderTeacherDashboard();

    expect(
      await screen.findByText('No tienes políticas. Ve a "Mis Políticas" para crear una.')
    ).toBeInTheDocument();
  });

  it('shows retry UI when classroom loading fails and triggers a refetch', async () => {
    mockClassroomsListQuery.mockRejectedValueOnce(new Error('boom'));
    mockClassroomsListQuery.mockResolvedValueOnce([]);

    renderTeacherDashboard();

    expect(await screen.findByText('Error al cargar aulas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(mockClassroomsListQuery).toHaveBeenCalledTimes(2);
    });
    expect(mockReportError).toHaveBeenCalledWith('Failed to fetch classrooms:', expect.any(Error));
  });
});
