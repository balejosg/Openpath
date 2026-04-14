/**
 * AuthService - Business logic for authentication
 */

import AccountRecoveryService from './auth-account-recovery.service.js';
import GoogleAuthService from './auth-google.service.js';
import {
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  type AuthResult,
  type AuthServiceError,
  type EmailVerificationTokenResponse,
  type RegisterResponse,
  type TokenPair,
} from './auth-shared.js';
import { changePassword, getProfile } from './auth-profile.service.js';
import { login, logout, refresh, register } from './auth-session.service.js';

export type {
  AuthResult,
  AuthServiceError,
  EmailVerificationTokenResponse,
  RegisterResponse,
  TokenPair,
};

export { EMAIL_VERIFICATION_REQUIRED_MESSAGE };
export { changePassword, getProfile } from './auth-profile.service.js';
export { login, logout, refresh, register } from './auth-session.service.js';

export const generateEmailVerificationToken = AccountRecoveryService.generateEmailVerificationToken;
export const verifyEmail = AccountRecoveryService.verifyEmail;
export const generateResetToken = AccountRecoveryService.generateResetToken;
export const resetPassword = AccountRecoveryService.resetPassword;
export const loginWithGoogle = GoogleAuthService.loginWithGoogle;

export const AuthService = {
  register,
  login,
  loginWithGoogle,
  refresh,
  logout,
  getProfile,
  generateEmailVerificationToken,
  verifyEmail,
  generateResetToken,
  resetPassword,
  changePassword,
};

export default AuthService;
