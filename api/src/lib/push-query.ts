/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { dbRowToRecord, VAPID_CONFIGURED } from './push-shared.js';
import type { SubscriptionRecord } from './push-shared.js';
import { config } from '../config.js';

export async function getSubscriptionsForGroup(groupId: string): Promise<SubscriptionRecord[]> {
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(
      sql`${pushSubscriptions.groupIds} @> ARRAY[${groupId}]::text[] OR ${pushSubscriptions.groupIds} @> ARRAY['*']::text[]`
    );

  return rows.map(dbRowToRecord);
}

export async function getSubscriptionsForUser(userId: string): Promise<SubscriptionRecord[]> {
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  return rows.map(dbRowToRecord);
}

export function getVapidPublicKey(): string | null {
  return config.vapidPublicKey || null;
}

export function isPushEnabled(): boolean {
  return VAPID_CONFIGURED;
}
