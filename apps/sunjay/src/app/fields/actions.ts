"use server";

// The Fields lens's two doors on Para Theater (pilot, 2026-11-20): load a record's stored words, save some.
// A save goes through the canonical merge runner `site-section-save` (packages/actions sb-runners.ts) by way
// of runHubAction -> performHubAction: the hub gate (owners and guides), the zod input, the slot allow-list,
// the merge (not replace), updated_by and the audit row all come from there. This file never writes the table.
// It replaces saveSectionAction (lib/cms/actions.ts), which replaces the whole row and takes any key.

import { performAction } from "@elkdonis/actions/server";
import { getServerSession } from "@elkdonis/auth-server";
import { createFieldsActions, type FieldsRoute } from "@elkdonis/house-editor/fields/server";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { fields } from "@/lib/fields";
import { hubSite } from "@/lib/hub-site";
import { blockFields } from "@/lib/fields-blocks";
import { runHubAction } from "@/app/hub/actions";

const sectionRoute: FieldsRoute = {
  async read(id) {
    const [row] = await db<Array<{ content: unknown; updated_at: Date | null }>>`
      SELECT content, updated_at FROM org_site_sections WHERE org_id = ${siteConfig.orgId} AND section_key = ${id}
    `;
    if (!row) return null;
    const values: Record<string, string> = {};
    if (row.content && typeof row.content === "object") {
      for (const [k, v] of Object.entries(row.content as Record<string, unknown>)) if (typeof v === "string") values[k] = v;
    }
    return { values, version: row.updated_at ? new Date(row.updated_at).toISOString() : "" };
  },
  // The runner's input is { pageId, values: { "<section>.<field>": text } }; the page is the template page that owns the slot.
  toInput(id, values) {
    const pages = hubSite.siteBuilder?.templatePages ?? [];
    const keys = Object.keys(values).map((f) => `${id}.${f}`);
    const page = pages.find((p) => keys.every((k) => p.slots.some((s) => s.key === k)));
    if (!page) return { error: "That wording is not editable from the page yet." };
    return { input: { pageId: page.path, values: Object.fromEntries(Object.entries(values).map(([f, v]) => [`${id}.${f}`, v])) } };
  },
};

// A post a card shows. Read: its title, summary and version (a gathering or a series is not a post to `thread-edit`: shown
// read only, with the reason). Save: the catalogue's `thread-edit` through the host's own door (via 'app', this site's org),
// which re-checks that the person is the post's author or an owner or guide, and leaves an audit row.
const threadRoute: FieldsRoute = {
  async read(id) {
    const [t] = await db<Array<{ title: string; excerpt: string | null; kind: string; version: string }>>`
      SELECT title, excerpt, kind, updated_at::text AS version FROM threads
      WHERE id = ${id.slice(0, 64)} AND org_id = ${siteConfig.orgId} AND status <> 'archived' LIMIT 1
    `;
    if (!t) return null;
    return {
      values: { title: t.title, excerpt: t.excerpt ?? "" },
      version: t.version,
      ...(t.kind === "post" ? {} : { readOnly: "This card shows a gathering or a series. Those are renamed on their own page for now." }),
    };
  },
  toInput(id, values) {
    if (values.title === undefined) return { error: "Only the title can be changed here." };
    return { input: { title: values.title }, subject: id };
  },
};

async function performThreadEdit(subject: string | undefined, input: unknown) {
  const user = (await getServerSession()).user;
  if (!user) return { ok: false as const, error: "Sign in as an editor to change this." };
  const r = await performAction("thread-edit", { userId: user.db_user_id ?? user.id, email: user.email, via: "app", siteOrgId: siteConfig.orgId, subjectId: subject }, input);
  return r.ok ? { ok: true as const, data: r.data } : { ok: false as const, error: "error" in r ? r.error : "That could not be saved." };
}

const lens = createFieldsActions({
  registry: fields,
  async authorize() {
    const viewer = await getViewer().catch(() => null);
    if (!viewer) return "Sign in as an editor to change this.";
    return viewer.canEdit ? true : "Only the organisation's editors can change this wording.";
  },
  perform: async (capability, input, subject) => {
    if (capability === "thread-edit") return performThreadEdit(subject, input);
    const r = await runHubAction(capability, input as Record<string, unknown>);
    return r.ok ? { ok: true, data: r.value } : { ok: false, error: r.error };
  },
  routes: { section: sectionRoute, thread: threadRoute },
  // Words of a block on a page (block:<page>:<id>:<prop>): one step through this site's gated page save.
  blocks: blockFields,
});

export async function loadFieldsAction(args: { kind: string; id: string }) {
  return lens.load(args);
}

export async function saveFieldsAction(input: { kind: string; id: string; values: Record<string, string>; version?: string }) {
  return lens.save(input);
}
