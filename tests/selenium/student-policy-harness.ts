import { StudentPolicyServerClient } from './student-policy-client';
import { StudentPolicyDriver } from './student-policy-driver';
import {
  getDiagnosticsDir,
  getPolicyMode,
  loadScenarioFromEnv,
  optionalEnv,
} from './student-policy-env';
import { runStudentPolicyMatrix, runStudentPolicyMatrixPhaseTwo } from './student-policy-scenarios';
import type { RunResult, StudentPolicyDriverOptions } from './student-policy-types';

export async function runStudentPolicySuite(
  options: StudentPolicyDriverOptions = {}
): Promise<RunResult> {
  const scenario = await loadScenarioFromEnv();
  const client = new StudentPolicyServerClient(scenario);
  const mode = getPolicyMode();
  const diagnosticsDir =
    options.diagnosticsDir ??
    optionalEnv('OPENPATH_STUDENT_DIAGNOSTICS_DIR') ??
    getDiagnosticsDir();

  const runPhase = async (
    phaseName: string,
    runner: (driver: StudentPolicyDriver) => Promise<void>,
    phaseOptions: { useBrowser?: boolean } = {}
  ): Promise<void> => {
    const driver = new StudentPolicyDriver(scenario, {
      ...options,
      diagnosticsDir,
    });

    try {
      if (phaseOptions.useBrowser !== false) {
        await driver.setup();
      }
      if (mode === 'fallback') {
        await driver.withSseDisabled(async () => {
          await runner(driver);
        });
      } else {
        await runner(driver);
      }
    } catch (error) {
      try {
        await driver.saveDiagnostics(`student-policy-${phaseName}-failure`);
      } catch {
        // Best effort diagnostics.
      }
      throw error;
    } finally {
      await driver.teardown();
    }
  };

  await runPhase('phase-one', async (driver) => {
    await runStudentPolicyMatrix(client, driver, mode);
  });
  await runPhase(
    'phase-two',
    async (driver) => {
      await runStudentPolicyMatrixPhaseTwo(client, driver, mode);
    },
    { useBrowser: false }
  );

  return { success: true, diagnosticsDir };
}
