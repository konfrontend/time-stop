# E2E Tests

Playwright-Electron specs in `apps/desktop/e2e`. They are slow, they run a real app, and a renaming
in the renderer breaks them for no gain, so they are held to what only a real launch can prove.

## What earns a spec

- Main-process behaviour: the tray, the Dock badge and taskbar overlay, the global hotkey, the
  window title, always-on-top, the window size, the session-end stop, the single-instance lock.
- Anything that crosses the process boundary or the disk: a Timer that must not outlive the app, a
  preference that must survive a relaunch, a native file dialog, the packaged build.

Renderer behaviour — what the dial draws, how a row edits, which state a control is in — belongs in
the vitest suites beside the component. Do not duplicate it here.

## Selectors

Address the renderer by `data-slot` only: `page.locator('[data-slot="timer-dial"]')`.

`getByRole` and `getByLabel` match a substring of the accessible name, so "Start" also finds "Edit
start" and "Name" also finds "Edit Name". A label the design changes is not a contract; a
`data-slot` is. Roles and labels stay fine for the shell's own chrome (menus, links) and inside a
`locator(...)` already scoped to one slot.

## CI

`e2e.yml` runs on a pull request into `master`, `continue-on-error`, so a broken selector reports
without stopping a branch. Windows runs `shell.spec.ts` alone — the rest would only fail twice for
one reason. A tag is still gated on the packaged run in `release.yml`.
