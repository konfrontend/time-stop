# timestop

## Product

The idea is the README opener. A feature that does not serve it needs a reason.

## Branches

Every change starts on its own branch off an up-to-date `master`, created before the first edit, and reaches `master` through a PR. A ticket's branch is the Linear issue's `gitBranchName`; other work takes a short `chore/…` name. When a skill says to commit to the current branch, that branch is this one.

## Agent skills

### Issue tracker

Issues live in Linear (workspace `gembag`, team `Gembag`, project `Time Stop`), managed with the Linear MCP tools. GitHub Issues are not used. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

Entity relationships and behavior (containment, Record properties, Context, Limits, money) live in `docs/data-hierarchy.md`. `CONTEXT.md` stays a glossary.
