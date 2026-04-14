/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 */

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { normalize } from '@openpath/shared';
import { config } from '../config.js';
import { db, users } from '../db/index.js';
import type { DbExecutor } from '../db/index.js';
import { getRowCount } from './utils.js';
import type { SafeUser } from '../types/index.js';
import type { CreateUserData, UpdateUserData } from '../types/storage.js';
import { type CreateGoogleUserData, type CreateUserOptions } from './user-storage-shared.js';

function toSafeUser(row: {
  id: string;
  email: string;
  name: string;
  emailVerified?: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}): SafeUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: true,
    emailVerified: row.emailVerified ?? false,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function createGoogleUser(userData: CreateGoogleUserData): Promise<SafeUser> {
  const id = `user_${uuidv4().slice(0, 8)}`;

  const [result] = await db
    .insert(users)
    .values({
      id,
      email: normalize.email(userData.email),
      name: userData.name.trim(),
      googleId: userData.googleId,
      emailVerified: true,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  if (!result) {
    throw new Error('Failed to create Google user');
  }

  return {
    ...toSafeUser(result),
    emailVerified: true,
  };
}

export async function linkGoogleId(
  userId: string,
  googleId: string,
  executor: DbExecutor = db
): Promise<boolean> {
  return (
    getRowCount(
      await executor
        .update(users)
        .set({ googleId, updatedAt: new Date() })
        .where(eq(users.id, userId))
    ) > 0
  );
}

export async function createUser(
  userData: CreateUserData,
  options: CreateUserOptions = {},
  executor: DbExecutor = db
): Promise<SafeUser> {
  const passwordHash = await bcrypt.hash(userData.password, config.bcryptRounds);
  const id = `user_${uuidv4().slice(0, 8)}`;
  const emailVerified = options.emailVerified ?? false;

  const [result] = await executor
    .insert(users)
    .values({
      id,
      email: normalize.email(userData.email),
      name: userData.name.trim(),
      passwordHash,
      emailVerified,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  if (!result) {
    throw new Error('Failed to create user');
  }

  return {
    ...toSafeUser(result),
    emailVerified: result.emailVerified,
  };
}

export async function updateUser(
  id: string,
  updates: UpdateUserData,
  executor: DbExecutor = db
): Promise<SafeUser | null> {
  const updateValues: Partial<typeof users.$inferInsert> = {};

  if (updates.email !== undefined) {
    updateValues.email = normalize.email(updates.email);
  }
  if (updates.name !== undefined) {
    updateValues.name = updates.name.trim();
  }
  if (updates.password !== undefined) {
    updateValues.passwordHash = await bcrypt.hash(updates.password, config.bcryptRounds);
  }

  if (Object.keys(updateValues).length === 0) {
    const existing = await executor
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return existing[0] ? toSafeUser(existing[0]) : null;
  }

  const [result] = await executor
    .update(users)
    .set(updateValues)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  return result ? toSafeUser(result) : null;
}

export async function updateLastLogin(id: string): Promise<void> {
  await db.update(users).set({ updatedAt: new Date() }).where(eq(users.id, id));
}

export async function deleteUser(id: string, executor: DbExecutor = db): Promise<boolean> {
  return getRowCount(await executor.delete(users).where(eq(users.id, id))) > 0;
}

export async function verifyEmail(id: string, executor: DbExecutor = db): Promise<boolean> {
  return (
    getRowCount(
      await executor
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, id))
    ) > 0
  );
}
