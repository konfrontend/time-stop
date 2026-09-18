// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Danger } from './DangerPopover';
import { DangerPopover } from './DangerPopover';

afterEach(cleanup);

function danger(overrides: Partial<Danger> = {}) {
  const value: Danger = {
    describe: vi.fn(async () => '3 Records go with it.'),
    onDelete: vi.fn(async () => {}),
    ...overrides,
  };
  render(
    <TooltipProvider>
      <DangerPopover danger={value} />
    </TooltipProvider>,
  );
  return value;
}

const confirm = () => within(screen.getByRole('dialog'));

describe('DangerPopover', () => {
  it('deletes only once confirmed, after the note has resolved', async () => {
    let resolve = (_note: string) => {};
    const value = danger({
      describe: vi.fn(() => new Promise<string>((done) => (resolve = done))),
    });
    expect(value.describe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(value.describe).toHaveBeenCalledOnce();
    const early = confirm().getByRole('button', { name: 'Delete' }) as HTMLButtonElement;
    expect(early.disabled).toBe(true);
    resolve('3 Records go with it.');

    const button = await waitFor(() => {
      const found = confirm().getByRole('button', { name: 'Delete' }) as HTMLButtonElement;
      expect(found.disabled).toBe(false);
      return found;
    });
    fireEvent.click(button);
    expect(value.onDelete).toHaveBeenCalledOnce();
  });

  it('offers Archive beside Delete', async () => {
    const run = vi.fn(async () => {});
    const value = danger({ archive: { label: 'Archive', note: 'Hides it.', run } });

    fireEvent.click(screen.getByRole('button', { name: 'Archive or delete' }));
    fireEvent.click(await confirm().findByRole('button', { name: 'Archive' }));
    expect(run).toHaveBeenCalledOnce();
    expect(value.onDelete).not.toHaveBeenCalled();
  });

  it('shows a failed delete in the confirm', async () => {
    danger({ onDelete: vi.fn(async () => Promise.reject(new Error('Offline'))) });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const button = await waitFor(() => {
      const found = confirm().getByRole('button', { name: 'Delete' }) as HTMLButtonElement;
      expect(found.disabled).toBe(false);
      return found;
    });
    fireEvent.click(button);
    expect((await confirm().findByRole('alert')).textContent).toBe('Offline');
  });
});
