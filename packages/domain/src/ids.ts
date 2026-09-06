/**
 * UUIDv7 (RFC 9562): 48-bit Unix-millisecond timestamp, version/variant bits, 74 random bits.
 * Ids are minted by the Install that makes the change, so they sort by creation time across
 * entities and Changes without a central authority.
 */
export function uuidv7(nowMs: number = Date.now()): string {
  // Web Crypto so the module loads in the renderer bundle as well as in Node.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let ts = BigInt(nowMs);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(ts & 0xffn);
    ts >>= 8n;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
