import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import type { PostgresDb, PostgresTx } from './open.js';
import { tokens } from './schema.js';

export const TOKEN_PREFIX = 'tst_';

export type TokenRejection = 'unknown' | 'revoked' | 'mismatch';

export class TokenError extends Error {
  constructor(readonly reason: TokenRejection) {
    super(`Token ${reason}`);
  }
}

export interface Token {
  id: string;
  installId: string | null;
  actorId: string | null;
}

export interface Pair {
  installId: string;
  actorId: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The Token itself is returned once and never stored. */
export async function mintToken(
  db: PostgresDb,
  now: () => number = Date.now,
): Promise<{ id: string; token: string }> {
  const at = now();
  const id = uuid({ msecs: at });
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  await db.insert(tokens).values({ id, tokenHash: hashToken(token), createdAt: at });
  return { id, token };
}

export async function revokeToken(
  db: PostgresDb,
  id: string,
  now: () => number = Date.now,
): Promise<boolean> {
  const revoked = await db
    .update(tokens)
    .set({ revokedAt: now() })
    .where(and(eq(tokens.id, id), isNull(tokens.revokedAt)))
    .returning({ id: tokens.id });
  return revoked.length > 0;
}

export async function findToken(db: PostgresDb, token: string): Promise<Token> {
  const row = await db.query.tokens.findFirst({ where: eq(tokens.tokenHash, hashToken(token)) });
  if (!row) throw new TokenError('unknown');
  if (row.revokedAt !== null) throw new TokenError('revoked');
  return { id: row.id, installId: row.installId, actorId: row.actorId };
}

/** Trust on first use: the first push binds the Token; call inside the ingest transaction. */
export async function bindToken(tx: PostgresTx, tokenId: string, pair: Pair): Promise<void> {
  const [row] = await tx.select().from(tokens).where(eq(tokens.id, tokenId)).for('update');
  if (!row) throw new TokenError('unknown');
  if (row.revokedAt !== null) throw new TokenError('revoked');
  if (row.installId === null) {
    await tx.update(tokens).set(pair).where(eq(tokens.id, tokenId));
    return;
  }
  if (row.installId !== pair.installId || row.actorId !== pair.actorId) {
    throw new TokenError('mismatch');
  }
}
