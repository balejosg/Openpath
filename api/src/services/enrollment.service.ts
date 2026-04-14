import {
  issueEnrollmentTicket,
  resolveEnrollmentTokenAccess,
} from './enrollment-access.service.js';
import {
  buildLinuxEnrollmentBootstrap,
  buildWindowsEnrollmentBootstrap,
} from './enrollment-bootstrap.service.js';
export type {
  EnrollmentScriptOutput,
  EnrollmentServiceError,
  EnrollmentServiceResult,
  EnrollmentTicketOutput,
  EnrollmentTokenAccess,
} from './enrollment-service-shared.js';
export {
  issueEnrollmentTicket,
  resolveEnrollmentTokenAccess,
} from './enrollment-access.service.js';
export { resolveEnrollmentContext } from './enrollment-access.service.js';
export {
  buildLinuxEnrollmentBootstrap,
  buildWindowsEnrollmentBootstrap,
} from './enrollment-bootstrap.service.js';

export const EnrollmentService = {
  buildLinuxEnrollmentBootstrap,
  buildWindowsEnrollmentBootstrap,
  issueEnrollmentTicket,
  resolveEnrollmentTokenAccess,
};

export default EnrollmentService;
