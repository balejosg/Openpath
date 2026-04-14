export type AuthView = 'login' | 'register' | 'forgot-password' | 'reset-password';

export function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed.length === 0 ? '/' : trimmed;
}

export function getTabFromPathname(pathname: string): string {
  const normalized = normalizePathname(pathname);

  if (normalized === '/' || normalized.startsWith('/dashboard')) return 'dashboard';
  if (normalized.startsWith('/aulas')) return 'classrooms';
  if (normalized.startsWith('/politicas') || normalized.startsWith('/grupos')) return 'groups';
  if (normalized.startsWith('/reglas')) return 'rules';
  if (normalized.startsWith('/usuarios')) return 'users';
  if (normalized.startsWith('/dominios')) return 'domains';
  if (normalized.startsWith('/configuracion') || normalized.startsWith('/settings'))
    return 'settings';

  return 'dashboard';
}

export function getAuthViewFromPathname(pathname: string): AuthView {
  const normalized = normalizePathname(pathname);

  if (normalized.startsWith('/register')) return 'register';
  if (normalized.startsWith('/forgot-password')) return 'forgot-password';
  if (normalized.startsWith('/reset-password')) return 'reset-password';
  if (normalized.startsWith('/login') || normalized === '/') return 'login';

  return 'login';
}

export function isAuthPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return (
    normalized === '/' ||
    normalized.startsWith('/login') ||
    normalized.startsWith('/register') ||
    normalized.startsWith('/forgot-password') ||
    normalized.startsWith('/reset-password')
  );
}

export function getPathForTab(tab: string): string {
  switch (tab) {
    case 'dashboard':
      return '/';
    case 'classrooms':
      return '/aulas';
    case 'groups':
      return '/politicas';
    case 'rules':
      return '/reglas';
    case 'users':
      return '/usuarios';
    case 'domains':
      return '/dominios';
    case 'settings':
      return '/configuracion';
    default:
      return '/';
  }
}

export function getPathForAuthView(view: AuthView): string {
  switch (view) {
    case 'register':
      return '/register';
    case 'forgot-password':
      return '/forgot-password';
    case 'reset-password':
      return '/reset-password';
    case 'login':
    default:
      return '/login';
  }
}
