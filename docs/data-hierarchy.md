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

The Dashboard is cross-Workspace by default, pre-filtered to the Context; Workspace, Project, Client, and Billable are filters over a navigable Range. Export turns the current view into a Report over that Range.
