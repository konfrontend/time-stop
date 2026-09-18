// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SaveAlert } from './FormFooter';
import { FormFooter } from './FormFooter';

afterEach(cleanup);

function footer(alert: SaveAlert | null, onAlertClose = vi.fn()) {
  render(
    <form>
      <FormFooter submitting={false} onCancel={vi.fn()} alert={alert} onAlertClose={onAlertClose} />
    </form>,
  );
  return { onAlertClose };
}

describe('FormFooter', () => {
  it('asks over Save and saves past the warning once confirmed', () => {
    const onConfirm = vi.fn();
    const { onAlertClose } = footer({ note: 'Crosses midnight.', onConfirm });
    const alert = within(screen.getByRole('dialog'));

    fireEvent.click(alert.getByRole('button', { name: 'Save anyway' }));
    expect(onConfirm).toHaveBeenCalledOnce();

    fireEvent.click(alert.getByRole('button', { name: 'Cancel' }));
    expect(onAlertClose).toHaveBeenCalledOnce();
  });

  it('reports failures with nothing to confirm', () => {
    footer({ failures: ['Stop precedes start'] });
    const alert = within(screen.getByRole('dialog'));
    expect(alert.getByRole('alert').textContent).toBe('Stop precedes start');
    expect(alert.queryByRole('button')).toBeNull();
  });

  it('shows no alert without one', () => {
    footer(null);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
