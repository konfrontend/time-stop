# Design system

UI patterns of the desktop app. Components live in `apps/desktop/src/renderer/src/components/ui`; prefer extending a shadcn component there over writing a new one. Domain terms stay in `CONTEXT.md`.

## Card and shadow

A Settings section is a shadcn `Card`, whose default is `gap-3 p-3`: one per Workspace and one per General section. Shadow says how far a surface sits above the page and nothing else; nothing carries a shadow to look richer.

| Surface                               | Shadow                              | Why                                                                              |
| ------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| Card (Workspace, General section)     | `shadow-md shadow-black/5`          | Grouped on the page, lifted but quiet                                            |
| Popover, dropdown, select, menu       | `shadow-md`, `shadow-lg` for a menu | Floats over the page and must detach from it                                     |
| `Toggle`, checkbox, `outline` Button  | `shadow-xs`                         | shadcn's own hairline on a bordered control                                      |
| Input, `SelectTrigger`                | none                                | A resting fill carries the field; a shadow on top of it reads as a second border |
| Active `TabsTrigger`                  | `shadow-sm`                         | The raised one of the row                                                        |
| Item row, section heading, footer bar | none                                | In the page, not above it                                                        |

## Editable element

No editable element has a border. The ghost fill — the same one as `Button` `variant="ghost"` — shows on hover, on focus, and while the element is open (`data-state=open`). What differs is the resting state, which `Input` and `SelectTrigger` take as a `variant`:

- `subtle`, the default: rests on `bg-muted` (`subtleRest`). A field in a form reads as a field before it is touched, instead of hanging as loose text in the space of its label.
- `ghost`: rests transparent, for a value that sits inside a row or on a surface of its own — the `InlineInput` ghost variant, the Dashboard `TimePicker` clocks, the Tracker `NameField` on the dial face.
- A button that opens a picker (`DatePicker`, `ProjectCombobox`, the Dashboard "Move to…") uses `variant="ghost"`. Inside a form, give it the Input's height: `h-9 justify-between font-normal`.
- An invalid element (`aria-invalid`) shows a 2px destructive line along its bottom edge instead of a border. `ghostStates` in `button.tsx` holds the fill and this line for the ghost `Button`, `Input` and `SelectTrigger`.

## Editor popover dim

An editor is a popover that holds a form: `RecordPopover`, the `ItemList` new and row editors, `ImportPopover`. It passes `editor` to `PopoverContent`, which puts a `bg-black/20` backdrop below the content (`overlay`), caps the height at the window's and hands Escape to `keepOpenOnDirtyEscape`. A click on the backdrop dismisses the editor. Every popover keeps 8px from the window edge by default.

- Pickers, menus, `ConfirmPopover` and `Aspect` sub-popovers do not dim.
- Editors stay popovers anchored to what opened them; they do not become a Dialog.
- An editor opened from inside another popover dims above the parent. A backdrop click dismisses the editor only.

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

- A section heading is plain: the rows under it are always shown.
- A row whose only field is a Name edits it in place with `InlineInput` and has no popover editor; the `+` and the empty state's CTA add a row with its input open, and leaving it empty creates nothing. A row with more than a Name (a Project) keeps its `ItemRow` popover editor.
- An empty section shows `Empty` instead of the rows and the `+`: "[parent] has no [entity type]." with a "Create New [entity type]" button that opens the same editor as `+`.
- A Workspace is a `Card`, with its color, Name and Currency in the heading row and its own `Tabs` under it: Preferences, Clients, Projects. Preferences is the default and carries the rest of the Workspace editor inline; Clients and Projects each hold one item list. The open tab lives only as long as the page.
- The Workspace Name is an inline input in that heading row, not a field of the Preferences editor, and the color sits before it as a `ColorPicker`.

## Color

A Workspace and a Project each carry one color, picked from the platform's color picker.

- `ColorPicker` is the app's trigger everywhere: a circular swatch of the current color with a native `<input type="color">` under it, at rest in a row heading and as the trailing element of a Name field. The draft follows the open picker; the value saves when the picker closes.
- A new Workspace or Project starts on a color drawn at random from `PALETTE`, a dozen distinct hues. The editor shows it, so it can be repicked before or after the entity is saved.
- A color fills a shape rather than tinting text: the Workspace avatar in the header switcher, with the initials in the contrasting foreground `contrastOn` picks, and a small disc before a Project or Workspace name elsewhere.

## Inline input

Edits one text value in place, like the Dashboard Record Name.

