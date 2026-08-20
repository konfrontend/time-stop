# Toggl Track feature analysis

Research for [GEM-103](https://linear.app/gembag/issue/GEM-103). Question: what does Toggl Track actually offer (feature map, core concepts, reports, team/permission model), and which ideas should Time Stop adopt, avoid, or ignore given its goals — dogfood Toggl replacement for a solo dev + his AI agents, agents-as-teammates, purpose-agnostic core.

All facts from toggl.com / support.toggl.com / engineering.toggl.com (fetched 2026-08-20). Sources at the bottom.

## Plan naming note

There is **no "Pro" plan**. Current plans: **Free**, **Starter** ($9/user/mo), **Premium** ($14–18/user/mo), **Enterprise** (custom). The ticket's "Pro plan as reference" is best read as **Starter + Premium** — that tier pair covers billable rates, project estimates, tasks, approvals, and full reporting. This doc marks plan gates where they matter.

## Core concepts & data model

Hierarchy (from the official data-structure doc):

```
Organization            ← subscription, org users, user groups; Enterprise allows multiple workspaces
└── Workspace           ← everything operational lives here
    ├── Clients         ← flat list; one client ↔ many projects
    ├── Projects        ← primary categorization unit; at most one client per project
    │   └── Tasks       ← "sub-projects", paid feature; a task belongs to exactly one project
    ├── Tags            ← workspace-level labels, many-to-many with time entries
    └── Time Entries    ← the actual tracked time
```

Key terms:

- **Time entry** — the atomic record: start, stop, duration, description, optional project/task, tags, `billable` flag, owner (user). Reaches a client only *indirectly* via its project. A **running** entry has no stop time; in the API it's represented by a **negative duration** (seconds since epoch of start), and `GET /api/v9/me/time_entries/current` returns it. One running entry per user at a time.
- **Project** — where most policy hangs: billable rates, estimates, alerts, members, privacy (public/private), color. Optional per entry.
- **Client** — pure grouping of projects for reporting/invoicing. No direct time-entry link.
- **Task** — optional sub-division of a project (Starter+). Single-project.
- **Tag** — freeform cross-cutting metadata on entries; canonical use case is marking entries "invoiced/billed".
- **Billable** — boolean per entry; **billable rates** can be set at 5 levels: workspace, team member, project, project member, task (most specific wins).
- **Workspace** — container for all of the above; **Organization** above it holds subscription, users, groups.

## Feature inventory

### Time capture

| Feature | Notes |
|---|---|
| Timer mode + manual mode | Start/stop live, or add/edit time after the fact |
| One-click timer everywhere | Web, desktop (Win/mac), mobile (iOS/Android), browser extensions |
| Offline tracking | Track offline, sync later |
| Calendar view + Google/Outlook calendar integration | See entries on a calendar; turn calendar events into entries |
| Autotracker / Timeline | Desktop app records app/browser activity, suggests entries |
| Idle detection | Desktop app catches away-from-keyboard time |
| Pomodoro timer, tracking reminders, personal goals | Free-plan personal-productivity extras |

### Projects & billing

| Feature | Plan | Notes |
|---|---|---|
| Billable rates (5 levels) | Starter+ | Workspace → member → project → project member → task |
| Project time estimates + alerts | Starter+ | Alert admins at N% of estimate |
| Project tasks | Starter+ | |
| Fixed-fee projects | Premium | |
| Profitability analysis (rates vs labor cost) | Premium | |
| Project dashboard / forecasts | Starter+ | Timelines, budgets, progress |

### Reports

Current reporting UX is tabbed: **Summary, Detailed, Workload, Profitability, My Reports**.

- **Summary** — aggregation of tracked time, grouped/subgrouped by project/client/member/tag/etc., over a date range.
- **Detailed** — every individual entry; the review-and-export view (CSV/PDF).
- **Workload** (ex-"Weekly") — per-member timesheet-style grid, custom date ranges.
- **Profitability** (ex-"Insights", Premium) — revenue vs cost by member/project/client.
- **Saved reports** — persist a filter set; shareable via public link even to people without an account.
- **Scheduled reports** (Premium) — email daily/weekly/monthly to org members.
- **My Reports / Analytics** (Premium) — fully custom charts/reports.

### Data accuracy (Premium)

- **Required fields** — admin makes e.g. project mandatory on entries.
- **Lock time entries** — no creating/editing entries before a lock date.
- **Time audit** — surface suspicious entries (no project/task, <1 min, etc.).
- **Timesheet approvals** — period-grouped entries become submittable timesheets with approve/reject + audit log.

### Team & permission model

Roles (from the access-rights doc):

| Role | Scope | Powers |
|---|---|---|
| Organization Admin | org | Everything + org users, user groups, subscription |
| Workspace Admin | workspace | All settings, all projects/clients, view/edit/delete anyone's entries, rates |
| Project Lead (Premium) | workspace | Manage all projects/clients/tags; reports only for own projects; no export/integrations |
| Analyst (Premium) | workspace | View all entries + all reports; no create/edit |
| Project Manager | project | Auto-granted to project creator; add members, see all project time, project dashboard |
| Team Lead | team | Additive: view/edit team members' entries, approve time off |
| Workspace User (member) | own data | Track own time, own reports; may create projects/clients/tags if settings allow |

Plus **user groups** (org level) for bulk project assignment and report filtering.

### Platform & API

- **API v9** (`api.track.toggl.com/api/v9`) — full CRUD on time entries, projects, clients, tags, tasks, workspaces; `me/time_entries/current` for the running timer; entries carry a `created_with` attribution field. Rate-limited by plan (Starter 240 req/h, Premium 600 req/h).
- **Webhooks API** — event notifications, documented at engineering.toggl.com.
- **100+ integrations** via browser extensions (start timer from Jira/GitHub/etc.); native Slack (Starter), Jira/Salesforce (Premium).
- **SSO** (Premium), CSV import (admins).

## Adopt / avoid / ignore for Time Stop

Context: solo dev + AI agents on a self-hosted instance; agents are first-class teammates tracking their own time; core stays purpose-agnostic (RBAC, not hardcoded org shapes).

### Adopt

| Area | Why |
|---|---|
| **Data model: workspace → {client, project → task, tag} + time entry** | Battle-tested, minimal, purpose-agnostic. Keep exact Toggl semantics: entry belongs to a user, project optional, client only via project, tags many-to-many, one task-per-project. Reusing Toggl's vocabulary keeps migration and mental model free. |
| **Time entry semantics: timer + manual, one running entry per actor, stop-less = running** | Core of the product. "One running entry per actor" generalizes cleanly to agents (each agent = actor with its own running timer). |
| **`billable` flag on entries + `invoiced` via tags** | Cheap, useful for the dogfood freelance case; a boolean doesn't pollute the purpose-agnostic core. |
| **Summary + Detailed reports, CSV export** | The two reports that carry 90% of value. Group/subgroup + date-range filters. |
| **Saved reports (persisted filter sets)** | Low cost, high leverage; a natural fit for "what did agent X do this week". |
| **API-first with `created_with` attribution + per-actor API tokens** | This is *how* agents track time. Toggl's own API shape (v9 time entries, `/me/time_entries/current`) is a good reference contract; attribution field maps directly to agent identity/tooling. |
| **Webhooks** | Cheap once API exists; lets agents/automation react to time events. |
| **Required fields + lock time entries (as simple workspace policies)** | Data-accuracy knobs that keep agent-written data trustworthy; trivial to implement, purpose-agnostic. |

### Adopt, adapted

| Area | Adaptation |
|---|---|
| **Permission model** | Don't copy the 6-role matrix. Express Toggl's roles as *presets* over Time Stop's RBAC: owner/admin ≈ workspace admin; agent ≈ member scoped to writing its own entries (+ read of projects/tags); read-only reporting role ≈ analyst. Agents-as-teammates means agents are ordinary users in the model, with RBAC narrowing what they can touch. |
| **Organization / multi-workspace** | Keep **workspace** as the top operational container; skip the Organization layer (it exists for subscriptions/enterprise). Single workspace default; don't hardcode against adding more later. |
| **Billable rates** | 5-level rate resolution is over-engineered for v1. Start with project-level rate (maybe workspace default); the resolution-order pattern is worth copying if/when more levels are needed. |
| **Workload report** | Per-member grid is exactly the "what did my agents do" view — but frame it per-actor, not per-employee. Later, not v1. |

### Ignore (not wrong, just not for Time Stop now)

- **Timesheet approvals** — approval workflow presumes manager/report hierarchy; solo instance has none. Revisit only if agent-output review ever wants a workflow.
- **Profitability / fixed-fee / labor costs** — employee-cost accounting; irrelevant solo.
- **Scheduled email reports, SSO, Slack/Jira/Salesforce integrations, 100+ browser-extension integrations** — SaaS distribution features, not core value.
- **Autotracker/Timeline + idle detection** — needs native desktop agents; PWA can't do it. Agents self-report instead.
- **Pomodoro, personal goals, reminders** — personal-productivity garnish; fine as far-future extras.
- **User groups, teams, time off** — team-scale HR machinery.
- **CSV import** — until a Toggl-export migration is actually needed for dogfooding (then it's a one-off script, not a feature).

### Avoid

- **Role/plan entanglement** — half of Toggl's model (Project Lead, Analyst, approvals, locks) exists to sell Premium. Baking role names into code the way Toggl gates them would fight the purpose-agnostic RBAC core.
- **Negative-duration encoding for running timers** — an infamous API wart (duration = negative epoch seconds). Model running as `stop IS NULL`; keep durations derived, never sentinel-valued.
- **Client as a first-class billing chain requirement** — keep client optional grouping only, as Toggl does; don't be tempted to attach entries to clients directly (Toggl deliberately forbids it, and it keeps reporting unambiguous).

## Sources

- [Toggl Track pricing](https://toggl.com/track/pricing/)
- [Toggl Track features](https://toggl.com/track/features/)
- [Toggl Track vocabulary](https://support.toggl.com/toggl-track-vocabulary)
- [Data structure in Toggl Track](https://support.toggl.com/en-us/article/data-structure-in-toggl-track-14d14io/)
- [Access rights and privileges](https://support.toggl.com/access-rights-and-privileges)
- [Summary report](https://support.toggl.com/summary-report)
- [New reports FAQ](https://support.toggl.com/new-reports-faqs-to-help-you-prepare)
- [Time audits](https://support.toggl.com/time-audits)
- [Overview of timesheet approvals](https://support.toggl.com/overview-of-timesheet-approvals)
- [Starter vs Premium differences](https://support.toggl.com/what-are-the-differences-between-starter-and-premium)
- [Toggl Track API docs (engineering.toggl.com)](https://engineering.toggl.com/docs/track/)
- [Time entries API](https://engineering.toggl.com/docs/track/api/time_entries/)
