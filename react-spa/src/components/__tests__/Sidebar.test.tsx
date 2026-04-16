import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar';
import { logout } from '../../lib/auth';

const mockIsAdmin = vi.fn<() => boolean>();

vi.mock('../../lib/auth', () => ({
  logout: vi.fn(),
  isAdmin: () => mockIsAdmin(),
}));

describe('Sidebar', () => {
  const setActiveTab = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
  });

  it('marks selected navigation item as current page', () => {
    render(<Sidebar activeTab="dashboard" setActiveTab={setActiveTab} isOpen />);

    expect(screen.getByRole('button', { name: 'Panel de Control' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('maps rules view to group navigation active state', () => {
    render(<Sidebar activeTab="rules" setActiveTab={setActiveTab} isOpen />);

    expect(screen.getByRole('button', { name: 'Políticas de Grupo' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('marks settings button as current page when active', () => {
    render(<Sidebar activeTab="settings" setActiveTab={setActiveTab} isOpen />);

    expect(screen.getByRole('button', { name: 'Configuración' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('calls setActiveTab for navigation buttons', () => {
    render(<Sidebar activeTab="dashboard" setActiveTab={setActiveTab} isOpen />);

    fireEvent.click(screen.getByRole('button', { name: 'Aulas Seguras' }));
    expect(setActiveTab).toHaveBeenCalledWith('classrooms');
  });

  it('calls logout when close session is clicked', () => {
    render(<Sidebar activeTab="dashboard" setActiveTab={setActiveTab} isOpen />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Sesión' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('keeps domain requests hidden for non-admin users by default', () => {
    mockIsAdmin.mockReturnValue(false);

    render(<Sidebar activeTab="dashboard" setActiveTab={setActiveTab} isOpen />);

    expect(screen.queryByRole('button', { name: 'Control de Dominios' })).not.toBeInTheDocument();
  });

  it('can expose domain requests to non-admin users through an explicit prop', () => {
    mockIsAdmin.mockReturnValue(false);

    render(
      <Sidebar
        activeTab="domains"
        setActiveTab={setActiveTab}
        isOpen
        allowDomainRequestsForNonAdmins
      />
    );

    const domainsButton = screen.getByRole('button', { name: 'Control de Dominios' });
    expect(domainsButton).toHaveAttribute('aria-current', 'page');

    fireEvent.click(domainsButton);
    expect(setActiveTab).toHaveBeenCalledWith('domains');
  });
});
