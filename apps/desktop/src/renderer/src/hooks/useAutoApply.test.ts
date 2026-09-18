// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Issue } from './useAutoApply';
import { keepOpenOnDirtyEscape, useAutoApply, useEditedEntity } from './useAutoApply';

const blank = (value: string): Issue[] => (value.trim() === '' ? [{ message: 'Required' }] : []);

function field(saved = 'Site', save = vi.fn(async () => {})) {
  const hook = renderHook(
    (props: { saved: string }) => useAutoApply({ saved: props.saved, validate: blank, save }),
    { initialProps: { saved } },
  );
  return { ...hook, save };
}

describe('useAutoApply', () => {
  it('saves a changed draft', async () => {
    const { result, save } = field();
    act(() => result.current.setDraft('Shop'));
    await act(() => result.current.commit());
    expect(save).toHaveBeenCalledExactlyOnceWith('Shop');
  });

  it('saves nothing for an unchanged draft', async () => {
    const { result, save } = field();
    await act(() => result.current.commit());
    expect(save).not.toHaveBeenCalled();
    expect(result.current.dirty).toBe(false);
  });

  it('keeps an invalid draft unsaved, with its issues', async () => {
    const { result, save } = field();
    act(() => result.current.setDraft('  '));
    await act(() => result.current.commit());
    expect(save).not.toHaveBeenCalled();
    expect(result.current.issues).toEqual([{ message: 'Required' }]);
    expect(result.current.dirty).toBe(true);
  });

  it('reports a failed save as an issue', async () => {
    const { result } = field(
      'Site',
      vi.fn(async () => Promise.reject(new Error('Offline'))),
    );
    act(() => result.current.setDraft('Shop'));
    await act(() => result.current.commit());
    expect(result.current.issues.map((issue) => issue.message)).toEqual(['Offline']);
  });

  it('saves a draft once when a second commit lands while the first is in flight', async () => {
    let finish = () => {};
    const save = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result } = field('Site', save);
    act(() => result.current.setDraft('Shop'));
    await act(async () => {
      const first = result.current.commit();
      void result.current.commit();
      finish();
      await first;
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reverts the draft and its issues', async () => {
    const { result } = field();
    act(() => result.current.setDraft('  '));
    await act(() => result.current.commit());
    act(() => result.current.revert());
    expect(result.current.draft).toBe('Site');
    expect(result.current.issues).toEqual([]);
  });

  it('reverts one field of a group, keeping the others', () => {
    const saved = { min: '', max: '' };
    const { result } = renderHook(() =>
      useAutoApply({ saved, validate: () => [], save: vi.fn(async () => {}) }),
    );
    act(() => result.current.setDraft({ min: '10', max: '5' }));
    act(() => result.current.revert('max'));
    expect(result.current.draft).toEqual({ min: '10', max: '' });
  });

  it('takes a new saved value over a draft that was not edited', () => {
    const { result, rerender } = field();
    rerender({ saved: 'Shop' });
    expect(result.current.draft).toBe('Shop');
  });

  it('keeps an edited draft over a new saved value', () => {
    const { result, rerender } = field();
    act(() => result.current.setDraft('Store'));
    rerender({ saved: 'Shop' });
    expect(result.current.draft).toBe('Store');
  });

  it('commits a valid unsaved draft on unmount, and not an invalid one', () => {
    const valid = field();
    act(() => valid.result.current.setDraft('Shop'));
    valid.unmount();
    expect(valid.save).toHaveBeenCalledExactlyOnceWith('Shop');

    const invalid = field();
    act(() => invalid.result.current.setDraft(' '));
    invalid.unmount();
    expect(invalid.save).not.toHaveBeenCalled();
  });
});

describe('keepOpenOnDirtyEscape', () => {
  const escapeFrom = (target: Element) => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    Object.defineProperty(event, 'target', { value: target });
    keepOpenOnDirtyEscape(event);
    return event.defaultPrevented;
  };

  it('keeps the editor open for an Escape on a dirty field only', () => {
    const dirty = document.createElement('input');
    dirty.setAttribute('data-dirty', 'true');
    expect(escapeFrom(dirty)).toBe(true);
    expect(escapeFrom(document.createElement('input'))).toBe(false);
  });
});

describe('useEditedEntity', () => {
  it('runs each save on the result of the last', async () => {
    const { result } = renderHook(() => useEditedEntity<{ n: number }>(undefined));
    await act(async () => {
      void result.current.apply(async () => ({ n: 1 }));
      await result.current.apply(async (current) => ({ n: (current?.n ?? 0) + 1 }));
    });
    expect(result.current.entity).toEqual({ n: 2 });
  });
});