- `InlineInput` is the app's implementation, and every inline-edited value is one: the Dashboard and Tracker Record Name, the Settings Workspace Name, the Settings Client Name.
- Every field draft, commit and revert comes from `useAutoApply`, the same hook as the auto-apply editors'; a module owns only how it displays. `InlineInput`, the Dashboard clocks and the running Timer's `NameField` are its callers. `TimePicker` holds no draft of its own: its text is the display of a value being normalised, and it settles through one `onCommit`.
- It is a shadcn `Input` with `inline`, which strips the field chrome — no ring, `h-auto`, the text size of its row — so it is an input at rest as much as while it is typed in, and it inherits the ghost states of every other editable element. There is no separate resting state to click into. The Dashboard clocks and the Tracker `NameField` pass `inline` through `TimePicker` and `Autocomplete`.
- Enter or blur saves the trimmed value. Escape gives the edit up. An unchanged value saves nothing.
- Its `ghost` and `subtle` variants are the `Input` variants above, passed straight through.
- The Tracker `NameField` is an `Autocomplete` over the same `Input`, on the dial face. Over a running Timer it is the primary foreground over its own translucent fills, and it saves while typing, after a pause, so it has no Escape.
- A Record without a Name shows the muted placeholder "Untitled record" (`UNTITLED_RECORD`).
- The Dashboard start and stop clocks are inline `TimePicker`s. The input takes exactly the box of the clock at rest. An invalid clock only turns `text-destructive`, with its message in a `Tooltip`; it has no bottom line. Enter on an invalid clock keeps it open; leaving drops the draft. One Escape reverts and closes.

## Hover-reveal action

A secondary action on a row or a heading, such as the `ItemRow` aside, the `ItemList` `+` (revealed by the whole section, heading and rows) or the Dashboard day-row `+`.

- Invisible at rest.
- Visible while its parent is hovered or has focus inside.
- Stays visible while what it opened is open: its popover, or the inline input of the day-row `+`'s new Record.
- The `reveal` utility in `globals.css` holds the rest state and the open state (`aria-expanded`, or `data-open` where nothing expands); the caller adds its parent's `group-hover/<name>:opacity-100 group-focus-within/<name>:opacity-100`.

## Palette icons

Icons are Streamline Ultimate Color, compiled in by `unplugin-icons`. Import each one where it is used: `~icons/streamline-ultimate-color/<name>`.

- Icons keep their own colors and ignore `currentColor`. Do not put `text-*`, `fill-*` or `opacity-*` on an icon; set only its size.
- A dropdown indicator is `arrow-button-up` with `rotate-180`, the one transform an icon takes.
- A pressed toggle shows state through its `bg-accent` background, not through the icon. `Button` fills a `ghost` or `ghost-icon` button carrying `aria-pressed`; the caller sets only the attribute.
- Icons themselves never get a background. The one exception is a glyph drawn without a disc of its own beside glyphs that have one: the dial's `controls-pause` sits on a `bg-primary-foreground` disc so it reads like play and fast-forward.
- An icon-only button is an `IconButton`: a `Button` `variant="ghost-icon"`, the ghost fill always visible on the dark theme, named by its `label` and carrying it as a `Tooltip`. `tooltip` replaces the Tooltip where it says more than the name.
- A written label and a `Tooltip` never sit on the same button: a button either reads its action (`variant="ghost"`, icon then text, as the Workspace trash reads "Delete") or shows it in a `Tooltip`.
- A standalone status icon (Sync) sits in a wrapper with `rounded-md dark:bg-accent/50`.
- Icons inside menus, selects, checkboxes and labeled buttons get no fill.
- Billable is the gold bars, `gold-bars`, everywhere it is marked: Tracker, Dashboard and Settings. It carries its own colour and needs no wrapper.
- `move-expand-vertical` is the expand icon: what unfolds in place (an activity's Records, the Recent Records list). The `arrow-button-up` arrow stays the dropdown indicator and never expands anything.

## Radial control

A modifier of the Tracker dial. A `Button` `variant="outline"` `size="icon"` sits on the ring, rounded full, and prints the value it holds outside the dial, at the same height.

- The button carries only its icon; its accessible name says what it modifies and what it holds ("Project: Website redesign").
- The value hangs on the side the button faces: Project at the upper left (−135°) prints to the left, Clear at the lower right (45°) to the right.
- A value too long to print is abbreviated, with the whole of it in a `Tooltip`; a missing one reads as muted italic "none".
- A control that has nothing to do is absent, not disabled.

## Column-header control

A control that modifies one column of a table sits in that column's header, after the label: the Dashboard's Billable toggle in Record, its Rounding picker in Time.

- The header is one flex row; the control follows the label and takes the column's own alignment.
- The control is an icon-only `Button` with `aria-pressed`, pressed while it holds anything but its default.
- What scopes the whole view — the Project filter, the Range — stays in the toolbar above the table, never in a header.
