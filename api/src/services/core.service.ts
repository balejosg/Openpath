import * as groupsStorage from '../lib/groups-storage.js';
import { config } from '../config.js';

export type CoreServiceError =
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'INTERNAL_SERVER_ERROR'; message: string };

export type CoreResult<T> = { ok: true; data: T } | { ok: false; error: CoreServiceError };

export interface PublicGroupExportResource {
  content: string;
  enabled: boolean;
  groupId: string;
  groupName: string;
  groupUpdatedAt: Date;
}

export function getPublicClientConfig(): { googleClientId: string | null } {
  return {
    googleClientId: config.googleClientId,
  };
}

export async function getPublicGroupExportResource(
  groupName: string
): Promise<CoreResult<PublicGroupExportResource>> {
  const group = await groupsStorage.getGroupMetaByName(groupName);
  if (group?.visibility !== 'instance_public') {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Group not found' } };
  }

  if (!group.enabled) {
    return {
      ok: true,
      data: {
        content: `# Group "${group.displayName}" is currently disabled\n`,
        enabled: false,
        groupId: group.id,
        groupName: group.displayName,
        groupUpdatedAt: group.updatedAt,
      },
    };
  }

  const content = await groupsStorage.exportGroup(group.id);
  if (!content) {
    return {
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Error exporting group' },
    };
  }

  return {
    ok: true,
    data: {
      content,
      enabled: true,
      groupId: group.id,
      groupName: group.displayName,
      groupUpdatedAt: group.updatedAt,
    },
  };
}

export default {
  getPublicClientConfig,
  getPublicGroupExportResource,
};
