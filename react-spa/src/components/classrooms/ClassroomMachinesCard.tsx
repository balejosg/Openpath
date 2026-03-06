import React from 'react';
import { AlertCircle, Download, Loader2, Monitor } from 'lucide-react';
import type { Classroom, ClassroomExemption } from '../../types';

interface ClassroomMachinesCardProps {
  admin: boolean;
  classroom: Classroom;
  hasActiveSchedule: boolean;
  exemptionByMachineId: ReadonlyMap<string, ClassroomExemption>;
  exemptionMutating: Partial<Record<string, boolean>>;
  exemptionsError: string | null;
  loadingExemptions: boolean;
  enrollModalLoadingToken: boolean;
  onOpenEnrollModal: () => void | Promise<void>;
  onCreateExemption: (machineId: string) => void | Promise<void>;
  onDeleteExemption: (machineId: string) => void | Promise<void>;
}

export default function ClassroomMachinesCard({
  admin,
  classroom,
  hasActiveSchedule,
  exemptionByMachineId,
  exemptionMutating,
  exemptionsError,
  loadingExemptions,
  enrollModalLoadingToken,
  onOpenEnrollModal,
  onCreateExemption,
  onDeleteExemption,
}: ClassroomMachinesCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 flex-1 min-h-[300px] flex flex-col shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Monitor size={18} className="text-blue-500" />
          Máquinas Registradas
        </h3>
        <div className="flex items-center gap-2">
          {admin && (
            <button
              onClick={() => void onOpenEnrollModal()}
              disabled={enrollModalLoadingToken}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm font-medium disabled:opacity-50"
            >
              {enrollModalLoadingToken ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Instalar equipos
            </button>
          )}
          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200 font-medium">
            Total: {classroom.computerCount}
          </span>
        </div>
      </div>

      {exemptionsError && (
        <div className="mb-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{exemptionsError}</span>
        </div>
      )}

      {classroom.machines && classroom.machines.length > 0 ? (
        <div className="flex-1 space-y-2 overflow-auto">
          {classroom.machines.map((machine) => {
            const exemption = exemptionByMachineId.get(machine.id);
            const isExempt = exemption !== undefined;
            const mutating = exemptionMutating[machine.id] ?? false;

            const statusColor =
              machine.status === 'online'
                ? 'bg-green-500'
                : machine.status === 'stale'
                  ? 'bg-yellow-500'
                  : 'bg-red-500';

            const expiresTime = exemption
              ? new Date(exemption.expiresAt).toTimeString().slice(0, 5)
              : null;

            return (
              <div
                key={machine.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {machine.hostname}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {machine.status === 'online'
                        ? 'En línea'
                        : machine.status === 'stale'
                          ? 'Conexión inestable'
                          : 'Sin conexión'}
                      {machine.lastSeen
                        ? ` · Último: ${new Date(machine.lastSeen).toLocaleString()}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isExempt && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full border border-green-200 font-medium">
                      Sin restricción{expiresTime ? ` · hasta ${expiresTime}` : ''}
                    </span>
                  )}

                  {isExempt ? (
                    <button
                      onClick={() => void onDeleteExemption(machine.id)}
                      disabled={mutating}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm transition-colors shadow-sm font-medium disabled:opacity-50"
                    >
                      {mutating ? '...' : 'Restringir'}
                    </button>
                  ) : hasActiveSchedule ? (
                    <button
                      onClick={() => void onCreateExemption(machine.id)}
                      disabled={mutating || loadingExemptions}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors shadow-sm font-medium disabled:opacity-50"
                    >
                      {mutating ? '...' : 'Liberar'}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
          <Monitor size={48} className="text-slate-300 mb-3" />
          <p className="text-slate-900 font-medium text-sm">Sin máquinas activas</p>
          <p className="text-slate-500 text-xs mt-1 max-w-xs">
            Instala el agente de OpenPath en los equipos para verlos aquí.
          </p>
        </div>
      )}

      {!hasActiveSchedule && classroom.machines && classroom.machines.length > 0 && (
        <p className="mt-3 text-xs text-slate-500 italic">
          La liberación temporal solo está disponible cuando hay un bloque de horario activo.
        </p>
      )}
    </div>
  );
}
