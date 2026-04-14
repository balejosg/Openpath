/**
 * RequestService - Business logic for domain request handling
 */

import {
  approveRequest,
  createRequest,
  deleteRequest,
  rejectRequest,
} from './request-command.service.js';
import {
  checkDomainBlocked,
  getApprovalGroupsForUser,
  getRequest,
  getRequestStatus,
  getStats,
  listBlockedDomains,
  listGroupsForUser,
  listRequests,
} from './request-query.service.js';
export type { RequestResult, RequestServiceError } from './request-service-shared.js';
export {
  approveRequest,
  createRequest,
  deleteRequest,
  rejectRequest,
} from './request-command.service.js';
export {
  checkDomainBlocked,
  getApprovalGroupsForUser,
  getRequest,
  getRequestStatus,
  getStats,
  listBlockedDomains,
  listGroupsForUser,
  listRequests,
} from './request-query.service.js';

export const RequestService = {
  createRequest,
  getRequestStatus,
  approveRequest,
  rejectRequest,
  listRequests,
  getRequest,
  deleteRequest,
  getStats,
  listGroupsForUser,
  listBlockedDomains,
  checkDomainBlocked,
  getApprovalGroupsForUser,
};

export default RequestService;
