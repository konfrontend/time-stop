// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Aspect } from './Aspect';

afterEach(cleanup);

function aspect(props: Partial<React.ComponentProps<typeof Aspect>> = {}) {
  const onClose = vi.fn();
  render(
    <Aspect icon={null} label="Limits" summary={null} onClose={onClose} {...props}>
      <input aria-label="Min hours" data-dirty={props.invalid || undefined} />
    </Aspect>,
  );
  return { onClose };
}

describe('Aspect', () => {
  it('shows its label while unset and its summary once set', () => {
    aspect();
    expect(screen.getByRole('button', { name: 'Limits' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    cleanup();
    aspect({ summary: '10–20 h' });
    expect(screen.getByRole('button', { name: '10–20 h' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('marks the trigger invalid', () => {
    aspect({ summary: '10–5 h', invalid: true });
    expect(screen.getByRole('button', { name: '10–5 h' }).getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('closes, once, where the caller commits its fields', async () => {
    const { onClose } = aspect();
    fireEvent.click(screen.getByRole('button', { name: 'Limits' }));
    const field = await screen.findByLabelText('Min hours');
    expect(onClose).not.toHaveBeenCalled();

    await act(() => new Promise((resolve) => setTimeout(resolve)));
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByLabelText('Min hours')).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('stays open on an Escape from a dirty field', async () => {
    const { onClose } = aspect({ invalid: true });
    fireEvent.click(screen.getByRole('button', { name: 'Limits' }));
    fireEvent.keyDown(await screen.findByLabelText('Min hours'), { key: 'Escape' });
    expect(screen.getByLabelText('Min hours')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
