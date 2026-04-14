/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 */

import { inArray } from 'drizzle-orm';
import webPush from 'web-push';
import { db } from '../db/index.js';
import { pushSubscriptions, whitelistGroups } from '../db/schema.js';
import { logger } from './logger.js';
import { config } from '../config.js';

export interface PushSubscriptionData {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  groupIds: string[];
  subscription: PushSubscriptionData;
  userAgent: string;
  createdAt: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  data: {
    requestId: string;
    domain: string;
    groupId: string;
    url: string;
  };
}

export interface NotificationResult {
  sent: number;
  failed: number;
  disabled?: boolean;
  noSubscriptions?: boolean;
  total?: number;
}

export async function normalizeAndValidateSubscriptionGroupIds(
  groupIds: string[]
): Promise<string[]> {
  const normalizedGroupIds = [
    ...new Set(groupIds.map((groupId) => groupId.trim()).filter(Boolean)),
  ];

  if (normalizedGroupIds.length === 0) {
    return [];
  }

  const wildcardGroupIds = normalizedGroupIds.filter((groupId) => groupId === '*');
  const concreteGroupIds = normalizedGroupIds.filter((groupId) => groupId !== '*');

  if (concreteGroupIds.length === 0) {
    return wildcardGroupIds;
  }

  const existingGroups = await db
    .select({ id: whitelistGroups.id })
    .from(whitelistGroups)
    .where(inArray(whitelistGroups.id, concreteGroupIds));
  const existingIds = new Set(existingGroups.map((group) => group.id));
  const missingIds = concreteGroupIds.filter((groupId) => !existingIds.has(groupId));

  if (missingIds.length > 0) {
    throw new Error(`Unknown group IDs: ${missingIds.join(', ')}`);
  }

  return [...wildcardGroupIds, ...concreteGroupIds];
}

export const VAPID_CONFIGURED =
  config.vapidPublicKey !== '' && config.vapidPrivateKey !== '' && config.vapidSubject !== '';

if (VAPID_CONFIGURED) {
  webPush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
} else {
  logger.warn('VAPID keys not configured - push notifications disabled', {
    hint: 'Generate keys with: npx web-push generate-vapid-keys',
  });
}

export function dbRowToRecord(row: typeof pushSubscriptions.$inferSelect): SubscriptionRecord {
  return {
    id: row.id,
    userId: row.userId,
    groupIds: row.groupIds,
    subscription: {
      endpoint: row.endpoint,
      expirationTime: null,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth,
      },
    },
    userAgent: row.userAgent ?? '',
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}
