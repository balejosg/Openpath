/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 */

import { eq, sql } from 'drizzle-orm';
import { normalize } from '@openpath/shared';
import { db, requests, whitelistGroups } from '../db/index.js';
import type { DomainRequest, RequestStatus } from '../types/index.js';
import type { CreateRequestData } from '../types/storage.js';
import { getRows } from './utils.js';

export function toStorageType(row: typeof requests.$inferSelect): DomainRequest {
  return {
    id: row.id,
    domain: row.domain,
    reason: row.reason ?? '',
    requesterEmail: row.requesterEmail ?? '',
    groupId: row.groupId,
    source: row.source ?? 'unknown',
    machineHostname: row.machineHostname ?? null,
    originHost: row.originHost ?? null,
    originPage: row.originPage ?? null,
    clientVersion: row.clientVersion ?? null,
    errorType: row.errorType ?? null,
    status: (row.status ?? 'pending') as RequestStatus,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedBy: row.resolvedBy ?? null,
    resolutionNote: row.resolutionNote ?? '',
  };
}

export interface LegacyRequestRow {
  id: string;
  domain: string;
  reason: string | null;
  requester_email: string | null;
  group_id: string;
  status: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  resolved_at: Date | string | null;
  resolved_by: string | null;
  resolution_note: string | null;
}

export function legacyRowToStorageType(row: LegacyRequestRow): DomainRequest {
  const toIso = (value: Date | string | null | undefined): string | null => {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  return {
    id: row.id,
    domain: row.domain,
    reason: row.reason ?? '',
    requesterEmail: row.requester_email ?? '',
    groupId: row.group_id,
    source: 'unknown',
    machineHostname: null,
    originHost: null,
    originPage: null,
    clientVersion: null,
    errorType: null,
    status: (row.status ?? 'pending') as RequestStatus,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
    resolvedAt: toIso(row.resolved_at),
    resolvedBy: row.resolved_by ?? null,
    resolutionNote: row.resolution_note ?? '',
  };
}

export async function findExistingGroupId(rawGroup: string): Promise<string | null> {
  const trimmed = rawGroup.trim();
  if (!trimmed) {
    return null;
  }

  const [groupById] = await db
    .select({ id: whitelistGroups.id })
    .from(whitelistGroups)
    .where(eq(whitelistGroups.id, trimmed))
    .limit(1);
  if (groupById) {
    return groupById.id;
  }

  const normalizedName = trimmed.endsWith('.txt') ? trimmed.slice(0, -4) : trimmed;
  const [groupByName] = await db
    .select({ id: whitelistGroups.id })
    .from(whitelistGroups)
    .where(eq(whitelistGroups.name, normalizedName))
    .limit(1);

  return groupByName?.id ?? null;
}

export async function resolveRequestGroupId(requestData: CreateRequestData): Promise<string> {
  const requestedGroup = requestData.groupId?.trim();
  if (requestedGroup) {
    const resolvedGroupId = await findExistingGroupId(requestedGroup);
    if (resolvedGroupId) {
      return resolvedGroupId;
    }

    throw new Error(`Request group "${requestedGroup}" does not exist`);
  }

  const configuredDefaultGroup = process.env.DEFAULT_GROUP?.trim();
  if (configuredDefaultGroup) {
    const resolvedGroupId = await findExistingGroupId(configuredDefaultGroup);
    if (resolvedGroupId) {
      return resolvedGroupId;
    }

    throw new Error(`DEFAULT_GROUP "${configuredDefaultGroup}" does not exist`);
  }

  const legacyDefaultGroupId = await findExistingGroupId('default');
  if (legacyDefaultGroupId) {
    return legacyDefaultGroupId;
  }

  throw new Error(
    'No request group is available. Provide groupId or configure DEFAULT_GROUP to an existing whitelist group.'
  );
}

let metadataColumnCheck: boolean | null = null;

export async function hasRequestMetadataColumns(): Promise<boolean> {
  if (metadataColumnCheck !== null) {
    return metadataColumnCheck;
  }

  const row = getRows<{ has_source?: boolean | number | string }>(
    await db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'requests'
          AND column_name = 'source'
      ) AS has_source
    `)
  )[0];
  const raw = row?.has_source;
  metadataColumnCheck = raw === true || raw === 't' || raw === 1 || raw === '1';
  return metadataColumnCheck;
}

export function normalizeRequestDomain(domain: string): string {
  return normalize.domain(domain);
}
