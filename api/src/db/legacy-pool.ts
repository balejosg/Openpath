import { pool as canonicalPool } from './pool.js';

/**
 * Explicit compatibility boundary for raw pg.Pool consumers.
 * New code should prefer db/withTransaction from index.ts; this export exists
 * for migration scripts and low-level callers that still need direct pg access.
 */
export const pool = canonicalPool;
