# Time Stop

Self-hosted time tracking for one person across everything they do — paid client work, personal projects, study, meditation. Glossary only; relationships and rules live in `docs/data-hierarchy.md`.

## Language

### Who

**Actor**:
An identity that tracks time. Humans now; agents later.
_Avoid_: User, principal, account, member

**Role**:
What an Actor is allowed to do.

**Owner**:
The Role with full permissions; the only Role in v1.
_Avoid_: Admin, member

### Where

**Workspace**:
A purpose-sized container (work, personal, education…) for Clients, Projects, and Records.
_Avoid_: Organization, team, tenant

**Context**:
The Workspace and optional Project currently selected in the UI.
_Avoid_: Scope, focus, selection

**Client**:
A named party that Projects are done for.
_Avoid_: Customer, account

**Project**:
The primary unit Records are organized by. Carries optional Client, Rate, Limits, start/end dates, color, and an Archived flag.

**Archived**:
A Project state: retired from use, kept for its history.
_Avoid_: Closed, inactive, deleted

### When

**Record**:
A single span of tracked time by one Actor.
_Avoid_: Time entry, entry, session, log

**Timer**:
A Record still running — started, not yet stopped.

**Name**:
The free-text label on a Record, Project, Client, or Workspace.
_Avoid_: Description, task, title

**Duration**:
The length of a Record.

**Period**:
A calendar week or calendar month over which Limits are measured.

**Limits**:
Optional Min and/or Max hours a Project expects per Period.
_Avoid_: Allowance, budget, capacity, quota, goal, estimate, time frame

**Range**:
The span of dates a Dashboard shows or a Report covers.
_Avoid_: Window, time frame, date range

### How much

**Rate**:
The hourly price on a Project.
_Avoid_: Price, fee, pricing

**Billable**:
Per-Record flag that the time counts toward an Amount.
_Avoid_: Paid, invoiced, chargeable

**Amount**:
The money value of a Billable Record.
_Avoid_: Cost, earnings, revenue

**Currency**:
The optional label Amounts in a Workspace are expressed in (USD, EUR, USDT…).

### Surfaces

**Tracker**:
The compact window for starting and stopping Timers; what the desktop app opens with.
_Avoid_: Widget, mini view, timer window

**Dashboard**:
The Records view over a Range with filters and totals.

**Settings**:
Where the Owner configures the app and its connection to the Server.

**Install**:
The desktop app on one machine, as the Server sees it.
_Avoid_: Client, device, instance

**Server**:
The self-hosted mirror that receives Changes from Installs.
_Avoid_: Backend, cloud

**Change**:
One recorded mutation to a Record, Project, Client, or Workspace, kept so the Server can replay it.
_Avoid_: Event, op, mutation, delta

**Token**:
The secret a CLI mints on the Server that an Install presents to push Changes.
_Avoid_: API key, secret, credential

**Push**:
Sending unsent Changes from an Install to the Server. Its state — last push, Changes waiting,
last error — is the sync status the Tracker and Settings show.
_Avoid_: Upload, publish, replicate

### Looking back

**Export**:
The action of turning the current Dashboard view into a Report.

**Report**:
The CSV file an Export produces.

**Rounding**:
An Export option that rounds each Record's Duration to the nearest step before totals and Amounts are computed.
_Avoid_: Increment, billing increment
