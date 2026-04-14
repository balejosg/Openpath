export const TEST_RUN_ID = `${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${TEST_RUN_ID}@test.local`;
}

export function uniqueDomain(prefix: string): string {
  return `${prefix}-${TEST_RUN_ID}.example.com`;
}
