import {
  DEFAULT_ACTIVE_SCHEDULE_DURATION_MINUTES,
  DEFAULT_ADMIN,
  DEFAULT_FUTURE_SCHEDULE_DURATION_MINUTES,
  DEFAULT_FUTURE_SCHEDULE_LEAD_MINUTES,
  DEFAULT_TEACHER,
  type BootstrapStudentScenarioOptions,
  type StudentScenario,
  addMinutes,
  assertQuarterHourDuration,
  buildFixtureHosts,
  extractMachineToken,
  floorToQuarterHour,
  mergeCredentials,
  normalizeApiUrl,
  optionalProp,
  slugify,
  uniqueScenarioSlug,
} from './backend-harness-shared.js';
import {
  createClassroom,
  createEnrollmentTicket,
  createGroup,
  createOneOffSchedule,
  getClassroomDetails,
  login,
  registerMachine,
} from './backend-harness-api.js';

export async function bootstrapStudentScenario(
  options: BootstrapStudentScenarioOptions
): Promise<StudentScenario> {
  const apiUrl = normalizeApiUrl(options.apiUrl);
  const adminCredentials = mergeCredentials(DEFAULT_ADMIN, options.admin);
  const teacherCredentials = mergeCredentials(DEFAULT_TEACHER, options.teacher);
  const scenarioSlug =
    slugify(options.scenarioName ?? uniqueScenarioSlug()) || uniqueScenarioSlug();
  const scenarioName = options.scenarioName ?? scenarioSlug;

  const admin = await login({ apiUrl, credentials: adminCredentials });
  const initialTeacher = await login({ apiUrl, credentials: teacherCredentials });

  const restrictedGroupName = `${scenarioSlug}-restricted`;
  const alternateGroupName = `${scenarioSlug}-alternate`;
  const classroomName = `${scenarioSlug}-room`;

  const restrictedGroup = await createGroup({
    apiUrl,
    accessToken: initialTeacher.accessToken,
    name: restrictedGroupName,
    displayName: `${scenarioName} Restricted`,
  });

  const alternateGroup = await createGroup({
    apiUrl,
    accessToken: initialTeacher.accessToken,
    name: alternateGroupName,
    displayName: `${scenarioName} Alternate`,
  });

  const teacher = await login({ apiUrl, credentials: teacherCredentials });

  const classroom = await createClassroom({
    apiUrl,
    accessToken: admin.accessToken,
    name: classroomName,
    displayName: `${scenarioName} Classroom`,
    defaultGroupId: restrictedGroup.id,
  });

  const now = new Date();
  const activeDurationMinutes =
    options.activeScheduleDurationMinutes ?? DEFAULT_ACTIVE_SCHEDULE_DURATION_MINUTES;
  const futureLeadMinutes =
    options.futureScheduleLeadMinutes ?? DEFAULT_FUTURE_SCHEDULE_LEAD_MINUTES;
  const futureDurationMinutes =
    options.futureScheduleDurationMinutes ?? DEFAULT_FUTURE_SCHEDULE_DURATION_MINUTES;

  assertQuarterHourDuration(activeDurationMinutes, 'activeScheduleDurationMinutes');
  assertQuarterHourDuration(futureLeadMinutes, 'futureScheduleLeadMinutes');
  assertQuarterHourDuration(futureDurationMinutes, 'futureScheduleDurationMinutes');

  const quarterNow = floorToQuarterHour(now);
  const activeStart = addMinutes(quarterNow, -15);
  const activeEnd = addMinutes(new Date(activeStart), activeDurationMinutes);
  const futureStart = addMinutes(quarterNow, futureLeadMinutes);
  const futureEnd = addMinutes(new Date(futureStart), futureDurationMinutes);

  const activeSchedule = await createOneOffSchedule({
    apiUrl,
    accessToken: teacher.accessToken,
    classroomId: classroom.id,
    groupId: restrictedGroup.id,
    startAt: activeStart,
    endAt: activeEnd,
  });

  const futureAlternateSchedule = await createOneOffSchedule({
    apiUrl,
    accessToken: teacher.accessToken,
    classroomId: classroom.id,
    groupId: alternateGroup.id,
    startAt: futureStart,
    endAt: futureEnd,
  });

  const ticket = await createEnrollmentTicket({
    apiUrl,
    accessToken: teacher.accessToken,
    classroomId: classroom.id,
  });

  const reportedHostname = options.machineHostname ?? `${scenarioSlug}-student`;
  const registration = await registerMachine({
    apiUrl,
    enrollmentToken: ticket.enrollmentToken,
    hostname: reportedHostname,
    classroomId: classroom.id,
    ...optionalProp('version', options.version),
  });

  const classroomDetails = await getClassroomDetails({
    apiUrl,
    accessToken: teacher.accessToken,
    classroomId: classroom.id,
  });

  const machineRecord = classroomDetails.machines?.find(
    (machine: { id: string; hostname: string }) => machine.hostname === registration.machineHostname
  );
  if (!machineRecord) {
    throw new Error(`Could not resolve machine ID for ${registration.machineHostname}`);
  }

  return {
    scenarioName,
    apiUrl,
    auth: {
      admin,
      teacher,
    },
    groups: {
      restricted: restrictedGroup,
      alternate: alternateGroup,
    },
    classroom,
    schedules: {
      activeRestriction: activeSchedule,
      futureAlternate: futureAlternateSchedule,
    },
    machine: {
      id: machineRecord.id,
      classroomId: classroom.id,
      machineHostname: registration.machineHostname,
      reportedHostname: registration.reportedHostname,
      machineToken: extractMachineToken(registration.whitelistUrl),
      whitelistUrl: registration.whitelistUrl,
    },
    fixtures: buildFixtureHosts(),
  };
}
