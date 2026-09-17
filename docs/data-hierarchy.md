# Data hierarchy

Relationships and rules between the terms in `CONTEXT.md`. Conceptual only — no schema.

## Containment

```
Actor
└── Workspace (many per Actor; one default seeded per install)
    ├── Client   (many per Workspace)
    ├── Project  (many per Workspace)
    └── Record   (many per Workspace)
```

A Record needs no Project, and a Project needs no Client. Neither reference is required to start tracking.

- A Workspace carries a Name, a color and an optional Currency. A Workspace or Project created in the app starts on a color drawn at random, repickable at any time; the seeded default Workspace and an imported one take the fixed default color.
- A Project belongs to exactly one Workspace and may reference one Client from the same Workspace. Both are editable: a Project can be moved to another Workspace, and then its Records move with it and its Client is dropped (the Client stays in the old Workspace). Archived Projects move too. Moving is for correcting a misplaced Project; money is not frozen by it (see Money).
- A Record belongs to exactly one Workspace and exactly one Actor. With a Project, the Workspace is the Project's — not set independently, and it follows the Project when the Project moves. A Record may be reassigned to a Project in another Workspace; it moves there. The default Workspace catches Records with no Project, so none is orphaned.
- A Record reaches its Client only through its Project; Clients are never attached to Records directly.
- v1 has one Actor per install, holding the Owner Role.

## Creating a Record

- Own properties: Name (optional), start, stop (absent while running), Workspace, Project (optional), Actor. A Record carries no money of its own.
- A Record is created with an explicit Workspace and optional Project; the Project must belong to that Workspace. The Tracker's Timer and manual entry fill both in from the Context. Name may be filled in later.
- At launch, an empty Context Project takes the Project of the most recent Record in the Context's Workspace, skipping Records without a Project or on an Archived one. A Project chosen as none during a session stays none until the next launch.
- At most one Timer per Actor; starting a new one stops the running one.
- An Archived Project is hidden from pickers and accepts no new Records; existing Records stay. Archiving is reversible.

## Reading a Record

Derived on read, never stored: Duration (stop − start), Rate, Billable, Amount, Client.

## Planning

Limits hold an optional Min and an optional Max; neither is enforced — shown as used vs Limits. Period is calendar-aligned; weeks start Monday. Usage is the sum of Durations of the Project's Records within the Period.

## Money

Money is derived from a Record's Project and Workspace; the Record stores none of it. One money module answers Rate, Billable and Amount for a (Project, Currency) pair, and the Dashboard, its totals and the Report all ask it.

- Rate is the Project's, live: editing it re-prices every Record of the Project, past ones included. Moving a Record to another Project prices it by the new one; moving a Project to another Workspace prices its Records under that Workspace's Currency. Nothing is frozen by a move — a move corrects placement, and the exported Report is the frozen history. See ADR-0002.
- Billable is true iff the Project has a Rate and the Workspace a Currency. There is no flag; the Dashboard's Billable filter and the Report's Billable column read the same derivation.
- Amount = Rate × Duration in fractional hours, only for a Billable Record.
- Currency is an optional free-form label per Workspace (USD, EUR, USDT…); no per-Project override, no conversion, no default: each Workspace is given its Currency when created or edited. A Workspace without a Currency has no Billable Records and no Amounts. Totals across Currencies are shown per Currency. Rounding is a Dashboard option the Report inherits.
- Per-Record or per-Project overrides of Rate, Billable or Currency are v2, as a separate `overrides` table keyed by the entity they override, never as columns on the Record. The money module is the one place they would plug into.

## Viewing

The Dashboard shows the Context's Workspace; the header's Workspace switcher moves it. Project (one or none) and Billable are filters over a navigable Range; Client is not a filter. Rounding is a view option. Default Range is the current month; rows list by start, newest first, grouped by day. Filters, Range and Rounding live in the URL; there are no saved views. Rounding applies live to each Record's Duration, the day hours, the totals and the Amounts; Limits usage stays unrounded. The totals bar shows total hours, Billable hours, and Amount per Currency for the current view, counting the running Timer. Export sits with the Range it covers and turns the current view into a Report over that Range, Rounding included.

## Reports

One Report, one format: a CSV of the current Dashboard view.

- Stopped Records only; the Timer is excluded.
- Header rows (Project, Client, Currency, Rate, Limits, Range, Rounding) describe the Projects the Report covers; no Workspace name appears anywhere. Rate is the Project's hourly Rate and Limits its Limits as the Settings Project editor summarises them, both blank when unset, both listed one per Project when the view holds several. Then a blank line, then one row per Record (Date, Start, Stop, Name, Billable, Hours, Rate, Amount) sorted by Project then start, then a Total row and a Billable row. Several Projects add a Project column and list them in the header; several Currencies yield one Total/Billable pair per Currency.
- Hours are decimal; Amount is shown to 2 decimals. Non-Billable Records keep Amount blank.
- Rounding is the Dashboard's, default none; v1 offers nearest 15 and 30 minutes. Applied per Record to Duration; Amount = Rate × rounded Duration. Plain nearest: 7 minutes rounds to 0, and 0 stays 0.
- Filename: `<project>_<from>_<to>.csv`, falling through Project → Client → `all` when no single value applies.
- The CSV starts with a UTF-8 BOM and uses CRLF line endings on every platform, so Excel on Windows shows non-ASCII Names correctly.
- Export asks the API for the Report (`exportReport`): the Dashboard view plus Rounding in, filename and CSV out. The client never builds CSV.

## Storage and sync

v1 is local-first: the desktop app is the source of truth and works fully offline; the Server only mirrors it.

- Every Install keeps all data locally. Reads never go to the Server.
- Every mutation also appends a Change (what entity, which id, create/update/delete, the new values, when, by which Actor and Install). Deletes are Changes too, so they survive replay.
- Ids and timestamps are assigned by the Install that makes the change; the Server assigns nothing and records no receipt time.
- The Install pushes unsent Changes after each commit and retries until they land. The Server applies them in order and never sends data back in v1.
- If two Installs ever change the same Record, the later `updatedAt` wins for the whole Record.
- A Timer is stored the moment it starts — a Record without a stop — so a crash loses nothing. A Timer never outlives the app: quitting stops it, and a Timer found on the next launch (after a crash or kill) is stopped at its last known `updatedAt`.
- A second Install for the same Actor, Server-to-Install sync, and anyone other than the Owner reading the Server are v2.

## Authentication

The push is authenticated by a per-Install Token; there is no login and no session.

- A Token is minted by a CLI command on the Server and shown once; the Server keeps only its hash. It never expires.
- The Install generates its own `installId` and `actorId` on first launch, before any Server exists.
- A Token starts unbound. The first push it authenticates binds it to that push's Install and Actor; every later push must present the same pair.
- A push with a wrong or revoked Token, or a bound Token presented with a different Install or Actor, is rejected. The Install stops pushing and says so; Changes keep queueing locally until the Owner replaces the Token. Network and Server errors, by contrast, are retried indefinitely.
- Rotation is manual: revoke via the CLI, mint a new Token, paste it into Settings.
- The Server keeps no Actor records in v1; `actorId` on a Change is stored uninterpreted.
