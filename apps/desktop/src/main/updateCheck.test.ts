import { describe, expect, it } from 'vitest';
import { checkForUpdate } from './updateCheck';

const respond =
  (status: number, body: unknown): typeof fetch =>
  async () =>
    new Response(JSON.stringify(body), { status });

const latest = (tag: string) => ({
  tag_name: tag,
  html_url: `https://github.com/konfrontend/time-stop/releases/tag/${tag}`,
});

describe('checkForUpdate', () => {
  it('offers the latest release when it is newer than the running version', async () => {
    const update = await checkForUpdate({
      currentVersion: '0.1.0',
      fetch: respond(200, latest('v0.2.0')),
    });

    expect(update).toEqual({
      version: '0.2.0',
      url: 'https://github.com/konfrontend/time-stop/releases/tag/v0.2.0',
    });
  });

  it.each(['v0.1.0', 'v0.0.9', 'v0.0.10'])(
    'offers nothing when 0.1.0 runs and the latest release is %s',
    async (tag) => {
      expect(
        await checkForUpdate({ currentVersion: '0.1.0', fetch: respond(200, latest(tag)) }),
      ).toBeNull();
    },
  );

  it('compares versions numerically, not as text', async () => {
    const update = await checkForUpdate({
      currentVersion: '0.9.0',
      fetch: respond(200, latest('v0.10.0')),
    });

    expect(update?.version).toBe('0.10.0');
  });

  it('offers nothing when offline', async () => {
    const offline: typeof fetch = async () => {
      throw new TypeError('fetch failed');
    };

    expect(await checkForUpdate({ currentVersion: '0.1.0', fetch: offline })).toBeNull();
  });

  it.each([
    ['rate-limited', respond(403, { message: 'API rate limit exceeded' })],
    ['rate-limited with 429', respond(429, { message: 'Too Many Requests' })],
    ['the repo is private', respond(404, { message: 'Not Found' })],
    ['the body is not JSON', async () => new Response('<html>', { status: 200 })],
    ['the body has no tag', respond(200, { message: 'unexpected' })],
    ['the tag is not a version', respond(200, latest('nightly'))],
  ] satisfies Array<[string, typeof fetch]>)('offers nothing when %s', async (_case, send) => {
    expect(await checkForUpdate({ currentVersion: '0.1.0', fetch: send })).toBeNull();
  });
});
