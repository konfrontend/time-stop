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

- A Project belongs to exactly one Workspace and may reference one Client from the same Workspace.
- A Record belongs to exactly one Workspace and exactly one Actor. With a Project, the Workspace is the Project's — not set independently. The default Workspace catches Records with no Project, so none is orphaned.
- A Record reaches its Client only through its Project; Clients are never attached to Records directly.
- v1 has one Actor per install, holding the Owner Role.

## Creating a Record

- Own properties: Name (optional), start, stop (absent while running), Workspace, Project (optional), Billable.
- Starting a Timer or entering a Record by hand inherits Workspace and Project from the Context. Name may be filled in later.
- Rate is copied from the Project at creation and frozen; no per-Record override in v1.
- Billable defaults to true when the Project has a Rate, otherwise false; editable per Record. Without a Rate the flag stays visible but unobtrusive.
- At most one Timer per Actor; starting a new one stops the running one.
- An Archived Project is hidden from pickers and accepts no new Records; existing Records stay. Archiving is reversible.

## Reading a Record

Derived on read, never stored: Duration (stop − start), Amount, Overlap, Client.
Overlaps are allowed and flagged.

## Planning

Limits hold an optional Min and an optional Max; neither is enforced — shown as used vs Limits. Period is calendar-aligned; weeks start Monday. Usage is the sum of Durations of the Project's Records within the Period.

## Money

Amount = Rate × Duration in fractional hours. Currency is set per Workspace; no per-Project override, no conversion. Totals across Currencies are shown per Currency. Rounding rules belong to Reports.

## Viewing

The Dashboard is cross-Workspace by default, pre-filtered to the Context; Workspace, Project, Client, and Billable are filters over a navigable Range. Default Range is the current month. Filters and Range live in the URL; there are no saved views. The totals bar shows total hours, Billable hours, and Amount per Currency for the current view, counting the running Timer. Export turns the current view into a Report over that Range.

## Reports

One Report, one format: a CSV of the current Dashboard view.

- Stopped Records only; the Timer is excluded. Overlaps and Limits are not shown.
- Header rows (Project, Client, Range, Rounding, Currency), a blank line, then one row per Record (Date, Start, Stop, Name, Billable, Hours, Rate, Amount) sorted by Project then start, then a Total row and a Billable row. Several Projects add a Project column and list them in the header; several Currencies yield one Total/Billable pair per Currency.
- Hours are decimal; Amount is shown to 2 decimals. Non-Billable Records keep Amount blank.
- Rounding is chosen at Export, default none; v1 offers nearest 15 minutes. Applied per Record to Duration; Amount = Rate × rounded Duration. Plain nearest: 7 minutes rounds to 0, and 0 stays 0.
- Filename: `<project>_<from>_<to>.csv`, falling through Project → Client → Workspace → `all` when no single value applies.

## Storage and sync

v1 is local-first: the desktop app is the source of truth and works fully offline; the Server only mirrors it.

- Every Install keeps all data locally. Reads never go to the Server.
- Every mutation also appends a Change (what entity, which id, create/update/delete, the new values, when, by which Actor and Install). Deletes are Changes too, so they survive replay.
- Ids and timestamps are assigned by the Install that makes the change; the Server assigns nothing and records no receipt time.
- The Install pushes unsent Changes after each commit and retries until they land. The Server applies them in order and never sends data back in v1.
- If two Installs ever change the same Record, the later `updatedAt` wins for the whole Record.
- A Timer is stored the moment it starts — a Record without a stop — so a crash loses nothing.
- A second Install for the same Actor, Server-to-Install sync, and anyone other than the Owner reading the Server are v2.
