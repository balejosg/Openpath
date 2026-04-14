/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 */

import type { User } from '../types/index.js';
import { users } from '../db/index.js';

export type DBUser = typeof users.$inferSelect;

export interface UserStats {
  total: number;
  active: number;
  verified: number;
}

export interface StoredUserResult extends User {
  isActive: boolean;
  emailVerified: boolean;
}

export interface CreateGoogleUserData {
  email: string;
  name: string;
  googleId: string;
}

export interface CreateUserOptions {
  emailVerified?: boolean;
}

export function toUserType(user: DBUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash ?? undefined,
    googleId: user.googleId ?? undefined,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: user.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}
