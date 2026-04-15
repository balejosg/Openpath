import { randomUUID } from 'node:crypto';

export interface HarnessCredentials {
  email: string;
  password: string;
}

export interface HarnessSession {
  email: string;
  accessToken: string;
  userId?: string;
}

export interface HarnessGroup {
  id: string;
  name: string;
  displayName: string;
}

export interface HarnessClassroom {
  id: string;
  name: string;
  displayName: string;
  defaultGroupId: string;
}

export interface HarnessSchedule {
  id: string;
  classroomId: string;
  groupId: string;
  startAt: string;
  endAt: string;
}

export interface HarnessMachine {
  id: string;
  classroomId: string;
  machineHostname: string;
  reportedHostname: string;
  machineToken: string;
  whitelistUrl: string;
}

export interface StudentFixtureHosts {
  portal: string;
  cdnPortal: string;
  site: string;
  apiSite: string;
}

export interface StudentScenario {
  scenarioName: string;
  apiUrl: string;
  auth: {
    admin: HarnessSession;
    teacher: HarnessSession;
  };
  groups: {
    restricted: HarnessGroup;
    alternate: HarnessGroup;
  };
  classroom: HarnessClassroom;
  schedules: {
    activeRestriction: HarnessSchedule;
    futureAlternate: HarnessSchedule;
  };
  machine: HarnessMachine;
  fixtures: StudentFixtureHosts;
}

export interface BootstrapStudentScenarioOptions {
  apiUrl: string;
  scenarioName?: string;
  machineHostname?: string;
  version?: string;
  admin?: Partial<HarnessCredentials>;
  teacher?: Partial<HarnessCredentials>;
  activeScheduleDurationMinutes?: number;
  futureScheduleLeadMinutes?: number;
  futureScheduleDurationMinutes?: number;
}

export interface PublicRequestSubmission {
  success: boolean;
  id?: string;
  status?: string;
  approved?: boolean;
  autoApproved?: boolean;
  duplicate?: boolean;
  domain?: string;
  source?: string;
  error?: string;
}

export interface RequestStatusResult {
  id: string;
  domain: string;
  status: string;
}

export interface RequestMutationResult {
  id: string;
  status?: string;
  domain?: string;
}

export interface RuleMutationResult {
  id: string;
  groupId?: string;
  type?: 'whitelist' | 'blocked_subdomain' | 'blocked_path';
  value?: string;
}

export interface ExemptionResult {
  id: string;
  machineId: string;
  classroomId: string;
  scheduleId: string;
  expiresAt: string;
}

export interface ActiveGroupResult {
  currentGroupId: string | null;
}

interface TrpcSuccess<T> {
  result?: {
    data?: T;
  };
}

interface TrpcFailure {
  error?: {
    message?: string;
    code?: string | number;
    data?: {
      code?: string;
    };
  };
}

export type TrpcEnvelope<T> = TrpcSuccess<T> & TrpcFailure;

export const DEFAULT_ADMIN: HarnessCredentials = {
  email: 'admin@openpath.local',
  password: 'AdminPassword123!',
};

export const DEFAULT_TEACHER: HarnessCredentials = {
  email: 'teacher@openpath.local',
  password: 'TeacherPassword123!',
};

export const DEFAULT_ACTIVE_SCHEDULE_DURATION_MINUTES = 180;
export const DEFAULT_FUTURE_SCHEDULE_LEAD_MINUTES = 240;
export const DEFAULT_FUTURE_SCHEDULE_DURATION_MINUTES = 30;

export interface CommandArgs {
  command: string;
  options: Map<string, string>;
}

export interface JsonRequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
}

export function mergeCredentials(
  defaults: HarnessCredentials,
  overrides?: Partial<HarnessCredentials>
): HarnessCredentials {
  return {
    email: overrides?.email ?? defaults.email,
    password: overrides?.password ?? defaults.password,
  };
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function uniqueScenarioSlug(prefix = 'student-policy'): string {
  return `${prefix}-${slugify(randomUUID().slice(0, 8))}`;
}

export function addMinutes(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

export function floorToQuarterHour(base: Date): Date {
  const aligned = new Date(base);
  aligned.setUTCSeconds(0, 0);
  aligned.setUTCMinutes(Math.floor(aligned.getUTCMinutes() / 15) * 15);
  return aligned;
}

export function assertQuarterHourDuration(minutes: number, label: string): void {
  if (minutes <= 0 || minutes % 15 !== 0) {
    throw new Error(`${label} must be a positive multiple of 15 minutes`);
  }
}

export function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, '');
}

function getStudentHostSuffix(): string {
  return (process.env.OPENPATH_STUDENT_HOST_SUFFIX ?? '127.0.0.1.sslip.io')
    .trim()
    .replace(/^\.+|\.+$/g, '');
}

export function buildFixtureHosts(): StudentFixtureHosts {
  const suffix = getStudentHostSuffix();
  return {
    portal: `portal.${suffix}`,
    cdnPortal: `cdn.portal.${suffix}`,
    site: `site.${suffix}`,
    apiSite: `api.site.${suffix}`,
  };
}

export function extractMachineToken(whitelistUrl: string): string {
  const match = /\/w\/([^/]+)\/whitelist\.txt$/.exec(whitelistUrl);
  if (match?.[1] === undefined || match[1] === '') {
    throw new Error(`Unable to extract machine token from whitelist URL: ${whitelistUrl}`);
  }
  return match[1];
}

export function parseArgs(argv: string[]): CommandArgs {
  const [command = '', ...rest] = argv;
  const options = new Map<string, string>();

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index] ?? '';
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const next = rest[index + 1];
    if (next === undefined || next.startsWith('--')) {
      options.set(key, 'true');
      continue;
    }

    options.set(key, next);
    index += 1;
  }

  return { command, options };
}

export function requireOption(options: Map<string, string>, key: string): string {
  const value = options.get(key);
  if (value === undefined || value === '') {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

export function getOption(options: Map<string, string>, key: string): string | undefined {
  return options.get(key);
}

export function optionalProp<K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

export function parseBoolean(value: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Expected boolean 'true' or 'false', received: ${value}`);
}

export async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export async function requestJson<T>(url: string, init: JsonRequestOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : null,
  });

  if (!response.ok) {
    const body = await readResponseBody(response);
    throw new Error(`Request failed (${response.status}) for ${url}: ${body}`);
  }

  return (await response.json()) as T;
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
