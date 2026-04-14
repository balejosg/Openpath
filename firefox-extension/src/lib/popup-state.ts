export interface BlockedDomainInfo {
  count?: number;
  errors?: string[];
  timestamp: number;
  origin?: string | null;
}

export interface SerializedBlockedDomain {
  errors: string[];
  origin: string | null;
  timestamp: number;
}

export type BlockedDomainsData = Record<string, BlockedDomainInfo>;

interface BlockedDomainsResponse {
  domains?: Record<string, SerializedBlockedDomain>;
}

interface DomainStatusesResponse {
  statuses?: Record<string, DomainStatus>;
}

export function extractTabHostname(url: string | undefined): string {
  if (!url) {
    return 'Desconocido';
  }

  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'Página local';
  }
}

export function normalizeBlockedDomains(response: unknown): BlockedDomainsData {
  const payload = response as BlockedDomainsResponse;
  const serializedDomains = payload.domains ?? {};
  const normalized: BlockedDomainsData = {};

  Object.entries(serializedDomains).forEach(([hostname, data]) => {
    const normalizedEntry: BlockedDomainInfo = {
      count: data.errors.length,
      timestamp: data.timestamp,
    };

    if (data.origin !== null) {
      normalizedEntry.origin = data.origin;
    }

    normalized[hostname] = normalizedEntry;
  });

  return normalized;
}

export function normalizeDomainStatuses(response: unknown): Record<string, DomainStatus> {
  const payload = response as DomainStatusesResponse;
  return payload.statuses ?? {};
}

export function shouldEnableRequestAction(input: {
  hasDomains: boolean;
  nativeAvailable: boolean;
  requestConfigured: boolean;
}): boolean {
  return input.hasDomains && input.nativeAvailable && input.requestConfigured;
}

export function statusMeta(status?: DomainStatus): {
  label: string;
  className: string;
  retryable: boolean;
} {
  switch (status?.state) {
    case 'pending':
      return { label: 'Pendiente', className: 'status-pending', retryable: false };
    case 'autoApproved':
      return { label: 'Auto-aprobado', className: 'status-approved', retryable: false };
    case 'duplicate':
      return { label: 'Duplicado', className: 'status-duplicate', retryable: false };
    case 'localUpdateError':
      return { label: 'Error update local', className: 'status-update-error', retryable: true };
    case 'apiError':
      return { label: 'Error API', className: 'status-api-error', retryable: false };
    default:
      return { label: 'Detectado', className: 'status-detected', retryable: false };
  }
}
