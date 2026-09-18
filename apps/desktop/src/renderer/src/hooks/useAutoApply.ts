import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { messageOf } from '@/lib/messageOf';

/** A validation or save failure; `path[0]` names the field of a group it belongs to. */
export interface Issue {
  message: string;
  path?: readonly PropertyKey[] | undefined;
}

const DIRTY = 'data-dirty';

export const issuesOf = (schema: z.ZodType, value: unknown): Issue[] =>
  schema.safeParse(value).error?.issues ?? [];

export const trimmedEquals = (a: string, b: string) => a.trim() === b.trim();

/**
 * `onEscapeKeyDown` of an auto-apply editor: an Escape on a field holding an unsaved or invalid
 * value keeps the popover open, so the field reverts first and a second Escape closes.
 */
export function keepOpenOnDirtyEscape(event: KeyboardEvent): void {
  if (event.target instanceof Element && event.target.closest(`[${DIRTY}]`)) {
    event.preventDefault();
  }
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface AutoApplyOptions<T> {
  // The last saved value; a new one replaces a draft that was not edited away from the old one.
  saved: T;
  validate: (draft: T) => Issue[];
  save: (draft: T) => Promise<unknown>;
  equals?: ((a: T, b: T) => boolean) | undefined;
}

/**
 * The draft of one field, or of a group of fields that commit as a unit. `commit` validates and
 * saves a changed draft; invalid or failed drafts keep their issues and save nothing. A valid
 * unsaved draft is committed when the editor unmounts, like a blur.
 */
export function useAutoApply<T>({ saved, validate, save, equals = sameJson }: AutoApplyOptions<T>) {
  const [draft, setDraft] = useState(saved);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [base, setBase] = useState(saved);
  if (!equals(base, saved)) {
    setBase(saved);
    if (equals(draft, base) || equals(draft, saved)) setDraft(saved);
  }

  // `commit` and `revert` write the draft here ahead of the render, so an unmount in the same
  // event (a blur that closes the editor) sees the draft they set, not the one last rendered.
  const latest = useRef({ draft, saved, validate, save, equals });
  useLayoutEffect(() => {
    latest.current = { draft, saved, validate, save, equals };
  });
  // The value being saved, so a blur right after Enter does not save it twice.
  const inFlight = useRef<{ value: T } | null>(null);

  const commit = useCallback(async (value?: T): Promise<void> => {
    const { draft, saved, validate, save, equals } = latest.current;
    const next = value === undefined ? draft : value;
    if (value !== undefined) {
      latest.current.draft = next;
      setDraft(next);
    }
    if (equals(next, saved) || (inFlight.current && equals(next, inFlight.current.value))) {
      setIssues([]);
      return;
    }
    const invalid = validate(next);
    setIssues(invalid);
    if (invalid.length > 0) return;
    inFlight.current = { value: next };
    try {
      await save(next);
    } catch (error) {
      setIssues([{ message: messageOf(error) }]);
    } finally {
      inFlight.current = null;
    }
  }, []);

  // With a key, reverts that field of a group only.
  const revert = useCallback((key?: keyof T) => {
    const { draft, saved } = latest.current;
    const next = key === undefined ? saved : { ...draft, [key]: saved[key] };
    latest.current.draft = next;
    setDraft(next);
    setIssues(
      key === undefined ? [] : (current) => current.filter((issue) => issue.path?.[0] !== key),
    );
  }, []);

  useEffect(
    () => () => {
      const { draft, saved, validate, equals } = latest.current;
      if (!equals(draft, saved) && validate(draft).length === 0) void commit();
    },
    [commit],
  );

  const dirty = !equals(draft, saved) || issues.length > 0;
  return { draft, saved, setDraft, issues, dirty, commit, revert };
}

export type AutoApply<T> = ReturnType<typeof useAutoApply<T>>;

/**
 * The entity an auto-apply editor edits, absent until its Name creates it. Saves run one at a
 * time, each on the result of the last, so quick commits of two fields never overwrite each other.
 */
export function useEditedEntity<E>(initial: E | undefined) {
  const [entity, setEntity] = useState(initial);
  const latest = useRef(initial);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const apply = useCallback((run: (current: E | undefined) => Promise<E>): Promise<E> => {
    const next = queue.current.then(async () => {
      const result = await run(latest.current);
      latest.current = result;
      setEntity(result);
      return result;
    });
    queue.current = next.catch(() => {});
    return next;
  }, []);

  return { entity, apply };
}

/** Props of a text input bound to a single-value field: Enter or blur commits, Escape reverts. */
export function textInputProps(field: AutoApply<string>) {
  return {
    value: field.draft,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => field.setDraft(event.target.value),
    onBlur: () => void field.commit(),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') void field.commit();
      if (event.key === 'Escape') field.revert();
    },
    errors: field.issues,
    [DIRTY]: field.dirty || undefined,
  };
}

/** Props of a text input for one key of a group; the group commits elsewhere, as a unit. */
export function groupInputProps<T extends Record<string, string>>(
  group: AutoApply<T>,
  key: keyof T & string,
) {
  const errors = group.issues.filter((issue) => issue.path?.[0] === key);
  return {
    value: group.draft[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      group.setDraft({ ...group.draft, [key]: event.target.value }),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') group.revert(key);
    },
    errors,
    [DIRTY]: group.draft[key] !== group.saved[key] || errors.length > 0 || undefined,
  };
}
