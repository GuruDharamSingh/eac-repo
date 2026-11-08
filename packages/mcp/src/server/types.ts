import type { ActionLinks } from '@elkdonis/actions';
import type { ActionSources, DockLms } from '@elkdonis/actions/server';
import type { GrantStore } from './grants';
import type { AuditSink } from './audit';

/** The parts of `@elkdonis/lms` the tools read, passed in by the host (as the dock route does). */
export type McpLms = DockLms;

/** What a host passes to `mcpHandler`. Everything the tools read beyond the database comes from here. */
export interface McpHostOptions {
  /**
   * The one origin this endpoint answers on, e.g. `https://arts-collective.com`. Any other
   * Host (an org subdomain, a mapped custom domain: the middleware does not run on /api)
   * gets 404. The endpoint's canonical URI is `<publicOrigin>/api/mcp`.
   */
  publicOrigin: string;
  /** Hostnames accepted besides the public one: the container's own name for in-network tests. Default none. */
  extraHosts?: readonly string[];
  /** Browser origins allowed to call it. Default none: Claude clients send no Origin; a browser page gets 403. */
  allowedOrigins?: readonly string[];
  links: ActionLinks;
  /** Hosts besides the public one and `links`' that result links may point at (e.g. elkdonis-arts.org for the Akhand Path). */
  linkHosts?: readonly string[];
  /** Host readers: `channelNext` for the board (arts-collective lib/channel/next-source.ts). */
  sources?: ActionSources;
  /** The LMS readers (`@elkdonis/lms`); without them the course and routine tools say so. */
  lms?: McpLms;
  /** Where MCP keys are looked up. Default: the `mcp_grants` table. */
  grants?: GrantStore;
  /** Where each tool call is recorded. Default: `action_events` (via 'mcp'). */
  audit?: AuditSink;
  /** Kill switch: false answers 503 to everything. Default: `process.env.MCP_ENABLED !== '0'`. */
  enabled?: boolean;
}
