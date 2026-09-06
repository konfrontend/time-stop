import { randomBytes } from 'node:crypto';

/**
 * UUIDv7 (RFC 9562): 48-bit Unix-millisecond timestamp, version/variant bits, 74 random bits.
 * Ids are minted by the Install that makes the change, so they sort by creation time across
 * entities and Changes without a central authority.
 */
export function uuidv7(nowMs: number = Date.now()): string {
  const bytes = randomBytes(16);
  let ts = BigInt(nowMs);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(ts & 0xffn);
    ts >>= 8n;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The millisecond timestamp a UUIDv7 was minted at. */
export function uuidv7Time(id: string): number {
  return Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
}
