/**
 * Email Verification Token Storage - Logic for managing email verification tokens
 */

import { v4 as uuidv4 } from 'uuid';
import { and, eq, gt } from 'drizzle-orm';
import bcrypt from 'bcrypt';

import { config } from '../config.js';
import { db, emailVerificationTokens } from '../db/index.js';

const EMAIL_VERIFICATION_TTL_HOURS = 24;

export async function createEmailVerificationToken(
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = uuidv4().replace(/-/g, '').slice(0, 12);
  const tokenHash = await bcrypt.hash(token, config.bcryptRounds);
  const id = `verify_${uuidv4().slice(0, 8)}`;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFICATION_TTL_HOURS);

  await deleteUserEmailVerificationTokens(userId);

  await db.insert(emailVerificationTokens).values({
    id,
    userId,
    tokenHash,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function verifyEmailVerificationToken(
  userId: string,
  token: string
): Promise<boolean> {
  const results = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        gt(emailVerificationTokens.expiresAt, new Date())
      )
    );

  for (const row of results) {
    if (await bcrypt.compare(token, row.tokenHash)) {
      await deleteUserEmailVerificationTokens(userId);
      return true;
    }
  }

  return false;
}

export async function deleteUserEmailVerificationTokens(userId: string): Promise<void> {
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
}
