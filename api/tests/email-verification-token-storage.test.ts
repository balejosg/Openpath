import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import { eq } from 'drizzle-orm';

import { db, emailVerificationTokens, users } from '../src/db/index.js';
import {
  createEmailVerificationToken,
  deleteUserEmailVerificationTokens,
  verifyEmailVerificationToken,
} from '../src/lib/email-verification-token-storage.js';
import { resetDb, uniqueEmail } from './test-utils.js';

const TEST_USER_ID = 'verify-storage-user';

async function seedUser(): Promise<void> {
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: uniqueEmail('verify-storage'),
    name: 'Verify Storage User',
    passwordHash: 'hashed-password',
    emailVerified: false,
  });
}

void describe('Email Verification Token Storage', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser();
  });

  void it('creates a single active token per user', async () => {
    const first = await createEmailVerificationToken(TEST_USER_ID);
    const second = await createEmailVerificationToken(TEST_USER_ID);

    const rows = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, TEST_USER_ID));

    assert.strictEqual(rows.length, 1);
    assert.notStrictEqual(first.token, second.token);
    assert.ok(second.expiresAt > new Date());
  });

  void it('verifies a valid token once and deletes stored hashes afterwards', async () => {
    const { token } = await createEmailVerificationToken(TEST_USER_ID);

    const firstVerification = await verifyEmailVerificationToken(TEST_USER_ID, token);
    const secondVerification = await verifyEmailVerificationToken(TEST_USER_ID, token);
    const rows = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, TEST_USER_ID));

    assert.strictEqual(firstVerification, true);
    assert.strictEqual(secondVerification, false);
    assert.strictEqual(rows.length, 0);
  });

  void it('returns false for wrong tokens and explicit deletion clears all tokens', async () => {
    await createEmailVerificationToken(TEST_USER_ID);

    const verified = await verifyEmailVerificationToken(TEST_USER_ID, 'wrong-token');
    await deleteUserEmailVerificationTokens(TEST_USER_ID);

    const rows = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, TEST_USER_ID));

    assert.strictEqual(verified, false);
    assert.strictEqual(rows.length, 0);
  });
});
