import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import TeacherDashboard from '../TeacherDashboard';
import { renderWithQueryClient } from '../../test-utils/query';

let queryClient: ReturnType<typeof renderWithQueryClient>['queryClient'] | null = null;

function renderTeacherDashboard() {
  const rendered = renderWithQueryClient(<TeacherDashboard />);
  queryClient = rendered.queryClient;
  return rendered;
}

afterEach(() => {
  queryClient?.clear();
  queryClient = null;
});

vi.mock('../../lib/trpc', () => ({
  trpc: {
    classrooms: {
      list: { query: vi.fn().mockResolvedValue([]) },
      setActiveGroup: { mutate: vi.fn() },
    },
    groups: {
      list: { query: vi.fn().mockResolvedValue([]) },
    },
  },
}));

describe('TeacherDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the teacher dashboard greeting', async () => {
    renderTeacherDashboard();
    await waitFor(() => {
      expect(screen.getByText('¡Hola, Profesor!')).toBeInTheDocument();
    });
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
});
