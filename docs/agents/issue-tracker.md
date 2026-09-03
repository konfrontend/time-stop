# Issue tracker: Linear

Issues and specs for this repo live in Linear, workspace **gembag** (https://linear.app/gembag), team **Gembag**, project **Time Stop** (https://linear.app/gembag/project/time-stop-a6596a26dd3a).

Team `Gembag` is shared across several repos. **Always scope to project `Time Stop`**, on both reads and writes; an unscoped `list_issues` returns other repos' work.

Use the Linear MCP tools (`mcp__plugin_linear_linear__*`) for all operations — there is no CLI step. Issues are referenced by their Linear identifier (e.g. `GEM-42`), not by a bare number.

If the Linear MCP server is not connected in the current session, stop and tell the user rather than falling back to `gh` — this repo does not use GitHub Issues.

## Conventions

- **Create an issue**: `save_issue` with `team: "Gembag"`, `project: "Time Stop"`, `title`, and `description` (Markdown, literal newlines — do not escape). Omit `id` when creating.
- **Read an issue**: `get_issue` with the identifier, then `list_comments` with the same `issueId` for the discussion.
- **List issues**: `list_issues` with `project: "Time Stop"` and `fields: ["title", "description", "status", "labels", "assignee", "url", "parentId"]`. Narrow further with `label`, `state`, `assignee`, or `query` — but keep `project` set.
- **Comment on an issue**: `save_comment` with `issueId` and `body`. Reply into a thread with `parentId`.
- **Apply labels**: `save_issue` with `id` and `labels`. **`labels` replaces the whole set** — read the issue's current labels first and pass the full intended list, or you will silently drop labels.
- **Edit a description**: `save_issue` with `id` and `patch` (anchored ops) rather than resending the whole `description`.
- **Close**: `save_issue` with `id` and `state: "Done"`. Use `Canceled` for work that will not be done, `Duplicate` for duplicates (`duplicateOf` records the original).

### Workflow states

`Backlog` → `Todo` → `In Progress` → `Done`, plus `Canceled` and `Duplicate`. New issues default to the team's default state; set `state` explicitly when a skill means a specific one.

Linear has a native Triage inbox and its own Triage Intelligence suggestions (surfaced by `list_issues`). The skills' triage vocabulary is label-based, not state-based — see `docs/agents/triage-labels.md`. Both can coexist; labels are what the skills read and write.

## When a skill says "publish to the issue tracker"

Create a Linear issue on team `Gembag`, project `Time Stop`, with `save_issue`.

## When a skill says "fetch the relevant ticket"

Call `get_issue` with the identifier, then `list_comments` for its discussion.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue; **tickets** are its sub-issues.

- **Map**: an issue on team `Gembag`, project `Time Stop`, labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. Create with `save_issue`; append to the body later with `patch`.
- **Child ticket**: `save_issue` with `project: "Time Stop"` and `parentId` set to the map's identifier — Linear's native sub-issue relation. Label it `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`). Once claimed, set `assignee`.
- **Blocking**: Linear's native issue relations. `save_issue` with `blockedBy: ["GEM-12"]` on the blocked issue (append-only), or `blocks` on the blocker. Remove with `removeBlockedBy` / `removeBlocks`. A ticket is unblocked when every blocker is in a completed or canceled state.
- **Frontier query**: `list_issues` with `parentId` = the map and `fields: ["title", "status", "statusType", "labels", "assignee"]`; drop anything already assigned, then drop anything whose blockers are not all completed/canceled (check each candidate with `get_issue`). First in map order wins.
- **Claim**: `save_issue` with `id` and `assignee: "me"` — the session's first write.
- **Resolve**: `save_comment` with the answer, then `save_issue` with `state: "Done"`, then append a context pointer to the map's Decisions-so-far with `patch`.

Wayfinder labels (`wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task`) already exist on team `Gembag` — apply them, don't create duplicates. As with triage labels, `save_issue`'s `labels` replaces the whole set, so pass the full intended list.

## Repo ↔ tracker link

The git remote is `github.com/konfrontend/time-stop`, but **GitHub Issues are not used**. GitHub is code hosting only; PRs are not a request surface. Link a branch or PR to its issue by using Linear's branch name (`gitBranchName` on `list_issues`) or by putting the identifier in the branch name or PR title.
