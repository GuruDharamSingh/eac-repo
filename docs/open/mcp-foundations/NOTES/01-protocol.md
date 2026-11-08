# 01 · MCP protocol facts used by the plan

Read 2026-11-08 from the live specification and Claude docs (the `claude-api` skill's MCP
connector reference plus the pages it points to). Not from memory. Re-check before building:
the spec changed shape in 2026-07-28.

## Spec revision

- Latest is **2026-07-28** (modelcontextprotocol.io/specification/2026-07-28). It removed
  protocol-level sessions (`Mcp-Session-Id`), the GET stream and `initialize`; every request
  carries its protocol version and client capabilities in `_meta.io.modelcontextprotocol/*`.
- Server-to-client requests (sampling, elicitation, roots) are now returned inside results as
  `InputRequiredResult` (MRTR, SEP-2322); the client retries with `inputResponses`.
- Earlier revisions **2025-03-26 to 2025-11-25** used `initialize`, optional `Mcp-Session-Id`,
  GET/DELETE. Clients in the field may still speak them, so the server must answer both eras
  (a stateless server that answers `initialize` and never mints a session id serves both).

## Streamable HTTP (2026-07-28 binding)

- One endpoint that accepts POST; each JSON-RPC request is its own POST. Client sends
  `Accept: application/json, text/event-stream`. Server answers a request with
  `application/json` or a request-scoped SSE stream; a notification gets `202` with no body.
- Required headers on every POST: `MCP-Protocol-Version` (must equal the body's `_meta`
  version, else 400 `HeaderMismatch` -32020), `Mcp-Method`, and `Mcp-Name` for
  `tools/call`, `resources/read`, `prompts/get`. Unknown version: 400
  `UnsupportedProtocolVersionError` listing supported versions. Unknown method: 404 with -32601.
- A server that speaks only 2026-07-28 answers GET/DELETE with 405, ignores
  `Mcp-Session-Id` and `Last-Event-ID`.
- Security: servers **MUST** validate `Origin` (403 when present and invalid), **SHOULD**
  authenticate every connection. Send `X-Accel-Buffering: no` on SSE (we sit behind NPM/nginx).
- Cancellation on HTTP = the client closes the response stream.

## Authorization (2026-07-28)

- Optional. When used: the MCP server is an OAuth 2.1 **resource server** and **MUST**
  publish RFC 9728 Protected Resource Metadata; 401 carries
  `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource", scope="…"`.
- The AS **MUST** offer RFC 8414 or OIDC discovery. Clients **SHOULD** support Client ID
  Metadata Documents (CIMD: the `client_id` is an https URL the AS fetches); Dynamic Client
  Registration (RFC 7591) is **MAY** and now **deprecated**, kept for compatibility; or
  pre-registration.
- Clients **MUST** send RFC 8707 `resource` (the server's canonical URI, e.g.
  `https://arts-collective.com/api/mcp`) on authorize and token requests; PKCE; RFC 9207 `iss`.
- Server **MUST** validate that the token was issued for it (audience), **MUST NOT** accept or
  pass through any other token. Invalid/expired token → 401; insufficient scope → 403 with
  `error="insufficient_scope"` and the full scope set needed (step-up).
- `offline_access` should not appear in the server's `scopes_supported`.

## Claude clients

- **Claude Code**: `claude mcp add --transport http <name> <url>`, optionally
  `--header "Authorization: Bearer <token>"`. OAuth via `/mcp` or `claude mcp login <name>`;
  registration: DCR is its default, CIMD discovered automatically, or pre-registered
  `--client-id [--client-secret] --callback-port N` with redirect `http://localhost:N/callback`.
  (code.claude.com/docs/en/mcp, read 2026-11-08.)
- **Claude API MCP connector** (beta `mcp-client-2025-11-20`; the page also lists
  `mcp-client-2026-09-15`): `mcp_servers: [{type:'url', url, name, authorization_token?}]` plus
  a matching `{type:'mcp_toolset', mcp_server_name}` in `tools`. **Tools only**: resources and
  prompts are not used. Server must be public over HTTP. The caller obtains the OAuth token.
- **Managed Agents**: MCP servers declared on the agent, OAuth credentials in a vault keyed by
  server URL; MCP toolsets default to `always_ask` permission.

## Consequences for the design

1. Everything an assistant must be able to do has to be a **tool**: the API connector (the
   likely transport for any hosted assistant) ignores resources and prompts.
2. Stateless is the right shape: no sessions to store, one container is enough, and it is what
   2026-07-28 asks for.
3. A static bearer works for Claude Code and the API connector today, before any OAuth.
4. The OAuth pass needs DCR (Claude Code's default) **and** CIMD (the spec's preference).
