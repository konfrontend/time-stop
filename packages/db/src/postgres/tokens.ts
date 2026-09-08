import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { v7 as uuid } from 'uuid';
import type { PostgresDb, PostgresTx } from './open.js';
import { tokens } from './schema.js';

const TOKEN_PREFIX = 'tst_';

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

export interface TokenBinding {
  installId: string;
  actorId: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The Token itself is returned once and never stored. */
export async function mintToken(db: PostgresDb): Promise<{ id: string; token: string }> {
  const at = Date.now();
  const id = uuid({ msecs: at });
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  await db.insert(tokens).values({ id, tokenHash: hashToken(token), createdAt: at });
  return { id, token };
}

export async function revokeToken(db: PostgresDb, id: string): Promise<boolean> {
  const revoked = await db
    .update(tokens)
    .set({ revokedAt: Date.now() })
    .where(and(eq(tokens.id, id), isNull(tokens.revokedAt)))
    .returning({ id: tokens.id });
  return revoked.length > 0;
}

function assertLive(row: typeof tokens.$inferSelect | undefined): typeof tokens.$inferSelect {
  if (!row) throw new TokenError('unknown');
  if (row.revokedAt !== null) throw new TokenError('revoked');
  return row;
}

export async function findToken(db: PostgresDb, token: string): Promise<Token> {
  const row = assertLive(
    await db.query.tokens.findFirst({ where: eq(tokens.tokenHash, hashToken(token)) }),
  );
  return { id: row.id, installId: row.installId, actorId: row.actorId };
}

/** Trust on first use: the first push binds the Token; call inside the ingest transaction. */
export async function bindToken(
  tx: PostgresTx,
  tokenId: string,
  binding: TokenBinding,
): Promise<void> {
  const [found] = await tx.select().from(tokens).where(eq(tokens.id, tokenId)).for('update');
  const row = assertLive(found);
  if (row.installId === null) {
    await tx.update(tokens).set(binding).where(eq(tokens.id, tokenId));
    return;
  }
  if (row.installId !== binding.installId || row.actorId !== binding.actorId) {
    throw new TokenError('mismatch');
  }
}
