import type { FC } from 'react';
import Login from './views/Login';
import Register from './views/Register';
import ForgotPassword from './views/ForgotPassword';
import ResetPassword from './views/ResetPassword';
import type { AuthView } from './app-navigation';

interface AppAuthContentProps {
  authView: AuthView;
  onLogin: () => void;
  onRegister: () => void;
  onSelectAuthView: (view: AuthView) => void;
}

const AppAuthContent: FC<AppAuthContentProps> = ({
  authView,
  onLogin,
  onRegister,
  onSelectAuthView,
}) => {
  switch (authView) {
    case 'register':
      return (
        <Register onRegister={onRegister} onNavigateToLogin={() => onSelectAuthView('login')} />
      );
    case 'forgot-password':
      return (
        <ForgotPassword
          onNavigateToLogin={() => onSelectAuthView('login')}
          onNavigateToReset={() => onSelectAuthView('reset-password')}
        />
      );
    case 'reset-password':
      return (
        <ResetPassword
          onNavigateToLogin={() => onSelectAuthView('login')}
          onNavigateToForgot={() => onSelectAuthView('forgot-password')}
        />
      );
    default:
      return (
        <Login
          onLogin={onLogin}
          onNavigateToRegister={() => onSelectAuthView('register')}
          onNavigateToForgot={() => onSelectAuthView('forgot-password')}
        />
      );
  }
};

export default AppAuthContent;
