---
status: accepted
---

# Money is derived, and the Rate is live

A Record stores no Rate and no Billable flag. Rate, Billable and Amount are derived on read from the Record's Project and its Workspace's Currency, by one pure money module in `packages/domain` that the Dashboard, its totals and the Report all use. The Rate is live: editing a Project's Rate re-prices every Record of that Project, past ones included.

## Considered options

- **Frozen Rate, snapshotted onto the Record at creation** (the previous design) — rejected. It needs a stored value, which brings back the smear the change removes: a snapshot rule on placement, a re-snapshot on moving a Record, a stale value when a Project's Rate is corrected, and a per-Record Billable flag that can disagree with the Rate. Three answers to "what is this Record worth" and no locality.
- **Per-Record Billable flag with a derived Rate** — rejected. A flag that mostly mirrors "the Project has a Rate" adds a toggle, an api method, a column in both schemas and a filter special case for one real use: marking a paid Project's Record as unpaid. That is an override, and overrides are v2.
- **No money in v1** — rejected. Paid client work is the first use case in `CONTEXT.md`, and the derivation is a few lines.

## Consequences

- A Rate correction is retroactive. Invoiced history is protected by the Report, not the database: an exported CSV is the frozen record of what was billed.
- A Workspace without a Currency has no Billable Records and no Amounts, even when its Projects carry a Rate.
- Overrides (per Record or per Project, of Rate, Billable or Currency) are v2 and live in their own `overrides` table keyed by the entity they override, resolved inside the money module. Nothing is added to `records` for them.
- `TimeStopApi` loses `setRecordBillable` and the `billable` field on `createRecord` and `updateRecord`; the Toggl import drops Toggl's per-entry Billable flag.
