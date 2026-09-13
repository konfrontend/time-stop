import { fireEvent, screen } from '@testing-library/react';

/** Opens the Select behind `label` and picks the option called `name`, by keyboard. */
export async function pickOption(label: string | RegExp, name: string | RegExp): Promise<void> {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' });
  fireEvent.keyDown(await screen.findByRole('option', { name }), { key: 'Enter' });
}
