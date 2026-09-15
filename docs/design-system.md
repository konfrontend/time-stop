# Design system

UI patterns of the desktop app. Components live in `apps/desktop/src/renderer/src/components/ui`; prefer extending a shadcn component there over writing a new one. Domain terms stay in `CONTEXT.md`.

## Ghost editable element

Every editable element has no border and no resting fill. The ghost fill — the same one as `Button` `variant="ghost"` — shows on hover, on focus, and while the element is open (`data-state=open`).

- `Input` and `SelectTrigger` have this look in their base styles. Every usage gets it; there is no opt-in variant.
- A button that opens a picker (`DatePicker`, `ProjectCombobox`, the Dashboard "Move to…") uses `variant="ghost"`. Inside a form, give it the Input's height: `h-9 justify-between font-normal`.
- An invalid element (`aria-invalid`) shows a 2px destructive line along its bottom edge instead of a border. `ghostStates` in `button.tsx` holds the fill and this line for the ghost `Button`, `Input` and `SelectTrigger`.
- A component may override `Input` on purpose and keep its own look, such as the Tracker `NameField` underline. It then also resets the ghost fill.

## Editor popover dim

An editor is a popover that holds a form: `RecordPopover`, the `ItemList` new and row forms, `ImportPopover`. It passes `overlay` to `PopoverContent`, which puts a `bg-black/20` backdrop below the content. A click on the backdrop dismisses the editor.

- Pickers, menus, `ConfirmPopover` and `Aspect` sub-popovers do not dim.
- Editors stay popovers anchored to what opened them; they do not become a Dialog.
- An editor opened from inside another popover (Recent Records → `RecordPopover` in the compact Tracker) dims above the parent. A backdrop click dismisses the editor only.

## Inline input

Edits one text value in place, like the Dashboard Record Name.

- At rest: plain text with `hover:bg-muted` and `focus-visible:bg-muted`.
- Editing: a borderless input on `bg-accent`, at the same size as the text.
- Enter or blur saves. Escape cancels.

## Hover-reveal action

A secondary action on a row or a heading, such as the `ItemRow` aside or the Dashboard day-row `+`.

- Invisible at rest.
- Visible while its parent is hovered or has focus inside.
- Stays visible while the popover it opened is open.
