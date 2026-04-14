import * as storage from '../lib/storage.js';
import * as groupsStorage from '../lib/groups-storage.js';
import * as push from '../lib/push.js';
import * as auth from '../lib/auth.js';
import { withTransaction } from '../db/index.js';
import { logger } from '../lib/logger.js';
import type { JWTPayload } from '../lib/auth.js';
import type { CreateRequestData } from '../types/storage.js';
import type { DomainRequest } from '../types/index.js';
import { getErrorMessage } from '@openpath/shared';
import DomainEventsService from './domain-events.service.js';
import type { RequestResult } from './request-service-shared.js';

interface ResolvedGroupTarget {
  id: string;
  name: string;
}

async function resolveGroupTarget(rawGroup: string): Promise<ResolvedGroupTarget | null> {
  const directById = await groupsStorage.getGroupById(rawGroup);
  if (directById) {
    return { id: directById.id, name: directById.name };
  }

  const normalized = rawGroup.endsWith('.txt') ? rawGroup.slice(0, -4) : rawGroup;
  const directByName = await groupsStorage.getGroupByName(normalized);
  if (directByName) {
    return { id: directByName.id, name: directByName.name };
  }

  return null;
}

function canApproveResolvedTarget(
  user: JWTPayload,
  rawGroup: string,
  resolvedTarget: ResolvedGroupTarget
): boolean {
  if (auth.canApproveGroup(user, rawGroup)) {
    return true;
  }
  if (auth.canApproveGroup(user, resolvedTarget.id)) {
    return true;
  }
  if (auth.canApproveGroup(user, resolvedTarget.name)) {
    return true;
  }
  return false;
}

export async function createRequest(
  input: CreateRequestData
): Promise<RequestResult<DomainRequest>> {
  if (await storage.hasPendingRequest(input.domain)) {
    return {
      ok: false,
      error: { code: 'CONFLICT', message: 'Pending request exists for this domain' },
    };
  }

  try {
    const request = await storage.createRequest(input);

    push.notifyTeachersOfNewRequest(request).catch((error: unknown) => {
      logger.error('Failed to notify teachers of new request', {
        requestId: request.id,
        domain: request.domain,
        error: getErrorMessage(error),
      });
    });

    return { ok: true, data: request };
  } catch (error) {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: getErrorMessage(error) },
    };
  }
}

export async function approveRequest(
  id: string,
  groupId: string | undefined,
  user: JWTPayload
): Promise<RequestResult<DomainRequest>> {
  const request = await storage.getRequestById(id);
  if (!request) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Request not found' } };
  }

  if (request.status !== 'pending') {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: `Request is already ${request.status}` },
    };
  }

  const rawTargetGroup = groupId ?? request.groupId;
  const hasRawPermission = auth.canApproveGroup(user, rawTargetGroup);
  const resolvedTarget = await resolveGroupTarget(rawTargetGroup);

  if (
    !hasRawPermission &&
    (!resolvedTarget || !canApproveResolvedTarget(user, rawTargetGroup, resolvedTarget))
  ) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'You do not have permission to approve for this group' },
    };
  }

  if (!resolvedTarget) {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Target group does not exist' },
    };
  }

  if (!auth.isAdminToken(user)) {
    const blocked = await groupsStorage.isDomainBlocked(resolvedTarget.id, request.domain);
    if (blocked.blocked) {
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'This domain is explicitly blocked' },
      };
    }
  }

  try {
    const approval = await withTransaction(async (tx) => {
      const ruleResult = await groupsStorage.createRule(
        resolvedTarget.id,
        'whitelist',
        request.domain,
        null,
        'manual',
        tx
      );

      if (!ruleResult.success && ruleResult.error !== 'Rule already exists') {
        throw new Error(ruleResult.error ?? 'Failed to add domain to whitelist');
      }

      const updated = await storage.updateRequestStatus(
        request.id,
        'approved',
        user.name,
        `Added to ${resolvedTarget.name}`,
        {
          executor: tx,
          expectedStatus: 'pending',
        }
      );

      return {
        updated,
        createdRule: ruleResult.success,
      };
    });

    if (approval.createdRule) {
      DomainEventsService.publishWhitelistChanged(resolvedTarget.id);
    }

    if (!approval.updated) {
      return {
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Request is no longer pending' },
      };
    }

    return { ok: true, data: approval.updated };
  } catch (error) {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: getErrorMessage(error) },
    };
  }
}

export async function rejectRequest(
  id: string,
  reason: string | undefined,
  user: JWTPayload
): Promise<RequestResult<DomainRequest>> {
  const request = await storage.getRequestById(id);
  if (!request) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Request not found' } };
  }

  if (request.status !== 'pending') {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: `Request is already ${request.status}` },
    };
  }

  if (!auth.canApproveGroup(user, request.groupId)) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'You do not have permission to manage this request' },
    };
  }

  const updated = await storage.updateRequestStatus(request.id, 'rejected', user.name, reason);
  if (!updated) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Failed to update request status' } };
  }

  return { ok: true, data: updated };
}

export async function deleteRequest(id: string): Promise<RequestResult<{ success: boolean }>> {
  const deleted = await storage.deleteRequest(id);
  if (!deleted) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Request not found' } };
  }
  return { ok: true, data: { success: true } };
}

export const RequestCommandService = {
  createRequest,
  approveRequest,
  rejectRequest,
  deleteRequest,
};

export default RequestCommandService;
