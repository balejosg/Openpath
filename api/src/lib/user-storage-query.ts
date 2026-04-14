/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 */

import bcrypt from 'bcrypt';
import { eq, sql, count } from 'drizzle-orm';
import { normalize } from '@openpath/shared';
import { db, users } from '../db/index.js';
import type { SafeUser, User } from '../types/index.js';
import { type StoredUserResult, type UserStats, toUserType } from './user-storage-shared.js';

export async function getAllUsers(): Promise<SafeUser[]> {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isActive: users.isActive,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(sql`${users.createdAt} DESC`);

  return result.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: row.isActive,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ? toUserType(result[0]) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = normalize.email(email);
  const result = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  return result[0] ? toUserType(result[0]) : null;
}

export async function emailExists(email: string): Promise<boolean> {
  const normalizedEmail = normalize.email(email);
  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  return result.length > 0;
}

export async function getUserByGoogleId(googleId: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
  return result[0] ? toUserType(result[0]) : null;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return await bcrypt.compare(password, user.passwordHash ?? '');
}

export async function verifyPasswordByEmail(
  email: string,
  password: string
): Promise<StoredUserResult | null> {
  const normalizedEmail = normalize.email(email);
  const result = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  const user = result[0];

  if (!user?.passwordHash) {
    return null;
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: user.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function getStats(): Promise<UserStats> {
  const [totalRes] = await db.select({ count: count() }).from(users);
  const [activeRes] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.isActive, true));
  const [verifiedRes] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.emailVerified, true));

  return {
    total: totalRes?.count ?? 0,
    active: activeRes?.count ?? 0,
    verified: verifiedRes?.count ?? 0,
  };
}
