import type { FC } from 'react';
import Dashboard from './views/Dashboard';
import TeacherDashboard from './views/TeacherDashboard';
import Classrooms from './views/Classrooms';
import Groups from './views/Groups';
import UsersView from './views/Users';
import Settings from './views/Settings';
import DomainRequests from './views/DomainRequests';
import RulesManager from './views/RulesManager';

export interface SelectedGroup {
  id: string;
  name: string;
  readOnly?: boolean;
}

interface AppMainContentProps {
  activeTab: string;
  admin: boolean;
  pendingSelectedClassroomId: string | null;
  selectedGroup: SelectedGroup | null;
  onBackFromRules: () => void;
  onInitialSelectedClassroomIdConsumed: () => void;
  onNavigateToClassroom: (classroom: { id: string; name: string }) => void;
  onNavigateToRules: (group: SelectedGroup) => void;
}

export function getTitleForTab(
  activeTab: string,
  admin: boolean,
  selectedGroup: SelectedGroup | null
): string {
  switch (activeTab) {
    case 'dashboard':
      return admin ? 'Vista General' : 'Mi Panel';
    case 'classrooms':
      return admin ? 'Gestión de Aulas' : 'Aulas';
    case 'groups':
      return admin ? 'Grupos y Políticas' : 'Mis Políticas';
    case 'rules':
      return selectedGroup ? `Reglas: ${selectedGroup.name}` : 'Gestión de Reglas';
    case 'users':
      return admin ? 'Administración de Usuarios' : 'Mi Panel';
    case 'domains':
      return admin ? 'Solicitudes de Acceso' : 'Mi Panel';
    case 'settings':
      return 'Configuración';
    default:
      return 'OpenPath';
  }
}

const AppMainContent: FC<AppMainContentProps> = ({
  activeTab,
  admin,
  pendingSelectedClassroomId,
  selectedGroup,
  onBackFromRules,
  onInitialSelectedClassroomIdConsumed,
  onNavigateToClassroom,
  onNavigateToRules,
}) => {
  switch (activeTab) {
    case 'dashboard':
      return admin ? (
        <Dashboard
          onNavigateToRules={onNavigateToRules}
          onNavigateToClassroom={onNavigateToClassroom}
        />
      ) : (
        <TeacherDashboard onNavigateToRules={onNavigateToRules} />
      );
    case 'classrooms':
      return (
        <Classrooms
          initialSelectedClassroomId={pendingSelectedClassroomId}
          onInitialSelectedClassroomIdConsumed={onInitialSelectedClassroomIdConsumed}
        />
      );
    case 'groups':
      return <Groups onNavigateToRules={onNavigateToRules} />;
    case 'rules':
      return selectedGroup ? (
        <RulesManager
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
          readOnly={selectedGroup.readOnly}
          onBack={onBackFromRules}
        />
      ) : (
        <Groups onNavigateToRules={onNavigateToRules} />
      );
    case 'users':
      return admin ? <UsersView /> : <TeacherDashboard onNavigateToRules={onNavigateToRules} />;
    case 'settings':
      return <Settings />;
    case 'domains':
      return admin ? (
        <DomainRequests />
      ) : (
        <TeacherDashboard onNavigateToRules={onNavigateToRules} />
      );
    default:
      return admin ? (
        <Dashboard
          onNavigateToRules={onNavigateToRules}
          onNavigateToClassroom={onNavigateToClassroom}
        />
      ) : (
        <TeacherDashboard onNavigateToRules={onNavigateToRules} />
      );
  }
};

export default AppMainContent;
