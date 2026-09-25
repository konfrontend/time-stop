import { z } from 'zod';
import type { Update } from '../shared/release';

const LATEST_RELEASE_URL = 'https://api.github.com/repos/konfrontend/timestop/releases/latest';

const latestReleaseSchema = z.object({ tag_name: z.string(), html_url: z.string() });

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

const parseSemver = (version: string): number[] | null =>
  SEMVER.exec(version)?.slice(1).map(Number) ?? null;

function isNewer(candidate: number[], current: number[]): boolean {
  for (let i = 0; i < 3; i++) if (candidate[i] !== current[i]) return candidate[i]! > current[i]!;
  return false;
}

export interface UpdateCheckOptions {
  currentVersion: string;
  fetch?: typeof fetch;
}

/**
 * Asks GitHub for the latest Release and offers it when it is newer than the running app. Never
 * throws: offline, rate-limited, a private repo, or an unexpected answer all come back as null.
 */
export async function checkForUpdate({
  currentVersion,
  fetch: send = fetch,
}: UpdateCheckOptions): Promise<Update | null> {
  try {
    const response = await send(LATEST_RELEASE_URL, {
      headers: { accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    const latest = latestReleaseSchema.safeParse(await response.json());
    if (!latest.success) return null;
    const [candidate, current] = [parseSemver(latest.data.tag_name), parseSemver(currentVersion)];
    if (!candidate || !current || !isNewer(candidate, current)) return null;
    return { version: candidate.join('.'), url: latest.data.html_url };
  } catch {
    return null;
  }
}
