import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Classroom, ClassroomExemption } from '../../../types';
import ClassroomMachinesCard from '../ClassroomMachinesCard';

function buildClassroom(overrides: Partial<Classroom> = {}): Classroom {
  return {
    id: 'classroom-1',
    name: 'Aula 1',
    displayName: 'Aula 1',
    defaultGroupId: 'group-default',
    computerCount: 2,
    activeGroup: null,
    currentGroupId: 'group-default',
    currentGroupDisplayName: 'Grupo Default',
    currentGroupSource: 'default',
    status: 'operational',
    onlineMachineCount: 1,
    machines: [
      {
        id: 'machine-1',
        hostname: 'pc-01',
        lastSeen: '2026-03-06T08:00:00.000Z',
        status: 'online',
      },
      {
        id: 'machine-2',
        hostname: 'pc-02',
        lastSeen: null,
        status: 'offline',
      },
    ],
    ...overrides,
  };
}

function buildExemption(): ClassroomExemption {
  return {
    id: 'exemption-1',
    machineId: 'machine-1',
    machineHostname: 'pc-01',
    classroomId: 'classroom-1',
    scheduleId: 'schedule-1',
    createdBy: 'teacher-1',
    createdAt: '2026-03-06T08:00:00.000Z',
    expiresAt: '2026-03-06T11:00:00.000Z',
  };
}

function buildProps(overrides: Partial<React.ComponentProps<typeof ClassroomMachinesCard>> = {}) {
  return {
    admin: true,
    classroom: buildClassroom(),
    hasActiveSchedule: true,
    exemptionByMachineId: new Map([['machine-1', buildExemption()]]),
    exemptionMutating: {},
    exemptionsError: null,
    loadingExemptions: false,
    enrollModalLoadingToken: false,
    onOpenEnrollModal: vi.fn(),
    onCreateExemption: vi.fn(),
    onDeleteExemption: vi.fn(),
    ...overrides,
  };
}

describe('ClassroomMachinesCard', () => {
  it('renders exemptions and forwards machine actions', () => {
    const props = buildProps();
    render(<ClassroomMachinesCard {...props} />);

    expect(screen.getByText(/Sin restricción/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /instalar equipos/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Restringir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Liberar' }));

    expect(props.onOpenEnrollModal).toHaveBeenCalledTimes(1);
    expect(props.onDeleteExemption).toHaveBeenCalledWith('machine-1');
    expect(props.onCreateExemption).toHaveBeenCalledWith('machine-2');
  });

  it('renders empty and no-active-schedule states without release controls', () => {
    render(
      <ClassroomMachinesCard
        {...buildProps({
          classroom: buildClassroom({
            computerCount: 0,
            onlineMachineCount: 0,
            machines: [],
          }),
          hasActiveSchedule: false,
        })}
      />
    );

    expect(screen.getByText('Sin máquinas activas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Liberar' })).not.toBeInTheDocument();
  });
});
