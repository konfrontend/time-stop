# RBAC role hierarchy and custom roles — pattern survey

Research for [GEM-104](https://linear.app/gembag/issue/GEM-104). Question: established patterns for multi-level role hierarchies and user-defined roles in RBAC; how real products model custom roles; recommended architectural direction for Time Stop MVP (fixed owner/admin/member, must not preclude hierarchy + custom roles later, AI agents as first-class principals, PostgreSQL, small-team scale).

## 1. Reference model: NIST RBAC (RBAC0–RBAC3 / INCITS 359)

The Sandhu–Ferraiolo–Kuhn NIST model, standardized as INCITS 359 (2004, revised 2012), defines four cumulative levels:

- **RBAC0 (flat/core)** — users, roles, permissions; users get permissions *only* through roles. Permissions = operations on objects.
- **RBAC1 (hierarchical)** — adds role hierarchy as a **partial order**: a senior role inherits all permissions of its juniors (transitive). Standard distinguishes *general* hierarchies (arbitrary DAG) from *limited* (tree).
- **RBAC2 (constrained)** — adds separation-of-duty constraints: static (user can't hold two conflicting roles) and dynamic (not in the same session).
- **RBAC3 (symmetric)** — RBAC1 + RBAC2 plus permission-role review.

Key takeaways for us:

- Hierarchy is formally just **permission-set inclusion** along a partial order. Any implementation that resolves "effective permissions of role R = R's own + all juniors'" is standard-compliant.
- The standard deliberately separates the **reference model** (data shapes) from the **functional spec** (required operations: assign/revoke, review). A permission-review API ("what can role X do", "who can do Y") is part of mature RBAC, worth keeping cheap to answer.

Sources: [NIST RBAC project](https://csrc.nist.gov/projects/role-based-access-control), [NIST RBAC FAQ](https://csrc.nist.gov/projects/role-based-access-control/faqs), [Sandhu/Ferraiolo/Kuhn, "The NIST model for RBAC: towards a unified standard"](https://dl.acm.org/doi/10.1145/344287.344301).

## 2. Hierarchy and composition patterns in practice

Three distinct mechanisms show up across real systems; they are often conflated but compose differently:

1. **Role inheritance (RBAC1)** — role→role edges; senior implies junior. Casbin's `g` function is the canonical engine implementation: `g(alice, role1)` + `g(role1, role2)` gives alice role2's permissions transitively (default depth limit 10). Casbin also scopes hierarchies per **domain/tenant** ("RBAC with domains") — the role edge exists *within* a tenant, which is the multi-tenant shape we'd need per workspace. ([Casbin RBAC docs](https://casbin.apache.org/docs/rbac))
2. **Base role + additive delta (GitHub pattern)** — a custom role = one inherited predefined base role (Read/Triage/Write/Maintain) + extra granular permissions not already included. Access from multiple avenues is **additive** ("the user has the sum of all access grants"). Much simpler than arbitrary DAGs; hierarchy depth is fixed at 2. Limits creation to 20 custom roles/org. ([GitHub custom repository roles](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/about-custom-repository-roles))
3. **Flat roles + scoped permission tuples (Grafana pattern)** — no role inheritance at all. Three role kinds: *basic* (must have exactly one: Admin/Editor/Viewer/None), *fixed* (predefined, immutable, fine-grained), *custom* (Enterprise). A permission is an **(action, scope)** pair, e.g. `datasources:read` on `datasources:*` or `users:<id>`. Roles are flat bags of such pairs; assignable to users, teams, and **service accounts** alike. ([Grafana RBAC](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/))

Counter-model worth knowing:

- **Discord** — roles are permission **bitfields**, membership is additive across roles, and per-channel **overwrites** (allow/deny bitfield pairs) layer on top with a fixed evaluation order where **deny beats allow**. Notably, permission evaluation "does not obey the role hierarchy" — the visual hierarchy only gates *administration* (who may edit whom). Lesson: deny rules and overwrite layers add large evaluation complexity; avoid deny semantics unless a concrete requirement forces it. ([Discord permissions docs](https://docs.discord.com/developers/topics/permissions))
- **Linear** — deliberately minimal: fixed workspace roles Admin/Member/Guest (+ Owner on Enterprise), no custom roles; granularity comes from **team-level scoping** (private teams, guests limited to invited teams, team owners as a team-scoped role). Shows a fixed-role product scaling fine for small/mid teams. ([Linear members & roles](https://linear.app/docs/members-roles))

## 3. Custom (user-defined) roles — storage patterns

- **Roles as data, not code.** Every system that supports custom roles stores role→permission mappings as rows/tuples, while the *permission vocabulary* (action strings) stays code-defined. Grafana: `(action, scope)` rows. GitHub: base-role pointer + extra-permission set.
- **OpenFGA's "role as an object type"** pattern is the ReBAC formulation of the same idea: a first-class `role` object, users linked via an `assignee` relation, and role→resource permission tuples (`role:media-manager#assignee` is `editor` of `asset-category:logos`). Custom roles then require **no authorization-model changes — only tuple writes**. That property (schema stable, data varies) is the design invariant to preserve. ([OpenFGA custom roles](https://openfga.dev/docs/modeling/custom-roles))
- **Versioning trap (Grafana):** when new features ship, new permissions are auto-added to built-in roles but **not** to custom roles — custom roles go stale and need manual updates. Plan for it: keep fixed roles defined by *code-owned* permission sets (auto-current), and treat custom roles as explicit snapshots the admin maintains.

## 4. RBAC vs ReBAC/ABAC hybrids

- **ReBAC (Zanzibar-style: SpiceDB, OpenFGA)** stores relationships (`user → reader → doc`) and *computes* permissions at query time via composition operators — union (`view = reader + writer`) and arrows (`org->view_all` walks object graphs). RBAC is trivially expressible inside ReBAC; the reverse is not true. ([SpiceDB schema docs](https://authzed.com/docs/spicedb/modeling/developing-a-schema))
- **ABAC** adds attribute/context predicates (time, resource state). Oso's guidance: RBAC first; move to ReBAC/ABAC only when access depends on relationships or dynamic context that static role membership can't express. They also stress storing role assignments in the app DB (Postgres) and doing **fresh checks at request time**, not baking permissions into JWTs. ([Oso RBAC academy](https://www.osohq.com/academy/role-based-access-control-rbac))
- For Time Stop the only ReBAC-shaped need on the horizon is *resource-scoped* roles (per-project/per-client access, like Linear's team scoping or GitHub repo roles). That is covered by putting a **scope column on the role assignment**, not by adopting a tuple store.

## 5. AI agents as principals

Convergent industry pattern: machine principals are **the same kind of subject as humans** in the authorization layer.

- Grafana RBAC assigns roles "to users, teams, and service accounts" with identical semantics — the service account is just another assignee.
- GitHub Apps get installation permissions drawn from the same permission vocabulary as human roles.
- Implication: model a single `principals` table (or `users` with `kind: human | agent`), and hang `memberships`/role assignments off the principal, never off human-specific tables. Agent-specific concerns (token auth, expiry, owner/on-behalf-of attribution) live beside the principal, not inside the role system. This also means custom roles later apply to agents for free — e.g. a "timer-only agent" role that can write time entries but not touch settings, which is a genuinely differentiating feature for the AI-tracking story.

## 6. Architectural direction candidates for the MVP decision

Common ground for all candidates (the actual load-bearing decisions):

- **Permission indirection**: application code checks *permissions* (`can(principal, "time_entry.delete", ctx)`), never role names. Roles are data that map to permissions. This single rule is what makes fixed roles → custom roles a data migration instead of a code rewrite (NIST RBAC0 discipline; every surveyed product does this).
- **Single policy module**: one place resolves principal → effective permission set. Server-side, request-time checks (Oso guidance); no permissions in JWTs.
- **Principals, not users**: agents and humans share the subject type (§5).
- **Additive-only semantics, no deny rules** (avoid Discord's overwrite complexity).

**Candidate A — enum role on membership + code-defined permission map** (minimal)
`memberships(principal_id, workspace_id, role: 'owner'|'admin'|'member')`; a TS map `role → Set<permission>`; checks go through `can()`. Zero extra tables. Custom roles later = replace enum with FK to a `roles` table and move the map into rows — contained migration *because* of permission indirection. Matches Linear's philosophy at our scale.

**Candidate B — roles as rows from day one** (NIST-shaped)
Tables: `roles(id, workspace_id nullable, name, is_system)`, `role_permissions(role_id, permission)`, `memberships(principal_id, workspace_id, role_id)`. Fixed roles seeded as system rows (permission sets still synced from code to dodge the Grafana staleness trap). Custom roles later = INSERTs + UI. Hierarchy later = either `role.extends_role_id` (GitHub base+delta, recommended) or a `role_inheritance` edge table (full RBAC1). Slightly more upfront schema; strongest "architecture demonstrably doesn't preclude X" story for a portfolio RBAC showpiece.

**Candidate C — external engine / tuple store (Casbin, OpenFGA, SpiceDB)**
Rejected for MVP: operational weight, second source of truth beside Postgres, and small-team scale never hits the problems Zanzibar solves. Revisit only if resource-scoped sharing across workspaces appears.

**Recommendation:** B if RBAC-as-showpiece should be visible in the schema; A if MVP velocity wins — both keep the same `can()` seam, and the A→B migration is mechanical. Either way, adopt the GitHub **base-role + additive delta** shape (not arbitrary DAGs) as the planned hierarchy model, and Grafana's **(action, scope)** shape as the planned permission vocabulary. Decision itself belongs in an ADR (`docs/adr/`).

## Sources

- NIST RBAC project & FAQ — https://csrc.nist.gov/projects/role-based-access-control
- Sandhu, Ferraiolo, Kuhn — The NIST model for RBAC — https://dl.acm.org/doi/10.1145/344287.344301
- GitHub custom repository roles — https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/about-custom-repository-roles
- Grafana RBAC — https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/
- Discord permissions — https://docs.discord.com/developers/topics/permissions
- Linear members & roles — https://linear.app/docs/members-roles
- Casbin RBAC — https://casbin.apache.org/docs/rbac
- OpenFGA custom roles — https://openfga.dev/docs/modeling/custom-roles
- SpiceDB schema development — https://authzed.com/docs/spicedb/modeling/developing-a-schema
- Oso RBAC academy — https://www.osohq.com/academy/role-based-access-control-rbac
