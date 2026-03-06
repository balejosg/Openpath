import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Classroom } from '../../../types';
import ClassroomConfigCard from '../ClassroomConfigCard';

function buildClassroom(overrides: Partial<Classroom> = {}): Classroom {
  return {
    id: 'classroom-1',
    name: 'Aula 1',
    displayName: 'Aula 1',
    defaultGroupId: 'group-default',
    defaultGroupDisplayName: 'Grupo Default',
    computerCount: 2,
    activeGroup: null,
    currentGroupId: 'group-default',
    currentGroupDisplayName: 'Grupo Default',
    currentGroupSource: 'default',
    status: 'operational',
    onlineMachineCount: 1,
    machines: [],
    ...overrides,
  };
}

function buildProps(overrides: Partial<React.ComponentProps<typeof ClassroomConfigCard>> = {}) {
  return {
    admin: true,
    allowedGroups: [
      { id: 'group-default', name: 'default', displayName: 'Grupo Default', enabled: true },
      { id: 'group-alt', name: 'alt', displayName: 'Grupo Alterno', enabled: true },
    ],
    classroomConfigError: '',
    activeGroupSelectValue: '',
    defaultGroupSelectValue: 'group-default',
    classroom: buildClassroom(),
    classroomSource: 'default' as const,
    groupById: new Map([
      ['group-default', { id: 'group-default', name: 'default', displayName: 'Grupo Default' }],
      ['group-alt', { id: 'group-alt', name: 'alt', displayName: 'Grupo Alterno' }],
    ]),
    onOpenDeleteDialog: vi.fn(),
    onRequestActiveGroupChange: vi.fn(),
    onDefaultGroupChange: vi.fn(),
    ...overrides,
  };
}

describe('ClassroomConfigCard', () => {
  it('renders classroom metadata and forwards delete actions', () => {
    const props = buildProps();
    render(<ClassroomConfigCard {...props} />);

    expect(screen.getByText('Configuración y estado del aula')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, node) => node?.textContent === 'Actualmente usando Grupo Default por defecto'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('1/2 en línea')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /eliminar aula/i }));

    expect(props.onOpenDeleteDialog).toHaveBeenCalledTimes(1);
  });

  it('shows degraded status and inline config errors', () => {
    render(
      <ClassroomConfigCard
        {...buildProps({
          classroom: buildClassroom({ status: 'degraded' }),
          classroomConfigError: 'No puedes dejar el aula sin grupo por defecto.',
        })}
      />
    );

    expect(screen.getByText('Degradado')).toBeInTheDocument();
    expect(screen.getByText('No puedes dejar el aula sin grupo por defecto.')).toBeInTheDocument();
  });
});
