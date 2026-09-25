# Renderer Tests

Vitest + jsdom suites beside the renderer code in `apps/desktop/src/renderer/src`. A view is
redesigned far more often than its behaviour changes, so a test is held to what only it can prove,
and every behaviour is asserted in one place.

## What earns a test

- **Pure logic** in `lib/`: parsing, formatting, form rules (`recordForm`, `projectForm`),
  grouping, sorting.
- **A generic module**, tested bare at its own interface: props in, callbacks out, no harness, no
  QueryClient. Generic means reused, or a building block a view assembles: the custom modules in
  `components/ui/`, `hooks/useAutoApply`, and the record-level modules (`RecordSpan`, `RecordName`,
  `TimerDial`).
- **A view's wiring**: that an edit in the view reaches `Api` as the right write, and
  logic written in the view itself (grouping, focus, what a confirm guards). Rendered through
  `harness()` + `renderWith`.

Nothing else. A view test does not assert copy, placeholders, tooltips, styles, `data-*` styling
hooks, element order, or where a control sits on the page.

## One home per rule

- A form rule (stop before start, keep the seconds of an unedited clock, Limits cross-field) is
  tested in `lib/*Form.test.ts` only.
- A domain rule (Billable needs a Rate and a Currency, a moved Project drops its Client, the
  Dashboard Range) is tested in `packages/domain` or `packages/db` only.
- A generic module's behaviour (Enter commits, Escape reverts, the color commits on close, a
  failed save shows on the field) is tested in that module's own suite only.

A view test that sees one of these happen is not the place to assert it.

## Wiring assertions

Read the effect back through the harness: the renamed Client in `h.api.client.list()`, not a spy's
call arguments. Spy only where the effect leaves no state to read (the `desktop` seam, a Token the
main process never returns), to prove a write did not happen, or to force a failure.

## Selectors

- In a view test, scope to a `data-slot`, then query by role or label inside it. A label alone
  matches a substring of the accessible name anywhere on the page; a sentence of copy is not a
  contract.
- In a generic module test, role and accessible name: the module owns its `aria-label`.
