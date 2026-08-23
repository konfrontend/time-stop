# Time Stop

Self-hosted time tracking for a freelancer: timers and time records organized by project, with billing-aware reports. Seeded from the v1 scope decision; the terminology ticket refines it.

## Language

**Organization**:
The top-level container owning all clients, projects, and records. One currency per organization.
_Avoid_: Workspace, team, tenant

**Client**:
A named party that projects are done for. Groups projects for reporting; never linked to records directly.
_Avoid_: Customer, account

**Project**:
The primary unit records are organized by. Carries pricing, allowance, client, start/end dates, color, and an archived flag.

**Pricing**:
How a project is charged: hourly (with a rate), fixed (with a total amount), or free (no billing).
_Avoid_: Paid/free project, billing type

**Rate**:
The hourly price on an hourly project. Snapshotted onto each record when the record is created.

**Allowance**:
The expected hours for a project per period (week or month, calendar-aligned, weeks start Monday). Informational: shown as used/allowance, never enforced.
_Avoid_: Budget, estimate, time frame, quota

**Period**:
A calendar week or calendar month over which an allowance is measured.

**Record**:
A single span of tracked time: start, stop, optional name, optional project, billable flag. Created by a timer or entered manually; overlaps allowed but flagged.
_Avoid_: Time entry, session, log

**Timer**:
A running record with no stop time. At most one running timer per organization in v1.

**Name**:
The free-text task label on a record.
_Avoid_: Description, task, title

**Billable**:
Per-record flag that the time counts toward billing. Defaults from the project's pricing; only records on hourly or fixed projects can be billable.
_Avoid_: Paid, invoiced

**Dashboard**:
The records view over a navigable date window with filters (billable, project, client) and totals. Exporting the current view produces a report.

**Report**:
A document exported from a dashboard view over a chosen range.
