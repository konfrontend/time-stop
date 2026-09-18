// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineInput } from './InlineInput';

afterEach(cleanup);

function inline(value = 'Acme', props: Partial<React.ComponentProps<typeof InlineInput>> = {}) {
  const onCommit = vi.fn();
  const onClose = vi.fn();
  render(
    <InlineInput
      value={value}
      onCommit={onCommit}
      onClose={onClose}
      label="Client Name"
      slot="s"
      {...props}
    />,
  );
  return {
    input: screen.getByRole('textbox', { name: 'Client Name' }) as HTMLInputElement,
    onCommit,
    onClose,
  };
}

describe('InlineInput', () => {
  it('commits the trimmed value on Enter, once', () => {
    const { input, onCommit } = inline();
    fireEvent.change(input, { target: { value: '  Globex ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Globex');
  });

  it('commits on blur', () => {
    const { input, onCommit } = inline();
    fireEvent.change(input, { target: { value: 'Globex' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Globex');
  });

  it('gives up the draft on Escape', () => {
    const { input, onCommit, onClose } = inline();
    fireEvent.change(input, { target: { value: 'Globex' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('Acme');
    expect(onClose).toHaveBeenCalled();
  });

  it('commits nothing for a value left as it was', () => {
    const { input, onCommit, onClose } = inline();
    fireEvent.change(input, { target: { value: 'Acme ' } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('commits nothing for an empty new value that was never typed in', () => {
    const { input, onCommit } = inline('', { open: true });
    expect(document.activeElement).toBe(input);
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
