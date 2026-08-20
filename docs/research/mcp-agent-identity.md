# Research: MCP agent identity, authentication, and self-reported usage

Resolves [GEM-106](https://linear.app/gembag/issue/GEM-106). Feeds the agent-tracking model decision: how an agent starts/stops a timer and reports consumption (tokens, cost, model) to Time Stop over MCP, and how that work is attributed to a specific agent/session under RBAC.

Date: 2026-08-20.

---

## 1. What the MCP spec gives us

Source: [MCP Authorization spec (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization), [Security Best Practices](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices), [2025-11-25 changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog).

### Authorization model

- Authorization is **optional** and defined only for HTTP transports. **STDIO transport should NOT use the OAuth flow — credentials come from the environment** (i.e., an API key/token in env or config). This matters: most local harnesses (Claude Code, Cursor, etc.) run MCP servers over stdio, so a plain bearer token is the spec-blessed path there.
- For HTTP: MCP server = **OAuth 2.1 resource server**; client discovers the authorization server via **Protected Resource Metadata (RFC 9728)** advertised in a `WWW-Authenticate` header on 401; AS metadata via RFC 8414 (2025-11-25 adds OIDC Discovery). **Dynamic Client Registration (RFC 7591)** is SHOULD, so arbitrary clients can onboard without manual setup; 2025-11-25 adds **OAuth Client ID Metadata Documents** (SEP-991) as the recommended registration mechanism.
- Clients MUST use PKCE and MUST send the **RFC 8707 `resource` parameter**; servers MUST validate token **audience** (token issued specifically for this MCP server) and MUST NOT accept or pass through foreign tokens ("token passthrough" is an explicit anti-pattern).
- Tokens go in `Authorization: Bearer …` on **every** request, even within one logical session.

### Identity-relevant hard rules

- **"MCP servers MUST NOT use sessions for authentication."** The MCP session ID (Streamable HTTP `Mcp-Session-Id`) is a transport artifact — hijackable, not an identity. Every request must be authorized by its token; session IDs should be bound server-side to the authenticated principal (`<user_id>:<session_id>` keying is the recommended mitigation).
- **Scope minimization** (2025-11-25 security best practices): start with minimal scopes, elevate incrementally via `WWW-Authenticate` scope challenges (SEP-835), avoid omnibus scopes.

### Gap: no agent identity primitive

The spec authenticates **the client on behalf of a resource owner**. There is no first-class "which agent instance / which run is this" concept:

- `Implementation` info (`clientInfo` name/version at `initialize`) identifies the *client software* (e.g. `claude-code 2.x`), not the agent instance, and is client-asserted (untrusted).
- The transport session ID identifies a *connection lifetime*, not a work session, and must not be trusted for auth.
- Nothing in the protocol carries "session/run/task id" per tool call. (2025-11-25's experimental **tasks** utility is about durable request polling, not identity.)

**Consequence for Time Stop:** agent identity must live in the *token* (who) and in *application-level session objects created via tools* (which run) — not in protocol plumbing.

## 2. Pattern survey

### 2.1 Linear: agents as first-class app users (the closest prior art)

Source: [Linear agents docs](https://linear.app/developers/agents), [agent interaction](https://linear.app/developers/agent-interaction), [best practices](https://linear.app/developers/agent-best-practices), [Linear's SDK rationale](https://linear.app/now/our-approach-to-building-the-agent-interaction-sdk).

- **Identity:** an agent is a workspace member — mentionable, assignable, appears in the member list, but **not billable**. Auth is OAuth2 with **`actor=app`**: the token represents the *app installation* (its own app-user identity), not the installing human. Installation requires admin. Agents cannot hold `admin` scope; capability scopes are granular (`app:assignable`, `app:mentionable`, plus data scopes).
- **Attribution:** work runs through **Agent Sessions**, created automatically when the agent is mentioned/delegated. Delegation sets the agent as **`delegate`, not `assignee`** — the human keeps ownership, the agent acts on their behalf. This dual attribution (human owner + agent actor) is a deliberate design.
- **Self-reporting:** agents emit **Agent Activities** into a session (`createAgentActivity`): `thought`, `action` (tool call + result), `elicitation`, `response`, `error`; users emit `prompt` activities. Session state (`pending → active → awaitingInput/error → complete/stale`) is **derived automatically from the latest activity** — the agent never sets state directly. Liveness rule: emit an activity within 10 s of session creation or be marked unresponsive.

Takeaways: (a) agent = principal of a distinct kind with restricted scope ceiling; (b) session object owned by the service, state derived from reported activity, not asserted; (c) attribution is a pair (on-behalf-of human, acting agent).

### 2.2 Claude Code / harness OpenTelemetry: sidecar observation

Source: [Claude Code monitoring docs](https://code.claude.com/docs/en/monitoring-usage).

- Metrics: `claude_code.token.usage` (tokens), `claude_code.cost.usage` (USD), `claude_code.session.count`, `claude_code.active_time.total` (seconds of active use — effectively a self-measured timer), `lines_of_code.count`, `commit.count`.
- Standard attributes on everything: `session.id`, `user.id` (anonymous installation id), `user.account_uuid` / `user.email` / `organization.id` (when authenticated), `app.entrypoint`, `terminal.type`.
- Cost metric dimensions: `model`, `query_source` (main/subagent/auxiliary), **`agent.name` (subagent type)**, `skill.name`, `mcp_server.name`/`mcp_tool.name`. Events (`api_request` with `model`, `cost_usd`, `input_tokens`, `output_tokens`, `duration_ms`) correlate to a prompt via `prompt.id`.
- OpenTelemetry GenAI semconv (now in the [semantic-conventions-genai repo](https://github.com/open-telemetry/semantic-conventions-genai)) standardizes the vocabulary: `gen_ai.usage.input_tokens`/`output_tokens`, `gen_ai.request.model`, `gen_ai.agent.id`/`gen_ai.agent.name`, `gen_ai.conversation.id`.

Takeaways: (a) there is an emerging *standard attribute vocabulary* for exactly the tuple Time Stop wants (model, tokens, cost, session, agent name) — reuse the names; (b) push-based, fire-and-forget, batched; identity here is descriptive (self-asserted attributes), auth is just an OTLP endpoint bearer header; (c) `active_time` proves harnesses already self-measure "time worked."

### 2.3 LiteLLM / gateway-style: attribution via credential + request metadata

Source: [LiteLLM spend tracking](https://docs.litellm.ai/docs/proxy/cost_tracking).

- The **virtual API key is the unit of attribution**: every key belongs to a user and optionally a team; spend logs record key hash, user, team, end-user (`user` param per request), model, token counts, computed cost.
- Free-form **tags** and metadata per request (e.g. `jobID:…`; User-Agent auto-tagged, which is how it distinguishes Claude Code vs Gemini CLI traffic) give ad-hoc dimensions without schema changes.
- Cost is **computed server-side** from a model-pricing table — the caller reports model + tokens; the *service* prices it. Querying: per-key/user/team rollups, daily breakdowns, raw logs; non-admins see only their own spend.

Takeaways: (a) issue one key per agent (or per agent+project) and you get attribution for free; (b) accept caller-supplied tokens/model but compute cost yourself when possible, storing caller-reported cost as a fallback; (c) tags for arbitrary slicing.

### 2.4 Cross-cutting patterns

| Concern | Pattern A (Linear-style) | Pattern B (gateway-style) | Pattern C (telemetry-style) |
|---|---|---|---|
| Agent identity | First-class principal (app user), OAuth `actor=app` | Virtual API key ⇒ owner/team | Self-asserted attributes (`agent.name`, `user.id`) |
| Session/run | Service-owned session object, state derived from activities | Implicit (per-request), tags for grouping | `session.id` attribute, client-generated |
| Attribution to human | delegate vs assignee (on-behalf-of pair) | key owner / `end_user` param | `user.account_uuid` on events |
| Usage reporting | Semantic activities (push) | Measured at the proxy (no self-report) | Metrics/events push (self-report) |
| Trust level | Server-verified identity, self-reported content | Fully server-measured | Fully self-reported |

Time Stop cannot sit in the request path like LiteLLM (agents call their LLM providers directly), so consumption is necessarily **self-reported** (pattern C data, ideally with pattern A identity guarantees).

## 3. Candidate designs for Time Stop

Common ground for all candidates:

- **Agents are principals**, same table as humans, `kind: human | agent` — matches the existing product premise and Linear's model. RBAC roles attach to the principal; agent principals get a capped role ceiling (no admin), mirroring Linear's `actor=app` restriction.
- **On-behalf-of is a first-class field.** A time entry has `principal` (the agent that did the work) and optional `on_behalf_of` (the human owner), like Linear's delegate/assignee split. Reports can pivot on either.
- **Never authenticate by MCP session id.** Every tool call is authorized by its credential; the *work session* is an application object (`session_id` returned by `timer.start` / `session.start`), and the server binds it to the authenticated principal so an agent can only stop/append to its own sessions.
- **Vocabulary:** reuse OTel GenAI names in the tool schemas (`model`, `input_tokens`, `output_tokens`, `cost` fields named after `gen_ai.usage.*`) so harness telemetry maps 1:1.

### Design 1 — Per-agent API keys + explicit timer tools (recommended baseline)

Self-hosted, mostly stdio/local harness clients ⇒ the spec itself says env-provided credentials.

- **Identity/auth:** admin (or a human user, within their own scope) mints an **API key bound to an agent principal**, optionally scoped (`time:write`, `usage:write`, project allowlist) and optionally pinned `on_behalf_of` a human. Key hash stored; key is the attribution root (LiteLLM pattern). Works over stdio env var *and* HTTP `Authorization: Bearer` (the server treats the key as a bearer token, satisfying audience trivially since it issued it).
- **Tools (MCP):**
  - `start_session({task?, project?, description?, metadata?}) → {session_id}` — creates a running timer attributed to the token's principal.
  - `report_usage({session_id, model, input_tokens, output_tokens, cache_tokens?, cost?, provider?}) ` — append-only usage events during the session (N per session). Server prices from its own model table when `cost` omitted; stores reported cost separately if given (LiteLLM lesson).
  - `stop_session({session_id, summary?})` — closes the timer; server computes duration. Idempotent; sessions auto-close as `stale` after inactivity timeout (Linear's staleness rule) so crashed agents don't leave timers running forever.
  - Optionally `log_activity({session_id, type, body})` for Linear-style semantic breadcrumbs (thought/action/response) if we ever want a session transcript, but this is out of scope for v1.
- **Attribution chain:** key → agent principal (→ on_behalf_of human) → session → usage events. All server-side, nothing trusted from payloads except the measurements themselves.
- **Pros:** trivially deployable self-hosted; matches stdio reality; one key per agent gives clean RBAC and revocation. **Cons:** long-lived secrets; key distribution is manual; measurements are self-asserted (mitigate: mark entries `source: self-reported`, sanity-check token counts against model context limits, rate-limit).

### Design 2 — Design 1 + spec-compliant OAuth for HTTP clients

Add the full MCP authorization layer for remote/HTTP agents:

- Time Stop exposes Protected Resource Metadata (RFC 9728) + a small built-in OAuth 2.1 AS (or delegates to the deployment's IdP via RFC 8414/OIDC discovery). Supports DCR / Client ID Metadata Documents so any MCP client can connect; PKCE + RFC 8707 audience checks per spec.
- Two grant shapes: **authorization code** (human authorizes; token acts *as the human*, agent attribution then comes from a required `agent_name`/client identity claim — weaker) and **client credentials per registered agent** (token *is* the agent principal — this is the `actor=app` analogue and the preferred shape). Scopes: `time:write usage:write reports:read`, incrementally elevated per SEP-835.
- **Pros:** standards-path for hosted/multi-tenant future, short-lived tokens, per-scope consent. **Cons:** significant build for a self-hosted v1; stdio clients bypass it anyway. Sensible as phase 2; design the token-validation seam now (auth middleware resolving `principal + scopes` from either key or JWT) so it slots in.

### Design 3 — Passive OTel ingestion instead of (or beside) tools

Time Stop runs an OTLP-compatible endpoint; harnesses like Claude Code are simply configured with `OTEL_EXPORTER_OTLP_ENDPOINT=<time-stop>/otlp` + bearer key. Time Stop derives sessions from `session.id`, usage from `api_request`/`token.usage`, active time from `active_time.total`.

- **Pros:** zero agent-side integration for Claude Code; captures usage the agent would forget to report. **Cons:** attribution only as good as the exporter's attributes; no start/stop intent, no task/project linkage, no on-behalf-of; harness-specific attribute mapping. Verdict: **not a substitute for the MCP tools** (no timer semantics), but a worthwhile *supplementary ingest* later — store as the same usage-event shape, keyed by the ingest token's principal.

### Recommendation

**Design 1 now, with the auth seam shaped for Design 2, and Design 3 as optional enrichment.** Concretely for the agent-tracking model: `principals(kind)`, `api_keys(principal_id, scopes, on_behalf_of?)`, `sessions(principal_id, on_behalf_of, started_at, ended_at, state, source)`, `usage_events(session_id, model, input_tokens, output_tokens, reported_cost, computed_cost, tags)` — with session state derived (running/stopped/stale), never client-asserted.

## 4. Open questions

- Does a human "own" every agent session (`on_behalf_of` required), or are unowned autonomous agents allowed? Linear forces an owner; Time Stop's RBAC may not need to.
- Price table maintenance for computed cost (ship a snapshot? make it config?) vs trusting reported cost.
- Concurrent sessions per agent: allow (subagents!) — probably yes, which argues against a singleton "current timer" per principal.
- Should `report_usage` be allowed outside a session (orphan usage attributable to principal only)? Claude Code telemetry suggests yes for supplementary ingest.

## Sources

- MCP Authorization spec (2025-06-18): https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- MCP Security Best Practices: https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices
- MCP 2025-11-25 changelog: https://modelcontextprotocol.io/specification/2025-11-25/changelog
- Linear agents: https://linear.app/developers/agents · https://linear.app/developers/agent-interaction · https://linear.app/developers/agent-best-practices · https://linear.app/now/our-approach-to-building-the-agent-interaction-sdk
- Claude Code monitoring (OTel): https://code.claude.com/docs/en/monitoring-usage
- OTel GenAI semantic conventions: https://github.com/open-telemetry/semantic-conventions-genai
- LiteLLM spend tracking: https://docs.litellm.ai/docs/proxy/cost_tracking
