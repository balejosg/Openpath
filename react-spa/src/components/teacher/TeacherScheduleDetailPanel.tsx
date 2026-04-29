import React from 'react';

import { Modal } from '../ui/Modal';
import type { TeacherScheduleEntry } from './teacher-schedule-model';

export interface TeacherScheduleDetailPanelProps {
  entry: TeacherScheduleEntry | null;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onOpenClassroom: (entry: TeacherScheduleEntry) => void;
  onOpenRules: (entry: TeacherScheduleEntry) => void;
  onTakeControl: (entry: TeacherScheduleEntry) => void;
  onReleaseClassroom: (entry: TeacherScheduleEntry) => void;
  onEditSchedule: (entry: TeacherScheduleEntry) => void;
  onDeleteSchedule: (entry: TeacherScheduleEntry) => void;
}

const DAY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
};

export const TeacherScheduleDetailPanel: React.FC<TeacherScheduleDetailPanelProps> = ({
  entry,
  isSaving,
  error,
  onClose,
  onOpenClassroom,
  onOpenRules,
  onTakeControl,
  onReleaseClassroom,
  onEditSchedule,
  onDeleteSchedule,
}) => {
  if (entry === null) {
    return null;
  }

  const scheduleType = entry.kind === 'one_off' ? 'Puntual' : 'Semanal';
  const dayLabel = entry.kind === 'weekly' ? DAY_LABELS[entry.dayOfWeek] : null;
  const timeRange = `${entry.startTime}-${entry.endTime}`;
  const secondaryDisabled = isSaving || !entry.canEdit;

  return (
    <Modal isOpen onClose={onClose} title="Detalle del horario" className="max-w-2xl">
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-slate-900">{entry.label}</h3>
          <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500">Aula</dt>
              <dd className="mt-1">{entry.classroomName}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Grupo</dt>
              <dd className="mt-1">{entry.groupName}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Tipo</dt>
              <dd className="mt-1">{scheduleType}</dd>
            </div>
            {dayLabel ? (
              <div>
                <dt className="font-medium text-slate-500">Día</dt>
                <dd className="mt-1">{dayLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-slate-500">Horario</dt>
              <dd className="mt-1">{timeRange}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Acciones de clase
          </h4>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onOpenClassroom(entry)}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Ir al aula
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onOpenRules(entry)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Ver reglas
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onTakeControl(entry)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Tomar control
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onReleaseClassroom(entry)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Liberar aula
            </button>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Gestión del horario
          </h4>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={secondaryDisabled}
              onClick={() => onEditSchedule(entry)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Editar horario
            </button>
            <button
              type="button"
              disabled={secondaryDisabled}
              onClick={() => onDeleteSchedule(entry)}
              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Eliminar horario
            </button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </Modal>
  );
};
