// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimerDial } from './TimerDial';

afterEach(cleanup);

const dial = (props: Partial<React.ComponentProps<typeof TimerDial>> = {}) =>
  render(
    <TimerDial
      elapsed="00:00:00"
      elapsedMs={0}
      running={false}
      standby="start"
      name=""
      pending={false}
      onToggle={vi.fn()}
      {...props}
    />,
  );

describe('TimerDial', () => {
  it('starts something new on standby with nothing to go on with', () => {
    dial();
    const button = screen.getByRole('button', { name: 'Start' });
    expect(button.dataset['standby']).toBe('start');
    expect(button.dataset['running']).toBeUndefined();
    expect(screen.getByText('00:00:00')).toBeTruthy();
  });

  it('offers Continue, under the Name it would repeat', () => {
    dial({ standby: 'continue', name: 'Build header' });
    const button = screen.getByRole('button', { name: 'Continue Build header' });
    expect(button.dataset['standby']).toBe('continue');
  });

  it('pauses a running Timer and shows its elapsed time', () => {
    dial({ running: true, name: 'Build header', elapsed: '00:01:30', elapsedMs: 90_000 });
    const button = screen.getByRole('button', { name: 'Pause Build header' });
    expect(button.dataset['running']).toBe('true');
    expect(button.dataset['standby']).toBeUndefined();
    expect(screen.getByText('00:01:30')).toBeTruthy();
  });
});
