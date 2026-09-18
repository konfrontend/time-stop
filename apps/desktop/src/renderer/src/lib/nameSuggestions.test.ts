import { describe, expect, it } from 'vitest';
import { nameSuggestions } from './nameSuggestions';

const names = ['Redesign', 'Review', 'Standup'];

describe('nameSuggestions', () => {
  it('offers every Name while nothing is typed', () => {
    expect(nameSuggestions(names, '')).toEqual(names);
    expect(nameSuggestions(names, '  ')).toEqual(names);
  });

  it('keeps the Names holding the typed text, whatever its case or padding', () => {
    expect(nameSuggestions(names, ' rE ')).toEqual(['Redesign', 'Review']);
  });

  it('drops the Name already typed in full', () => {
    expect(nameSuggestions(names, 'Review')).toEqual([]);
    expect(nameSuggestions(names, 'review')).toEqual(['Review']);
  });
});
