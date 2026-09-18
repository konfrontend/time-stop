// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColorPicker } from './ColorPicker';

afterEach(cleanup);

describe('ColorPicker', () => {
  it('previews every color it passes through and commits the one it closes on', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    function Controlled() {
      const [value, setValue] = useState('#000000');
      return (
        <ColorPicker
          value={value}
          onChange={(color) => {
            onChange(color);
            setValue(color);
          }}
          onCommit={onCommit}
        />
      );
    }
    render(<Controlled />);
    const picker = screen.getByLabelText('Color') as HTMLInputElement;

    fireEvent.input(picker, { target: { value: '#112233' } });
    fireEvent.input(picker, { target: { value: '#445566' } });
    expect(onChange).toHaveBeenLastCalledWith('#445566');
    expect(onCommit).not.toHaveBeenCalled();

    picker.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('#445566');
  });

  it('commits through the callback of the latest render', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(
      <ColorPicker value="#000000" onChange={vi.fn()} onCommit={first} />,
    );
    rerender(<ColorPicker value="#000000" onChange={vi.fn()} onCommit={latest} />);

    screen.getByLabelText('Color').dispatchEvent(new Event('change', { bubbles: true }));
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });
});
