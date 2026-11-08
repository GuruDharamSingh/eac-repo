// Site Builder runners (../hub.ts entries site-*). Owners and guides of the
// site's org (the hub door already settled that through canManageOrgPeople);
// the host's SiteBuilderAdapter supplies everything app-specific. Store-backed
// entries whose migration is pending refuse with a plain message.
import { z } from 'zod/v4';
import { db } from '@elkdonis/db';
import type { ActionResult } from '../types';
import type { ActorContext, Runner } from './run';
import type { SiteBuilderAdapter } from './site-adapter';

const runner = <I>(r: Runner<I>): Runner<unknown> => r as Runner<unknown>;

const PATH = z.string().trim().max(200);
const SEGMENT_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KINDS = ['artist', 'collective', 'services', 'store', 'gatherings', 'writing'] as const;

const fail = (error: string, code: 'forbidden' | 'input' | 'failed' = 'input'): ActionResult => ({ ok: false, error, code });

function site(ctx: ActorContext): { orgId: string; adapter: SiteBuilderAdapter } {
  if (!ctx.orgId || !ctx.siteAdapter) throw new Error('site builder runner without a site');
  return { orgId: ctx.orgId, adapter: ctx.siteAdapter };
}

async function tableExists(name: string): Promise<boolean> {
  const [r] = await db<Array<{ t: string | null }>>`SELECT to_regclass(${name})::text AS t`;
  return Boolean(r?.t);
}

/** Puck root props title, set on a doc the card creates. */
function withTitle(doc: unknown, title: string): unknown {
  if (!doc || typeof doc !== 'object') return doc;
  const d = doc as { root?: { props?: Record<string, unknown> } };
  return { ...d, root: { ...(d.root ?? {}), props: { ...(d.root?.props ?? {}), title } } };
}

function blockCount(doc: unknown): number {
  const c = (doc as { content?: unknown[] } | null)?.content;
  return Array.isArray(c) ? c.length : 0;
}

