// ============================================================================
// Fields lens, one site's two server doors (lane LIVE, 2026-11-20). Server only: it is handed the site's own pieces and
// imports no store, no database and no session. A canvas site (elktours, hidden-enneagram, innergathering) binds it in
// one small file; the logic is here once so the three sites cannot drift.
//
//   `block:<page>:<id>:<prop>`   words of a block on a page: one `set_prop` step through the site's gated page save
//                                (createBlockFields), the stale-save guard included.
//   `record:thread:<id>:title`   the post a card shows: the catalogue's `thread-edit` through the site's own door, which
//                                re-checks that the person wrote the post or is an owner or guide of THIS organisation.
//
// Nothing here writes a table. A gathering, a tour or a series is shown read only, with the reason: the catalogue has no
// entry that renames one (see ./site-registry.ts).
// ============================================================================

import { createBlockFields, type BlockFieldsOptions } from "./blocks";
import { createFieldsActions, type FieldsRoute, type PerformResult } from "./save";
import { siteFieldsRegistry } from "./site-registry";

/** postgres.js's tagged template (`db`), loosely: the one read below is a plain SELECT, bound by organisation. */
type Sql = (strings: TemplateStringsArray, ...values: any[]) => PromiseLike<any[]>;

export interface SiteFieldsOptions extends Pick<BlockFieldsOptions, "contracts" | "config" | "loadPage" | "save" | "storeGuard"> {
  /** This site's organisation: every read is bound to it. */
  orgId: string;
  sql: Sql;
  /** Who may use the lens at all (the site's editors). A string is the reason they may not. Checked on every call. */
  authorize(): Promise<true | string>;
  /** The signed-in person as the catalogue wants them, or null. Needed only together with `performAction`. */
  session?(): Promise<{ userId: string; email: string } | null>;
  /**
   * `performAction` from @elkdonis/actions/server. Absent (a site that does not depend on the actions package yet): a post
   * a card shows reads "read only" with the reason, and nothing else changes. The block door never needs it.
   */
  performAction?(id: string, actor: { userId: string; email: string; via: "app"; siteOrgId: string; subjectId?: string }, input: unknown): Promise<{ ok: boolean; error?: string; data?: unknown }>;
}

export const READ_ONLY_THREAD = "This card shows a gathering, a tour or a series. Those are renamed on their own page for now.";
export const READ_ONLY_POSTS = "Posts are renamed on their own page on this site for now.";

export function createSiteFields(o: SiteFieldsOptions) {
  const blocks = createBlockFields({ contracts: o.contracts, config: o.config, loadPage: o.loadPage, save: o.save, storeGuard: o.storeGuard });

  const canEditPosts = !!o.performAction && !!o.session;
  const threadRoute: FieldsRoute = {
    async read(id) {
      const [t] = await o.sql`
        SELECT title, excerpt, kind, updated_at::text AS version FROM threads
        WHERE id = ${id.slice(0, 64)} AND org_id = ${o.orgId} AND status <> 'archived' LIMIT 1
      `;
      if (!t) return null;
      return {
        values: { title: String(t.title), excerpt: t.excerpt ? String(t.excerpt) : "" },
        version: String(t.version),
        ...(t.kind !== "post" ? { readOnly: READ_ONLY_THREAD } : canEditPosts ? {} : { readOnly: READ_ONLY_POSTS }),
      };
    },
    toInput(id, values) {
      if (values.title === undefined) return { error: "Only the title can be changed here." };
      return { input: { title: values.title }, subject: id };
    },
  };

  async function perform(capability: string, input: unknown, subject?: string): Promise<PerformResult> {
    if (capability !== "thread-edit") return { ok: false, error: "That is not editable from here." };
    if (!o.performAction || !o.session) return { ok: false, error: READ_ONLY_POSTS };
    const user = await o.session();
    if (!user) return { ok: false, error: "Sign in as an editor to change this." };
    const r = await o.performAction("thread-edit", { userId: user.userId, email: user.email, via: "app", siteOrgId: o.orgId, subjectId: subject }, input);
    return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error || "That could not be saved." };
  }

  const lens = createFieldsActions({ registry: siteFieldsRegistry, authorize: o.authorize, perform, routes: { thread: threadRoute }, blocks });
  return { map: blocks.map, load: lens.load, save: lens.save };
}
