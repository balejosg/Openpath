import type { Runtime, WebRequest } from 'webextension-polyfill';
import { isAutoAllowRequestType } from './auto-allow-workflow.js';
import {
  parsePageResourceCandidateMessage,
  type ParsedPageResourceCandidate,
  type PageResourceCandidateParseResult,
} from './auto-allow-observation.js';
import { extractHostname, isExtensionUrl } from './path-blocking.js';

export type PageResourceAutoAllowCandidate = ParsedPageResourceCandidate;

export type PageResourceAutoAllowIntakeResult =
  | { ok: true; candidate: PageResourceAutoAllowCandidate }
  | { ok: false; error: string };

export interface WebRequestIntakeAdapters {
  getTabUrl: (tabId: number) => Promise<string | null | undefined>;
}

function normalizeAutoAllowOriginCandidate(
  candidateUrl: string | undefined,
  targetUrl: string
): string | null {
  if (!candidateUrl || candidateUrl === targetUrl || isExtensionUrl(candidateUrl)) {
    return null;
  }

  return extractHostname(candidateUrl) ? candidateUrl : null;
}

async function resolveAutoAllowOriginPage(
  details: {
    documentUrl?: string;
    originUrl?: string;
    tabId: number;
    url: string;
  },
  adapters: WebRequestIntakeAdapters
): Promise<string | null> {
  if (details.tabId >= 0) {
    try {
      const tabOrigin = normalizeAutoAllowOriginCandidate(
        (await adapters.getTabUrl(details.tabId)) ?? undefined,
        details.url
      );
      if (tabOrigin) {
        return tabOrigin;
      }
    } catch {
      // Fall back to Firefox's request context below.
    }
  }

  return normalizeAutoAllowOriginCandidate(details.originUrl ?? details.documentUrl, details.url);
}

function resolveAutoAllowRequestType(details: {
  documentUrl?: string;
  originUrl?: string;
  type?: WebRequest.ResourceType;
  url: string;
}): WebRequest.ResourceType | null {
  const requestType =
    details.type ??
    (normalizeAutoAllowOriginCandidate(details.originUrl ?? details.documentUrl, details.url)
      ? 'other'
      : undefined);

  if (!requestType || !isAutoAllowRequestType(requestType)) {
    return null;
  }

  return requestType;
}

export function isEligibleAutoAllowCandidate(candidate: PageResourceAutoAllowCandidate): boolean {
  return (
    candidate.hostname.length > 0 &&
    !isExtensionUrl(candidate.targetUrl) &&
    candidate.requestType !== 'main_frame' &&
    candidate.requestType !== 'sub_frame' &&
    (candidate.tabId >= 0 || candidate.originPage !== null)
  );
}

export function buildAutoAllowCandidateFromMessage(
  message: unknown,
  sender: Runtime.MessageSender
): PageResourceCandidateParseResult {
  const parsed = parsePageResourceCandidateMessage(message, {
    senderTabId: sender.tab?.id,
    senderTabUrl: sender.tab?.url,
  });
  if (!parsed.ok) {
    return parsed;
  }

  if (!isEligibleAutoAllowCandidate(parsed.candidate)) {
    return { ok: false, error: 'candidate is not eligible for page-resource auto-allow' };
  }

  return parsed;
}

export async function buildAutoAllowCandidateFromWebRequest(
  details: {
    documentUrl?: string;
    originUrl?: string;
    tabId: number;
    type?: WebRequest.ResourceType;
    url: string;
  },
  adapters: WebRequestIntakeAdapters
): Promise<PageResourceAutoAllowIntakeResult> {
  const hostname = extractHostname(details.url);
  if (!hostname || isExtensionUrl(details.url)) {
    return { ok: false, error: 'target URL is not eligible for page-resource auto-allow' };
  }

  if (details.type === 'main_frame' || details.type === 'sub_frame') {
    return {
      ok: false,
      error: `${details.type} requests are not eligible for page-resource auto-allow`,
    };
  }

  const requestType = resolveAutoAllowRequestType(details);
  if (!requestType) {
    return { ok: false, error: 'request type is not eligible for page-resource auto-allow' };
  }

  const originPage = await resolveAutoAllowOriginPage(details, adapters);
  const candidate = {
    tabId: details.tabId,
    hostname,
    originPage,
    requestType,
    targetUrl: details.url,
  };

  if (!isEligibleAutoAllowCandidate(candidate)) {
    return { ok: false, error: 'candidate is not eligible for page-resource auto-allow' };
  }

  return { ok: true, candidate };
}
