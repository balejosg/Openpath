/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 *
 * Push Notification Module
 * Handles Web Push subscriptions and notification sending
 * Storage: PostgreSQL via Drizzle ORM
 */

import {
  deleteSubscriptionByEndpoint,
  deleteSubscriptionById,
  notifyTeachersOfNewRequest,
  saveSubscription,
} from './push-command.js';
import {
  getSubscriptionsForGroup,
  getSubscriptionsForUser,
  getVapidPublicKey,
  isPushEnabled,
} from './push-query.js';

export * from './push-shared.js';
export * from './push-query.js';
export * from './push-command.js';

export default {
  saveSubscription,
  getSubscriptionsForGroup,
  getSubscriptionsForUser,
  deleteSubscriptionByEndpoint,
  deleteSubscriptionById,
  notifyTeachersOfNewRequest,
  getVapidPublicKey,
  isPushEnabled,
};
