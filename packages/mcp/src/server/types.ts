import type { ActionLinks } from '@elkdonis/actions';
import type { ActionSources, DockLms } from '@elkdonis/actions/server';
import type { GrantStore } from './grants';
import type { AuditSink } from './audit';

/** The parts of `@elkdonis/lms` the tools read, passed in by the host (as the dock route does). */
export type McpLms = DockLms;

/**
 * The page reader the site tools use, passed in by the host as the LMS readers are:
 * `loadPageWithVersion` from `@elkdonis/page-builder/server`. It validates the row on the way out, so a
 * malformed row is "no such page". Without it `read_page` and `find_fields` say the reader is not connected.
 */
export interface McpPages {
  loadPageWithVersion(orgId: string, slug: string): Promise<{ data: unknown; updatedAt: string } | null>;
}

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
  /** The page reader (`@elkdonis/page-builder/server`); without it the page tools say so. */
  pages?: McpPages;
  /** The draft writer (the step door and the draft store); without it the draft tools say so. Read-only keys never reach it. */
  drafts?: McpDrafts;
  /** Where MCP keys are looked up. Default: the `mcp_grants` table. */
  grants?: GrantStore;
  /** Where each tool call is recorded. Default: `action_events` (via 'mcp'). */
  audit?: AuditSink;
  /** Kill switch: false answers 503 to everything. Default: `process.env.MCP_ENABLED !== '0'`. */
  enabled?: boolean;
}

/** What a block looks like to the step door: the part of a block's contract a step reads (house-editor `BlockContractLike`). */
export interface DraftContract {
  label: string;
  props: ReadonlyArray<{ name: string; kind: string; label: string; binds?: string; min?: number; max?: number; options?: ReadonlyArray<{ value: string; label: string }> }>;
  parts: Record<string, { label: string; sel: string; prop?: string }>;
  tokens: ReadonlyArray<{ name: string; label: string; type: string }>;
}

/** One step's answer, in the door's own words (house-editor `StepResult`, without the document). */
export interface McpDraftStepResult {
  ok: boolean;
  code: string;
  say: string;
  side?: string | null;
  touched?: string[];
}

/** A waiting draft (page-builder `PageDraft`). */
export interface McpDraft {
  data: unknown;
  base: string | null;
  author: { id: string; kind: 'person' | 'assistant'; label: string };
  note?: string;
  steps?: unknown[];
  savedAt: string;
}

/**
 * The draft writer, passed in by the host as the page reader is: packages/mcp links neither the house editor nor the page
 * builder, so the host hands over exactly what the two draft tools need. `applySteps` is the house editor's one door
 * (`@elkdonis/house-editor/steps`, called with `allowUnknownTypes: true` and the `contracts` given); `loadDraft` and
 * `saveDraft` are `@elkdonis/page-builder/server`'s. A test passes ones bound to a transaction that it rolls back.
 * Nothing here can publish: there is no publish on this interface.
 */
export interface McpDrafts {
  applySteps(orgId: string, doc: unknown, steps: unknown[], contracts: Record<string, DraftContract>): { ok: boolean; doc: unknown; results: McpDraftStepResult[] };
  loadDraft(orgId: string, slug: string): Promise<McpDraft | null>;
  /** `expected` is the page builder's compare-and-set: the `savedAt` of the draft that was loaded, or null for none. A draft that changed since answers `code: 'draft_changed'` and nothing is written. */
  saveDraft(orgId: string, slug: string, draft: { data: unknown; base: string | null; author: McpDraft['author']; note?: string; steps?: unknown[]; expected?: string | null }): Promise<{ ok: boolean; error?: string; code?: string }>;
}
