import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DomainRequestsDialogsModel } from '../../../hooks/useDomainRequestsViewModel';
import { DomainRequestsDialogs } from '../DomainRequestsDialogs';

const request = {
  domain: 'example.com',
  machineHostname: 'host-1',
  groupName: 'Grupo 1',
} as const;

function buildModel(
  overrides: Partial<DomainRequestsDialogsModel> = {}
): DomainRequestsDialogsModel {
  return {
    bulkConfirm: null,
    approveModal: { open: false, request: null },
    rejectModal: { open: false, request: null },
    deleteModal: { open: false, request: null },
    rejectionReason: '',
    actionsLoading: false,
    onBulkConfirmClose: vi.fn(),
    onBulkApproveConfirm: vi.fn(),
    onBulkRejectConfirm: vi.fn(),
    onApproveClose: vi.fn(),
    onApproveConfirm: vi.fn(),
    onRejectClose: vi.fn(),
    onRejectConfirm: vi.fn(),
    onRejectReasonChange: vi.fn(),
    onDeleteClose: vi.fn(),
    onDeleteConfirm: vi.fn(),
    ...overrides,
  };
}

describe('DomainRequestsDialogs', () => {
  it('confirms bulk approvals and propagates single-request rejection input', () => {
    const onBulkApproveConfirm = vi.fn();
    const onRejectReasonChange = vi.fn();

    render(
      <DomainRequestsDialogs
        model={buildModel({
          bulkConfirm: { mode: 'approve', requestIds: ['req-1', 'req-2'] },
          rejectModal: { open: true, request },
          onBulkApproveConfirm,
          onRejectReasonChange,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    fireEvent.change(screen.getByPlaceholderText('Explica por qué se rechaza esta solicitud...'), {
      target: { value: 'No aplica' },
    });

    expect(onBulkApproveConfirm).toHaveBeenCalledWith(['req-1', 'req-2']);
    expect(onRejectReasonChange).toHaveBeenCalledWith('No aplica');
  });

  it('disables empty bulk approvals and closes the confirmation dialog', () => {
    const onBulkApproveConfirm = vi.fn();
    const onBulkConfirmClose = vi.fn();

    render(
      <DomainRequestsDialogs
        model={buildModel({
          bulkConfirm: { mode: 'approve', requestIds: [] },
          onBulkApproveConfirm,
          onBulkConfirmClose,
        })}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Aprobar solicitudes' });
    expect(within(dialog).getByRole('button', { name: 'Aprobar' })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(onBulkApproveConfirm).not.toHaveBeenCalled();
    expect(onBulkConfirmClose).toHaveBeenCalled();
  });

  it('confirms bulk rejections with and without a reason', () => {
    const onBulkRejectConfirm = vi.fn();
    const { rerender } = render(
      <DomainRequestsDialogs
        model={buildModel({
          bulkConfirm: {
            mode: 'reject',
            requestIds: ['req-1', 'req-2'],
            rejectReason: 'Duplicado',
          },
          onBulkRejectConfirm,
        })}
      />
    );

    let dialog = screen.getByRole('dialog', { name: 'Rechazar solicitudes' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }));

    expect(screen.getByText('Duplicado')).toBeInTheDocument();
    expect(onBulkRejectConfirm).toHaveBeenCalledWith(['req-1', 'req-2'], 'Duplicado');

    rerender(
      <DomainRequestsDialogs
        model={buildModel({
          bulkConfirm: { mode: 'reject', requestIds: ['req-3'] },
          onBulkRejectConfirm,
        })}
      />
    );

    dialog = screen.getByRole('dialog', { name: 'Rechazar solicitudes' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }));

    expect(screen.getByText('Motivo (opcional): (sin motivo)')).toBeInTheDocument();
    expect(onBulkRejectConfirm).toHaveBeenLastCalledWith(['req-3'], undefined);
  });

  it('confirms single approve and delete dialogs', () => {
    const onApproveConfirm = vi.fn();
    const onDeleteConfirm = vi.fn();
    const onDeleteClose = vi.fn();

    render(
      <DomainRequestsDialogs
        model={buildModel({
          approveModal: { open: true, request },
          deleteModal: { open: true, request },
          onApproveConfirm,
          onDeleteConfirm,
          onDeleteClose,
        })}
      />
    );

    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Aprobar Solicitud' })).getByRole('button', {
        name: 'Aprobar',
      })
    );
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Eliminar Solicitud' })).getByRole('button', {
        name: 'Eliminar',
      })
    );
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Eliminar Solicitud' })).getByRole('button', {
        name: 'Cancelar',
      })
    );

    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument();
    expect(onApproveConfirm).toHaveBeenCalled();
    expect(onDeleteConfirm).toHaveBeenCalled();
    expect(onDeleteClose).toHaveBeenCalled();
  });
});
