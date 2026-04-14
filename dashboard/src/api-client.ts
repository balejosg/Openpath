/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 *
 * Dashboard API Client
 */

import { API_URL } from './trpc.js';

export { changePassword, login, logout, refreshToken } from './api-client-auth.js';
export { createApiClient } from './api-client-groups.js';
export type {
  ApiClient,
  DashboardAuthClientContract,
  DashboardAuthLoginPayload,
  DashboardAuthRefreshPayload,
  DashboardAuthUser,
  DashboardGroupsClientContract,
  DashboardTrpcClientContract,
  Group,
  GroupStats,
  LoginResult,
  Rule,
  RuleType,
  SystemStatus,
} from './api-client-types.js';

export function getExportUrl(groupName: string): string {
  return `${API_URL}/export/${encodeURIComponent(groupName)}.txt`;
}
