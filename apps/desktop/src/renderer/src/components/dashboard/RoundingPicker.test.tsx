// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RoundingPicker } from './RoundingPicker';

afterEach(cleanup);

const open = (value: 'none' | '15m' | '30m', onChange: () => void) =>
  render(
    <TooltipProvider>
      <RoundingPicker value={value} onChange={onChange} />
    </TooltipProvider>,
  );

describe('RoundingPicker', () => {
  it('picks a step from the menu behind the clock', async () => {
    const onChange = vi.fn();
    open('none', onChange);
    const trigger = screen.getByRole('button', { name: 'Rounding' });
    expect(trigger.getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitemradio', { name: '30 min' }));
    expect(onChange).toHaveBeenCalledWith('30m');
  });

  it('is pressed while a step is active', () => {
    open('15m', vi.fn());
    expect(screen.getByRole('button', { name: 'Rounding' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
