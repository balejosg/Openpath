import React, { useMemo, useState } from 'react';

import OneOffScheduleFormModal from '../components/OneOffScheduleFormModal';
import ScheduleFormModal from '../components/ScheduleFormModal';
import { TeacherActiveClassroomsCard } from '../components/teacher/TeacherActiveClassroomsCard';
import { TeacherClassroomControlCard } from '../components/teacher/TeacherClassroomControlCard';
import { TeacherDashboardCalendar } from '../components/teacher/TeacherDashboardCalendar';
import { TeacherDashboardHero } from '../components/teacher/TeacherDashboardHero';
import { TeacherScheduleDetailPanel } from '../components/teacher/TeacherScheduleDetailPanel';
import { TeacherTodayFocusPanel } from '../components/teacher/TeacherTodayFocusPanel';
import {
  buildTeacherScheduleEntries,
  getTeacherScheduleFocus,
  getWeekMonday,
  type TeacherScheduleEntry,
} from '../components/teacher/teacher-schedule-model';
import { DangerConfirmDialog, ConfirmDialog } from '../components/ui/ConfirmDialog';
import { resolveTrpcErrorMessage } from '../lib/error-utils';
import { reportError } from '../lib/reportError';
import { trpc } from '../lib/trpc';
import type { GroupLike } from '../components/groups/GroupLabel';
import type { OneOffScheduleWithPermissions, ScheduleWithPermissions } from '../types';
import { useTeacherDashboardViewModel } from '../hooks/useTeacherDashboardViewModel';

interface TeacherDashboardProps {
  onNavigateToRules?: (group: { id: string; name: string }) => void;
}

function formatScheduleError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : '';
  return resolveTrpcErrorMessage(err, {
    conflict: 'Ese tramo horario ya está reservado',
    fallback: raw || fallback,
  });
}

function resolveGroupName(entry: TeacherScheduleEntry): string {
  return entry.schedule.groupDisplayName ?? entry.groupName;
}

