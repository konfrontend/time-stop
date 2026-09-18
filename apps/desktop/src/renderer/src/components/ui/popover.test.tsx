// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

function Editor({
  overlay = false,
  editor = false,
  children = 'Form',
}: {
  overlay?: boolean;
  editor?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>Edit</PopoverTrigger>
      <PopoverContent overlay={overlay} editor={editor}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

const backdrop = () => document.querySelector<HTMLElement>('[data-slot="popover-overlay"]');

afterEach(cleanup);

describe('PopoverContent', () => {
  it('dims the window behind an editor and dismisses it on a backdrop click', async () => {
    render(<Editor overlay />);
    expect(screen.getByRole('dialog')).toHaveProperty('textContent', 'Form');
    expect(backdrop()).not.toBeNull();

    // Radix listens for outside pointer downs from the next tick on.
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    fireEvent.pointerDown(backdrop()!);
    fireEvent.click(backdrop()!);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(backdrop()).toBeNull();
  });

  it('dismisses only the nested editor on its backdrop click', async () => {
    render(
      <Popover open>
        <PopoverTrigger>Recent</PopoverTrigger>
        <PopoverContent data-slot="recent">
          <Editor overlay />
        </PopoverContent>
      </Popover>,
    );
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    await act(() => new Promise((resolve) => setTimeout(resolve)));
    fireEvent.pointerDown(backdrop()!);
    fireEvent.click(backdrop()!);

    const [recent, ...rest] = screen.getAllByRole('dialog');
    expect(rest).toHaveLength(0);
    expect(recent!.dataset.slot).toBe('recent');
  });

  it('leaves the window undimmed without overlay', () => {
    render(<Editor />);
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(backdrop()).toBeNull();
  });

  it('dims behind an editor, which an Escape on a dirty field leaves open', () => {
    render(
      <Editor editor>
        <input aria-label="Name" data-dirty />
        <input aria-label="Rate" />
      </Editor>,
    );
    expect(backdrop()).not.toBeNull();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rate' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
