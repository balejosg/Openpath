/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 */

import type { UserRole } from '../types/index.js';
import { getStoredRoleAliases } from '@openpath/shared/roles';

export function getDbRoleValues(role: UserRole): string[] {
  return [...getStoredRoleAliases(role)];
}
