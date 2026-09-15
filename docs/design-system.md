# Design system

UI patterns of the desktop app. Components live in `apps/desktop/src/renderer/src/components/ui`; prefer extending a shadcn component there over writing a new one. Domain terms stay in `CONTEXT.md`.

## Ghost editable element

Every editable element has no border and no resting fill. The ghost fill — the same one as `Button` `variant="ghost"` — shows on hover, on focus, and while the element is open (`data-state=open`).

- `Input` and `SelectTrigger` have this look in their base styles. Every usage gets it; there is no opt-in variant.
- A button that opens a picker (`DatePicker`, `ProjectCombobox`, the Dashboard "Move to…") uses `variant="ghost"`. Inside a form, give it the Input's height: `h-9 justify-between font-normal`.
- An invalid element (`aria-invalid`) shows a 2px destructive line along its bottom edge instead of a border. `ghostStates` in `button.tsx` holds the fill and this line for the ghost `Button`, `Input` and `SelectTrigger`.

## Editor popover dim

An editor is a popover that holds a form: `RecordPopover`, the `ItemList` new and row editors, `ImportPopover`. It passes `overlay` to `PopoverContent`, which puts a `bg-black/20` backdrop below the content. A click on the backdrop dismisses the editor.

- Pickers, menus, `ConfirmPopover` and `Aspect` sub-popovers do not dim.
- Editors stay popovers anchored to what opened them; they do not become a Dialog.
- An editor opened from inside another popover (Recent Records → `RecordPopover` in the compact Tracker) dims above the parent. A backdrop click dismisses the editor only.

## Auto-apply editor

An editor without Save or Cancel: every change applies on its own. The Settings Workspace, Client and Project editors work this way. `useAutoApply` holds the draft of one field, or of a group of fields that commit together.

- Commit points:
  - A text field (Name, Currency, Rate) commits on Enter or blur. A Select (Client) commits when picked.
  - Fields folded behind one `Aspect` (Limits, Dates) commit as a unit when the `Aspect` closes, so cross-field rules check the whole group.
  - A color commits when its picker closes, not on every change.
  - An unchanged value does not save.
  - Closing the editor (a backdrop click, say) commits a valid unsaved text value, like a blur would.
- Create: the editor opens empty with Name focused. A non-empty Name creates the entity on Enter or blur, and the editor stays open to edit it. Other fields are disabled until then. Closing with an empty Name creates nothing.
- Invalid input or a failed save: the field (or its `Aspect`) shows the error and nothing saves. Closing the editor reverts it to the last saved value.
- Escape: the first reverts the focused field (`keepOpenOnDirtyEscape` keeps the popover open). The second closes the editor. Applied values stay; there is no undo.
- A change with a wide effect, such as moving a Project to another Workspace, asks in a `ConfirmPopover` first. Cancel restores the field.
- The footer holds only the trash `DangerPopover`, right-aligned.

## Item list

Entities in Settings render as shadcn `Item` `variant="muted"` rows in a gapped `ItemGroup`, with no borders or dividers (`ItemList`, `ItemRow`). A row fills with `bg-accent` on hover, on focus and while its editor is open.

- A section heading is a `Collapsible` trigger; every section starts expanded, and collapse state lives only as long as the page.
- An empty section shows `Empty` instead of the rows and the `+`: "[parent] has no [entity type]." with a "Create New [entity type]" button that opens the same editor as `+`.

## Inline input

Edits one text value in place, like the Dashboard Record Name.

- At rest: plain text with `hover:bg-muted` and `focus-visible:bg-muted`.
- Editing: a borderless input on `bg-accent`, at the same size as the text.
- Enter or blur saves. Escape cancels.
- The Tracker `NameField` is always an input: `bg-muted` on hover, `bg-accent` on focus, no underline.
- A Record without a Name shows the muted placeholder "Untitled record" (`UNTITLED_RECORD`), at rest and while editing.
- The Dashboard start and stop clocks are inline `TimePicker`s. The input takes exactly the box of the clock at rest. An invalid clock only turns `text-destructive`, with its message in a `Tooltip`; it has no bottom line.

## Hover-reveal action

A secondary action on a row or a heading, such as the `ItemRow` aside, the `ItemList` `+` (revealed by the whole section, heading and rows) or the Dashboard day-row `+`.

- Invisible at rest.
- Visible while its parent is hovered or has focus inside.
- Stays visible while what it opened is open: its popover, or the inline input of the day-row `+`'s new Record.

## Palette icons

Icons are Streamline Ultimate Color, compiled in by `unplugin-icons`. Import each one where it is used: `~icons/streamline-ultimate-color/<name>`.

- Icons keep their own colors and ignore `currentColor`. Do not put `text-*`, `fill-*` or `opacity-*` on an icon; set only its size.
- A dropdown indicator is `arrow-button-up` with `rotate-180`, the one transform an icon takes.
- A pressed toggle shows state through its `bg-accent` background, not through the icon.
- Icons themselves never get a background.
- An icon-only button uses `Button` `variant="ghost-icon"`: the ghost fill, always visible on the dark theme. A pressed one uses `dark:bg-accent`.
- A standalone status icon (Billable gem, Sync) sits in a wrapper with `rounded-md dark:bg-accent/50`.
- Icons inside menus, selects, checkboxes and labeled buttons get no fill.