function toEditableGroups(groups: readonly GroupLike[]): GroupLike[] {
  return groups.map((group) => ({
    ...group,
    enabled: group.enabled ?? true,
  }));
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onNavigateToRules }) => {
  const viewModel = useTeacherDashboardViewModel();
  const [weekMonday, setWeekMonday] = useState(() => getWeekMonday(new Date()));
  const [selectedEntry, setSelectedEntry] = useState<TeacherScheduleEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<TeacherScheduleEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<TeacherScheduleEntry | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  const entries = useMemo(
    () =>
      buildTeacherScheduleEntries({
        weeklySchedules: viewModel.weeklySchedules,
        oneOffSchedules: viewModel.oneOffSchedules,
        classroomNameMap: viewModel.classroomNameMap,
        groupNameMap: viewModel.groupDisplayNameMap,
        weekMonday,
      }),
    [
      viewModel.weeklySchedules,
      viewModel.oneOffSchedules,
      viewModel.classroomNameMap,
      viewModel.groupDisplayNameMap,
      weekMonday,
    ]
  );
  const focus = useMemo(() => getTeacherScheduleFocus(entries, new Date()), [entries]);
  const editableGroups = useMemo(() => toEditableGroups(viewModel.groups), [viewModel.groups]);

  const clearTransientState = () => {
    setScheduleError('');
  };

  const refreshDashboard = async () => {
    await Promise.all([viewModel.refetchClassrooms(), viewModel.refetchMySchedules()]);
  };

  const handleOpenRules = (entry: TeacherScheduleEntry) => {
    onNavigateToRules?.({
      id: entry.schedule.groupId,
      name: resolveGroupName(entry),
    });
  };

  const handleOpenClassroom = (entry: TeacherScheduleEntry) => {
    setSelectedEntry(entry);
  };

  const handleTakeControl = async (entry: TeacherScheduleEntry) => {
    setScheduleSaving(true);
    setScheduleError('');
    try {
      await trpc.classrooms.setActiveGroup.mutate({
        id: entry.classroomId,
        groupId: entry.schedule.groupId,
      });
      await refreshDashboard();
    } catch (err) {
      reportError('Failed to apply active group:', err);
      setScheduleError('Error al aplicar el grupo al aula');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleReleaseClassroom = async (entry: TeacherScheduleEntry) => {
    setScheduleSaving(true);
    setScheduleError('');
    try {
      await trpc.classrooms.setActiveGroup.mutate({
        id: entry.classroomId,
        groupId: null,
      });
      await refreshDashboard();
    } catch (err) {
      reportError('Failed to release classroom:', err);
      setScheduleError('Error al aplicar el grupo al aula');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleEditSchedule = (entry: TeacherScheduleEntry) => {
    clearTransientState();
    setEditingEntry(entry);
  };

  const handleDeleteSchedule = (entry: TeacherScheduleEntry) => {
    clearTransientState();
    setDeleteEntry(entry);
  };

  const closeEditSchedule = () => {
    if (scheduleSaving) return;
    setEditingEntry(null);
    setScheduleError('');
  };

  const closeDeleteSchedule = () => {
    if (scheduleSaving) return;
    setDeleteEntry(null);
    setScheduleError('');
  };

  const handleSaveWeeklySchedule = async (data: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    groupId: string;
  }) => {
    if (editingEntry?.kind !== 'weekly') return;

    setScheduleSaving(true);
    setScheduleError('');
    try {
      await trpc.schedules.update.mutate({
        id: editingEntry.schedule.id,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        groupId: data.groupId,
      });
      await refreshDashboard();
      setEditingEntry(null);
    } catch (err) {
      reportError('Failed to save schedule:', err);
      setScheduleError(formatScheduleError(err, 'Error al guardar horario'));
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleSaveOneOffSchedule = async (data: {
    startAt: string;
    endAt: string;
    groupId: string;
  }) => {
    if (editingEntry?.kind !== 'one_off') return;

    setScheduleSaving(true);
    setScheduleError('');
    try {
      await trpc.schedules.updateOneOff.mutate({
        id: editingEntry.schedule.id,
        startAt: data.startAt,
        endAt: data.endAt,
        groupId: data.groupId,
      });
      await refreshDashboard();
      setEditingEntry(null);
    } catch (err) {
      reportError('Failed to save one-off schedule:', err);
      setScheduleError(formatScheduleError(err, 'Error al guardar horario'));
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleConfirmDeleteSchedule = async () => {
    if (!deleteEntry) return;

    setScheduleSaving(true);
    setScheduleError('');
    try {
      await trpc.schedules.delete.mutate({ id: deleteEntry.schedule.id });
      await refreshDashboard();
      setDeleteEntry(null);
      setSelectedEntry(null);
    } catch (err) {
      reportError('Failed to delete schedule:', err);
      setScheduleError(formatScheduleError(err, 'Error al eliminar horario'));
    } finally {
      setScheduleSaving(false);
    }
  };

  const currentWeeklySchedule =
    editingEntry?.kind === 'weekly' ? (editingEntry.schedule as ScheduleWithPermissions) : null;
  const currentOneOffSchedule =
    editingEntry?.kind === 'one_off'
      ? (editingEntry.schedule as OneOffScheduleWithPermissions)
      : null;

  return (
    <div className="space-y-6">
      <TeacherDashboardHero
        classroomsLoading={viewModel.classroomsLoading}
        activeCount={viewModel.activeClassrooms.length}
        classroomsError={viewModel.classroomsError}
        onRetry={() => void viewModel.refetchClassrooms()}
      />

      <TeacherTodayFocusPanel
        focus={focus}
        loading={viewModel.schedulesLoading}
        error={viewModel.schedulesError}
        onRetry={() => void viewModel.refetchMySchedules()}
        onOpenClassroom={handleOpenClassroom}
        onOpenRules={handleOpenRules}
        onTakeControl={(entry) => void handleTakeControl(entry)}
        onReleaseClassroom={(entry) => void handleReleaseClassroom(entry)}
        onSelectEntry={setSelectedEntry}
      />

      <TeacherDashboardCalendar
        entries={entries}
        loading={viewModel.schedulesLoading}
        error={viewModel.schedulesError}
        weekMonday={weekMonday}
        onPrevWeek={() =>
          setWeekMonday((current) => {
            const next = new Date(current);
            next.setDate(next.getDate() - 7);
            return getWeekMonday(next);
          })
        }
        onNextWeek={() =>
          setWeekMonday((current) => {
            const next = new Date(current);
            next.setDate(next.getDate() + 7);
            return getWeekMonday(next);
          })
        }
        onToday={() => setWeekMonday(getWeekMonday(new Date()))}
        onRetry={() => void viewModel.refetchMySchedules()}
        onSelectEntry={setSelectedEntry}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TeacherClassroomControlCard viewModel={viewModel} onNavigateToRules={onNavigateToRules} />
        <TeacherActiveClassroomsCard viewModel={viewModel} />
      </div>

      <TeacherScheduleDetailPanel
        entry={selectedEntry}
        isSaving={scheduleSaving}
        error={scheduleError}
        onClose={() => {
          setSelectedEntry(null);
          setScheduleError('');
        }}
        onOpenClassroom={handleOpenClassroom}
        onOpenRules={handleOpenRules}
        onTakeControl={(entry) => void handleTakeControl(entry)}
        onReleaseClassroom={(entry) => void handleReleaseClassroom(entry)}
        onEditSchedule={handleEditSchedule}
        onDeleteSchedule={handleDeleteSchedule}
      />

      <ConfirmDialog
        isOpen={viewModel.controlConfirm !== null}
        title="Confirmar cambio"
        confirmLabel={viewModel.controlConfirm?.nextGroupId ? 'Reemplazar' : 'Liberar Aula'}
        cancelLabel="Cancelar"
        isLoading={viewModel.controlLoading}
        errorMessage={viewModel.controlConfirm ? (viewModel.controlError ?? undefined) : undefined}
        onClose={() => {
          viewModel.setControlConfirm(null);
          viewModel.setControlError(null);
        }}
        onConfirm={async () => {
          if (!viewModel.controlConfirm) return;
          const ok = await viewModel.applyControlChange(
            viewModel.controlConfirm.classroomId,
            viewModel.controlConfirm.nextGroupId
          );
          if (!ok) return;
          viewModel.setControlConfirm(null);
        }}
      >
        <p className="text-sm text-slate-600">
          El aula ya tiene una política aplicada manualmente (
          <strong>{viewModel.controlConfirm?.currentName}</strong>).
        </p>
        <p className="text-sm text-slate-600">
          {viewModel.controlConfirm?.nextGroupId ? 'Reemplazar por' : 'Liberar (sin grupo)'}:{' '}
          <strong>{viewModel.controlConfirm?.nextName}</strong>?
        </p>
      </ConfirmDialog>

      {currentWeeklySchedule ? (
        <ScheduleFormModal
          key={currentWeeklySchedule.id}
          schedule={currentWeeklySchedule}
          groups={editableGroups}
          saving={scheduleSaving}
          error={scheduleError}
          onSave={(data) => void handleSaveWeeklySchedule(data)}
          onClose={closeEditSchedule}
        />
      ) : null}

      {currentOneOffSchedule ? (
        <OneOffScheduleFormModal
          key={currentOneOffSchedule.id}
          schedule={currentOneOffSchedule}
          groups={editableGroups}
          saving={scheduleSaving}
          error={scheduleError}
          onSave={(data) => void handleSaveOneOffSchedule(data)}
          onClose={closeEditSchedule}
        />
      ) : null}

      {deleteEntry ? (
        <DangerConfirmDialog
          isOpen
          title="Eliminar horario"
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          isLoading={scheduleSaving}
          errorMessage={scheduleError || undefined}
          onClose={closeDeleteSchedule}
          onConfirm={() => void handleConfirmDeleteSchedule()}
        >
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              ¿Eliminar <strong>{deleteEntry.label}</strong>?
            </p>
            <p>Tipo: {deleteEntry.kind === 'one_off' ? 'Puntual' : 'Semanal'}</p>
            <p>
              Horario: {deleteEntry.startTime} - {deleteEntry.endTime}
            </p>
          </div>
        </DangerConfirmDialog>
      ) : null}
    </div>
  );
};

export default TeacherDashboard;
