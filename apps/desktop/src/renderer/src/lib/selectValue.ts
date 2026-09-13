/** Radix Select forbids an empty item value, so "nothing picked" travels as this token. */
export const NONE = 'none';

export const toSelectValue = (value: string | null | undefined): string => value || NONE;

export const fromSelectValue = (value: string): string => (value === NONE ? '' : value);
