import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import Groups from '../Groups';
import { renderWithQueryClient } from '../../test-utils/query';

let queryClient: ReturnType<typeof renderWithQueryClient>['queryClient'] | null = null;

function renderGroups(props?: Partial<React.ComponentProps<typeof Groups>>) {
  const rendered = renderWithQueryClient(
    <Groups onNavigateToRules={props?.onNavigateToRules ?? vi.fn()} />
  );
  queryClient = rendered.queryClient;
  return rendered;
}

afterEach(() => {
  queryClient?.clear();
  queryClient = null;
});

const mockListGroups = vi.fn();
const mockCreateGroup = vi.fn();
const mockUpdateGroup = vi.fn();
const mockLibraryListGroups = vi.fn();
const mockCloneGroup = vi.fn();
const isAdminMock = vi.fn(() => true);
const isTeacherMock = vi.fn(() => false);
const teacherFlagMock = vi.fn(() => false);

vi.mock('../../lib/trpc', () => ({
  trpc: {
    groups: {
      list: { query: (): unknown => mockListGroups() },
      create: { mutate: (input: unknown): unknown => mockCreateGroup(input) },
      update: { mutate: (input: unknown): unknown => mockUpdateGroup(input) },
      libraryList: { query: (): unknown => mockLibraryListGroups() },
      clone: { mutate: (input: unknown): unknown => mockCloneGroup(input) },
    },
  },
}));

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({
    ToastContainer: () => null,
  }),
}));

vi.mock('../../lib/auth', () => ({
  isAdmin: () => isAdminMock(),
  isTeacher: () => isTeacherMock(),
  isTeacherGroupsFeatureEnabled: () => teacherFlagMock(),
}));

describe('Groups view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminMock.mockReturnValue(true);
    isTeacherMock.mockReturnValue(false);
    teacherFlagMock.mockReturnValue(false);
    mockCreateGroup.mockResolvedValue({ id: 'group-2' });
    mockListGroups.mockResolvedValue([
      {
        id: 'group-1',
        name: 'grupo-1',
        displayName: 'Grupo 1',
        whitelistCount: 2,
        blockedSubdomainCount: 1,
        blockedPathCount: 0,
        enabled: true,
        visibility: 'private',
      },
    ]);
    mockLibraryListGroups.mockResolvedValue([]);
    mockCloneGroup.mockResolvedValue({ id: 'clone-1', name: 'biblioteca-copia' });
  });

  it('shows actionable inline feedback when group configuration save fails with 400', async () => {
    mockUpdateGroup.mockRejectedValueOnce({ data: { code: 'BAD_REQUEST' } });

    renderGroups();

    await screen.findByText('grupo-1');
    fireEvent.click(screen.getByRole('button', { name: /configurar/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => {
      expect(mockUpdateGroup).toHaveBeenCalled();
    });

    expect(
      await screen.findByText('Revisa los datos del grupo antes de guardar.')
    ).toBeInTheDocument();
  });

  it('does not show create CTA for teacher when feature flag is disabled', async () => {
    isAdminMock.mockReturnValue(false);
    isTeacherMock.mockReturnValue(true);
    teacherFlagMock.mockReturnValue(false);
    mockListGroups.mockResolvedValueOnce([]);

    renderGroups();

    expect(
      await screen.findByText(
        'Todavía no tienes políticas asignadas. Pide a un administrador que te asigne una.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+\s*nuevo\s*grupo/i })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /\+\s*crear\s*mi\s*primera\s*política/i })
    ).toBeNull();
  });

  it('shows create CTA + updated empty-state for teacher when feature flag is enabled', async () => {
    isAdminMock.mockReturnValue(false);
    isTeacherMock.mockReturnValue(true);
    teacherFlagMock.mockReturnValue(true);
    mockListGroups.mockResolvedValueOnce([]);

    renderGroups();

    expect(
      await screen.findByText('Todavía no tienes políticas. Crea una nueva para empezar.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+\s*nuevo\s*grupo/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /\+\s*crear\s*mi\s*primera\s*política/i })
    ).toBeInTheDocument();
  });

  it('validates required fields before creating a new group', async () => {
    renderGroups();

    await screen.findByText('grupo-1');
    fireEvent.click(screen.getByRole('button', { name: /\+\s*nuevo\s*grupo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear Grupo' }));

    expect(await screen.findByText('El nombre del grupo es obligatorio')).toBeInTheDocument();
    expect(mockCreateGroup).not.toHaveBeenCalled();
  });

  it('creates a new group, refetches, and closes the modal', async () => {
    renderGroups();

    await screen.findByText('grupo-1');
    fireEvent.click(screen.getByRole('button', { name: /\+\s*nuevo\s*grupo/i }));

    fireEvent.change(screen.getByPlaceholderText('Ej: grupo-primaria'), {
      target: { value: 'grupo-primaria' },
    });
    fireEvent.change(screen.getByPlaceholderText('Descripción del grupo...'), {
      target: { value: 'Primaria A' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Grupo' }));

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith({
        name: 'grupo-primaria',
        displayName: 'Primaria A',
      });
    });
    expect(mockListGroups).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(screen.queryByText('Nuevo Grupo')).not.toBeInTheDocument();
    });
  });

  it('clones a library group and routes the user to its rules', async () => {
    const onNavigateToRules = vi.fn();
    mockLibraryListGroups.mockResolvedValueOnce([
      {
        id: 'library-1',
        name: 'biblioteca',
        displayName: 'Biblioteca',
        whitelistCount: 3,
        blockedSubdomainCount: 0,
        blockedPathCount: 1,
        enabled: true,
        visibility: 'instance_public',
      },
    ]);

    renderGroups({ onNavigateToRules });

    await screen.findByText('grupo-1');
    fireEvent.click(screen.getByRole('button', { name: 'Biblioteca' }));

    const cloneButton = await screen.findByRole('button', { name: /clonar/i });
    fireEvent.click(cloneButton);

    expect(await screen.findByText('Clonar: Biblioteca')).toBeInTheDocument();
    const cloneButtons = screen.getAllByRole('button', { name: 'Clonar' });
    const confirmCloneButton = cloneButtons.at(-1);
    expect(confirmCloneButton).toBeDefined();
    fireEvent.click(confirmCloneButton as HTMLButtonElement);

    await waitFor(() => {
      expect(mockCloneGroup).toHaveBeenCalledWith({
        sourceGroupId: 'library-1',
        name: 'biblioteca-copia',
        displayName: 'Biblioteca Copia',
      });
    });
    expect(onNavigateToRules).toHaveBeenCalledWith({
      id: 'clone-1',
      name: 'Biblioteca Copia',
    });
  });
});