export const SITE_BUILDER_RUNNERS: Record<string, Runner<unknown>> = {
  'site-section-save': runner({
    input: z.object({ pageId: PATH, values: z.record(z.string().max(80), z.string().max(20000)) }),
    failure: 'Could not save the copy. Try again.',
    async run(ctx, input) {
      const { orgId, adapter } = site(ctx);
      const page = adapter.templatePages.find((p) => p.path === input.pageId);
      if (!page) return fail('That page has no copy slots.');
      const bySection = new Map<string, Record<string, string>>();
      for (const [key, value] of Object.entries(input.values)) {
        const slot = page.slots.find((s) => s.key === key);
        if (!slot) return fail('That page has no such copy slot.');
        const fields = bySection.get(slot.section) ?? {};
        fields[slot.field] = value.trim();
        bySection.set(slot.section, fields);
      }
      for (const [section, fields] of bySection) {
        const [row] = await db<Array<{ content: Record<string, unknown> | null }>>`
          SELECT content FROM org_site_sections WHERE org_id = ${orgId} AND section_key = ${section}
        `;
        const next: Record<string, unknown> = { ...(row?.content ?? {}) };
        // An empty field is dropped so the layout's own default shows (the old editors' rule).
        for (const [f, v] of Object.entries(fields)) {
          if (v) next[f] = v;
          else delete next[f];
        }
        await db`
          INSERT INTO org_site_sections (org_id, section_key, content, updated_by, updated_at)
          VALUES (${orgId}, ${section}, ${db.json(next as never)}, ${ctx.userId}, NOW())
          ON CONFLICT (org_id, section_key) DO UPDATE SET
            content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = NOW()
        `;
      }
      adapter.revalidate?.('*');
      return { ok: true };
    },
  }),

  'site-page-create': runner({
    input: z.object({
      title: z.string().trim().min(1).max(120),
      path: PATH,
      start: z.string().trim().max(40),
      fromPath: PATH.optional(),
      templateId: z.string().trim().uuid().optional(),
    }),
    failure: 'Could not create the page. Try again.',
    async run(ctx, input) {
      const { orgId, adapter } = site(ctx);
      const segments = input.path.split('/');
      if (!input.path || segments.some((s) => !SEGMENT_RE.test(s))) return fail('Use lowercase letters, numbers and dashes.');
      if (segments.length > adapter.maxDepth) return fail('Pages on this site sit at the top level.');
      const problem = await adapter.pathProblem(input.path);
      if (problem) return fail(problem);
      if (await adapter.loadPage(input.path)) return fail(`/${input.path} is already a page. Pick another address.`);
      let doc: unknown = null;
      let note = '';
      if (input.fromPath !== undefined) {
        doc = await adapter.loadPage(input.fromPath);
        if (!doc) return fail('That page has no layout to copy.');
        note = `Started as a copy of /${input.fromPath}.`;
      } else if (input.templateId) {
        if (!(await tableExists('site_page_templates'))) return fail('Saved templates need a database update that is not applied yet.');
        const [t] = await db<Array<{ name: string; puck_data: unknown }>>`
          SELECT name, puck_data FROM site_page_templates
          WHERE id = ${input.templateId} AND (org_id = ${orgId} OR org_id IS NULL) LIMIT 1
        `;
        if (!t) return fail('That template is gone.');
        doc = t.puck_data;
        note = `Made from the ${t.name} template.`;
      } else {
        doc = await adapter.startDoc(input.start, input.path, input.title);
        if (!doc) return fail('Pick how the page starts.');
      }
      const saved = await adapter.savePage(input.path, adapter.sanitizeDoc(withTitle(doc, input.title)));
      if (!saved.ok) return fail(saved.error ?? 'Could not create the page.', 'failed');
      if (note && (await tableExists('site_page_meta'))) {
        await db`
          INSERT INTO site_page_meta (org_id, path, kind, title, notes, updated_by)
          VALUES (${orgId}, ${input.path}, 'editor', ${input.title}, ${note}, ${ctx.userId})
          ON CONFLICT (org_id, path) DO NOTHING
        `;
      }
      adapter.revalidate?.(input.path);
      return { ok: true, data: { path: input.path } };
    },
  }),

  'site-page-meta-save': runner({
    input: z.object({
      pageId: PATH,
      title: z.string().trim().max(120).optional(),
      notes: z.string().max(4000).optional(),
      linkPreview: z.string().trim().max(300).optional(),
    }),
    failure: 'Could not save the page settings. Try again.',
    async run(ctx, input) {
      const { orgId, adapter } = site(ctx);
      if (!(await tableExists('site_page_meta'))) return fail('Page notes need a database update that is not applied yet.');
      const kind = adapter.templatePages.some((p) => p.path === input.pageId) ? 'template' : 'editor';
      await db`
        INSERT INTO site_page_meta (org_id, path, kind, title, notes, link_preview, updated_by, updated_at)
        VALUES (${orgId}, ${input.pageId}, ${kind}, ${input.title ?? null}, ${input.notes ?? null}, ${input.linkPreview ?? null}, ${ctx.userId}, NOW())
        ON CONFLICT (org_id, path) DO UPDATE SET
          title = COALESCE(EXCLUDED.title, site_page_meta.title),
          notes = COALESCE(EXCLUDED.notes, site_page_meta.notes),
          link_preview = COALESCE(EXCLUDED.link_preview, site_page_meta.link_preview),
          updated_by = EXCLUDED.updated_by, updated_at = NOW()
      `;
      return { ok: true };
    },
  }),

  'site-template-save': runner({
    input: z.object({ fromPath: PATH, name: z.string().trim().min(1).max(120) }),
    failure: 'Could not save the template. Try again.',
    async run(ctx, input) {
      const { orgId, adapter } = site(ctx);
      if (!(await tableExists('site_page_templates'))) return fail('Saved templates need a database update that is not applied yet.');
      const doc = await adapter.loadPage(input.fromPath);
      if (!doc) return fail('That page has no layout to save.');
      const clean = adapter.sanitizeDoc(doc);
      await db`
        INSERT INTO site_page_templates (org_id, name, from_path, puck_data, block_count, created_by)
        VALUES (${orgId}, ${input.name}, ${input.fromPath}, ${db.json(clean as never)}, ${blockCount(clean)}, ${ctx.userId})
      `;
      return { ok: true };
    },
  }),

  'site-identity-save': runner({
    input: z.object({
      name: z.string().trim().min(1).max(120),
      line: z.string().trim().max(120),
      where: z.string().trim().max(120),
      /** A stored upload's URL (the host's uploadImage result); the identity row's picture. */
      markUrl: z.string().trim().max(1000).regex(/^(https:\/\/|\/)[^\s"'<>]+$/).optional(),
      primaryKind: z.enum(KINDS).optional(),
      alsoKinds: z.array(z.enum(KINDS)).max(6).optional(),
    }),
    failure: 'Could not save the identity card. Try again.',
    async run(ctx, input) {
      const { orgId } = site(ctx);
      const { canEditOrgIdentity, updateProfile } = await import('@elkdonis/services');
      if (!(await canEditOrgIdentity(ctx.userId, orgId))) return fail('Only owners and guides edit the identity card.', 'forbidden');
      const [org] = await db<Array<{ profile_user_id: string | null }>>`SELECT profile_user_id FROM organizations WHERE id = ${orgId}`;
      if (!org?.profile_user_id) return fail('This organisation has no identity card yet.', 'failed');
      await updateProfile(org.profile_user_id, {
        displayName: input.name,
        headline: input.line || null,
        city: input.where || null,
        ...(input.markUrl ? { avatarUrl: input.markUrl } : {}),
      });
      if (input.primaryKind !== undefined) {
        const also = (input.alsoKinds ?? []).filter((k) => k !== input.primaryKind);
        try {
          await db`UPDATE users SET identity_kind = ${input.primaryKind}, identity_also_kinds = ${also} WHERE id = ${org.profile_user_id}`;
        } catch (err) {
          // 42703: migration 260 not applied. The card itself saved; the kinds wait.
          if ((err as { code?: string })?.code !== '42703') throw err;
        }
      }
      return { ok: true };
    },
  }),

  'site-theme-exception-remove': runner({
    input: z.object({ pageId: PATH.min(1) }),
    failure: 'Could not remove the exception. Try again.',
    async run(ctx, input) {
      const { orgId, adapter } = site(ctx);
      await db`DELETE FROM site_themes WHERE org_id = ${orgId} AND page_key = ${input.pageId} AND page_key <> ''`;
      adapter.revalidate?.(input.pageId);
      return { ok: true };
    },
  }),
};
