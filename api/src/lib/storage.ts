/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 *
 * Simple PostgreSQL storage for domain requests using Drizzle ORM
 */

import type { IRequestStorage } from '../types/storage.js';
import { createRequest, deleteRequest, updateRequestStatus } from './request-storage-command.js';
import {
  getAllRequests,
  getRequestById,
  getRequestsByGroup,
  getStats,
  hasPendingRequest,
} from './request-storage-query.js';

export * from './request-storage-shared.js';
export * from './request-storage-query.js';
export * from './request-storage-command.js';

export const storage: IRequestStorage = {
  getAllRequests,
  getRequestById,
  getRequestsByGroup,
  hasPendingRequest,
  createRequest,
  updateRequestStatus,
  deleteRequest,
  getStats,
};

export default storage;
