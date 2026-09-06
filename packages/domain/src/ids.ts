import { v7 } from 'uuid';

/**
 * UUIDv7 (RFC 9562): time-ordered, minted by the Install that makes the change, so ids sort by
 * creation time across entities and Changes without a central authority.
 */
export function uuidv7(nowMs: number = Date.now()): string {
  return v7({ msecs: nowMs });
}
