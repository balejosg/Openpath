/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 *
 * User Storage - PostgreSQL-based user management using Drizzle ORM
 */

import type { IUserStorage } from '../types/storage.js';
import { createUser, deleteUser, updateUser } from './user-storage-command.js';
import { getAllUsers, getUserByEmail, getUserById, verifyPassword } from './user-storage-query.js';

export * from './user-storage-shared.js';
export * from './user-storage-query.js';
export * from './user-storage-command.js';

export const userStorage: IUserStorage = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  verifyPassword,
};

export default userStorage;
