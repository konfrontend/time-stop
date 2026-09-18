import { waitFor, within } from '@testing-library/react';

export const slots = (name: string): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(`[data-slot="${name}"]`),
];

/** Queries scoped to the first node in a slot, once it has mounted. */
export const slot = (name: string) =>
  waitFor(() => {
    const [found] = slots(name);
    if (!found) throw new Error(`No [data-slot="${name}"]`);
    return within(found);
  });
