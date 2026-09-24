import { mintToken, revokeToken, type PostgresDb } from '@app/db/postgres';

const USAGE = 'Usage: cli mint | cli revoke <token id>';

export async function runTokenCli(
  args: readonly string[],
  db: PostgresDb,
  print: (line: string) => void,
): Promise<void> {
  const [command, id] = args;
  if (command === 'mint' && args.length === 1) {
    const minted = await mintToken(db);
    print(`Token id: ${minted.id}`);
    print(`Token (shown once): ${minted.token}`);
    return;
  }
  if (command === 'revoke' && id && args.length === 2) {
    if (!(await revokeToken(db, id))) throw new Error(`Token ${id} not found or already revoked`);
    print(`Token ${id} revoked`);
    return;
  }
  throw new Error(USAGE);
}
