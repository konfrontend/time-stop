// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimerDial } from './TimerDial';

afterEach(cleanup);

const dial = (props: Partial<React.ComponentProps<typeof TimerDial>> = {}) => {
  const onToggle = vi.fn();
  render(
    <TimerDial
      elapsed="00:00:00"
      elapsedMs={0}
      running={false}
      standby="start"
      name=""
      pending={false}
      onToggle={onToggle}
      {...props}
    />,
  );
  return onToggle;
};

describe('TimerDial', () => {
  it('starts something new on standby with nothing to go on with', () => {
    const onToggle = dial();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('offers to continue the Name it would repeat', () => {
    dial({ standby: 'continue', name: 'Build header' });
    expect(screen.getByRole('button', { name: 'Continue Build header' })).toBeTruthy();
  });

  it('pauses a running Timer and shows its elapsed time', () => {
    dial({ running: true, name: 'Build header', elapsed: '00:01:30', elapsedMs: 90_000 });
    expect(screen.getByRole('button', { name: 'Pause Build header' })).toBeTruthy();
    expect(screen.getByText('00:01:30')).toBeTruthy();
  });
});
