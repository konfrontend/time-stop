// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { pickOption } from '@/test/pickOption';
import { RoundingPicker } from './RoundingPicker';

afterEach(cleanup);

const open = (value: 'none' | '15m' | '30m', onChange: () => void) =>
  render(
    <TooltipProvider>
      <RoundingPicker value={value} onChange={onChange} />
    </TooltipProvider>,
  );

describe('RoundingPicker', () => {
  it('switches Rounding on at the remembered step and off again', () => {
    const onChange = vi.fn();
    open('none', onChange);
    fireEvent.click(screen.getByRole('button', { name: 'Rounding' }));
    expect(onChange).toHaveBeenCalledWith('15m');

    cleanup();
    open('30m', onChange);
    fireEvent.click(screen.getByRole('button', { name: 'Rounding' }));
    expect(onChange).toHaveBeenCalledWith('none');
  });

  it('changes the step while on', async () => {
    const onChange = vi.fn();
    open('15m', onChange);
    fireEvent.click(screen.getByRole('button', { name: 'Rounding step' }));
    await pickOption('Round to', '30 min');
    expect(onChange).toHaveBeenCalledWith('30m');
  });
});
