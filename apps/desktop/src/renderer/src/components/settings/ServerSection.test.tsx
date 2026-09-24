// @vitest-environment jsdom
import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, renderWith, type Harness } from '@/test/harness';
import { slot } from '@/test/slot';
import { ServerSection } from './ServerSection';

let h: Harness;

beforeEach(() => {
  h = harness();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const section = () => slot('server-section');

describe('ServerSection', () => {
  it('saves the URL and the Token, then leaves the Token field empty', async () => {
    renderWith(<ServerSection />);
    const form = await section();
    fireEvent.change(await form.findByLabelText('Server URL'), {
      target: { value: 'https://mirror.test' },
    });
    fireEvent.change(form.getByLabelText('Token'), { target: { value: 'tst_one' } });
    fireEvent.click(form.getByRole('button', { name: 'Save' }));

    await waitFor(async () =>
      expect(await h.api.sync.getServer()).toMatchObject({
        url: 'https://mirror.test',
        tokenSet: true,
      }),
    );
    await waitFor(() => expect((form.getByLabelText('Token') as HTMLInputElement).value).toBe(''));
  });

  it('masks a stored Token and sends none unless a new one is typed', async () => {
    await h.api.sync.setServer({ url: 'https://mirror.test', token: 'tst_one' });
    // The Token never comes back from the main process, so only the call can show it was kept.
    const setServer = vi.spyOn(window.api.sync, 'setServer');
    renderWith(<ServerSection />);
    const form = await section();

    const token = (await form.findByLabelText('Token')) as HTMLInputElement;
    expect(token.type).toBe('password');
    expect(token.value).toBe('');

    fireEvent.click(form.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(setServer).toHaveBeenCalledWith({ url: 'https://mirror.test', token: null }),
    );
  });
});
