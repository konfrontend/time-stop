// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimePicker } from './TimePicker';

afterEach(cleanup);

const open = (value = '', twelveHours = false) => {
  const onChange = vi.fn();
  render(<TimePicker id="t" value={value} onChange={onChange} twelveHours={twelveHours} />);
  return { input: screen.getByRole('combobox') as HTMLInputElement, onChange };
};

describe('TimePicker', () => {
  it('lands an exact clock at once and normalises the rest on blur', () => {
    const { input, onChange } = open();
    fireEvent.change(input, { target: { value: '09:30' } });
    expect(onChange).toHaveBeenCalledWith('09:30');

    fireEvent.change(input, { target: { value: '930' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith('09:30');
    expect(input.value).toBe('09:30');
  });

  it('shows and reads the locale clock, keeping the value at HH:mm', () => {
    const { input, onChange } = open('13:00', true);
    expect(input.value).toBe('01:00 PM');
    fireEvent.change(input, { target: { value: '9:15 pm' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('21:15');
  });

  it('reverts what is not a clock', () => {
    const { input, onChange } = open('08:00');
    fireEvent.change(input, { target: { value: 'noon' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('08:00');
  });

  it('nudges by five minutes with the arrow keys', () => {
    const { input, onChange } = open('08:00');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith('08:05');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('07:55');
  });

  it('narrows the list to what is typed and picks from it', async () => {
    const { input, onChange } = open();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '17' } });
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(4);
    fireEvent.click(options[1]!);
    expect(onChange).toHaveBeenLastCalledWith('17:15');
  });
});
