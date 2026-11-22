import { loadDraft, saveDraft } from "@elkdonis/page-builder/server";
import type { McpDrafts } from "@elkdonis/mcp/server";
// The house editor's one door for page changes. Relative on purpose, as apps/development's lib/sites-door.ts does: this
// app does not list @elkdonis/house-editor as a dependency yet, so the package name does not resolve here (the PM runs the
// install). Once "@elkdonis/house-editor": "workspace:*" is installed in this app, change this to
// `import { applySteps } from "@elkdonis/house-editor/steps";` and nothing else moves. Pure and server-safe.
import { applySteps } from "../../../../packages/house-editor/src/steps/index";

/**
 * The draft writer the MCP endpoint hands to its two draft tools (propose_page_patch, set_field): the step door, and the
 * page builder's draft store. There is no publish here: an assistant can only leave a draft, and a person publishes it
 * from the Sites tab of the development app. Wired in app/api/mcp/route.ts.
 */
export const mcpDrafts: McpDrafts = {
  applySteps: (_orgId, doc, steps, contracts) =>
    applySteps(doc as never, steps, { contracts: contracts as never, allowUnknownTypes: true }) as never,
  loadDraft: (orgId, slug) => loadDraft(orgId, slug),
  saveDraft: (orgId, slug, draft) => saveDraft(orgId, slug, draft),
};
