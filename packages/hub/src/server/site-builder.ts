import 'server-only';

// Site Builder's server half: load(site, viewer) → SiteBuilderFaceData,
// loadDetail → SiteBuilderDetailData. Pages are read straight from the stores
// (site_config puck:* titles via jsonb, org_site_sections for copy slots,
// site_themes, the org identity users row) without loading whole documents.
// Store-backed extras (site_page_meta, site_page_templates, identity kinds)
// are read when their migration is applied and reported through `can`.
// Writes are registry entries (packages/actions/src/server/sb-runners.ts).

import { db } from '@elkdonis/db';
import { canEditOrgIdentity } from '@elkdonis/services';
import { defineHubCardServer, type HubSite, type HubViewer } from '../contract';
import type {
  CopySlot,
  OrgIdentity,
  OrgKind,
  SavedTemplate,
  SiteBuilderCan,
  SiteBuilderDeclaration,
  SiteBuilderDetailData,
  SiteBuilderFaceData,
  SitePage,
  ThemeColors,
} from '../site-builder/model';

const HEX = /^#[0-9a-fA-F]{3,8}$/;

async function tableExists(name: string): Promise<boolean> {
  const [r] = await db<Array<{ t: string | null }>>`SELECT to_regclass(${name})::text AS t`;
  return Boolean(r?.t);
}

function titleFromPath(path: string): string {
  if (!path) return 'Home';
  const last = path.split('/').pop() ?? path;
  return last.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

function declarationOf(site: HubSite): SiteBuilderDeclaration {
  if (!site.siteBuilder) throw new Error(`[hub/site-builder] ${site.orgId} has no siteBuilder declaration`);
  return site.siteBuilder;
}

/** Map a site_themes vars object onto colour roles through the declaration's var names. */
function colorsFrom(vars: Record<string, string> | null, decl: SiteBuilderDeclaration, base: ThemeColors): Partial<ThemeColors> {
  const out: Partial<ThemeColors> = {};
  if (!vars) return out;
  for (const [role, name] of Object.entries(decl.theme.vars ?? {}) as Array<[keyof ThemeColors, string]>) {
    const v = vars[name];
    if (typeof v === 'string' && HEX.test(v.trim()) && v.trim().toLowerCase() !== base[role].toLowerCase()) out[role] = v.trim();
  }
  return out;
}

interface Built {
  face: SiteBuilderFaceData;
  decl: SiteBuilderDeclaration;
}

async function build(site: HubSite, viewer: HubViewer): Promise<Built> {
  const decl = declarationOf(site);
  const orgId = site.orgId;
  const [hasMeta, hasTemplates] = await Promise.all([tableExists('site_page_meta'), tableExists('site_page_templates')]);

  const [docs, sections, themes, metaRows] = await Promise.all([
    db<Array<{ slug: string; updated_at: Date; title: string | null }>>`
      SELECT substring(key FROM 6) AS slug, updated_at, value->'root'->'props'->>'title' AS title
      FROM site_config WHERE org_id = ${orgId} AND key LIKE 'puck:%'
    `,
    db<Array<{ section_key: string; content: Record<string, unknown> | null; updated_at: Date | null; by_name: string | null }>>`
      SELECT s.section_key, s.content, s.updated_at, COALESCE(u.display_name, u.email) AS by_name
      FROM org_site_sections s LEFT JOIN users u ON u.id = s.updated_by
      WHERE s.org_id = ${orgId}
    `,
    db<Array<{ page_key: string; vars: Record<string, string> | null }>>`
      SELECT page_key, vars FROM site_themes WHERE org_id = ${orgId}
    `.catch(() => []),
    hasMeta
      ? db<Array<{ path: string; title: string | null; notes: string | null; link_preview: string | null; thumbnail_url: string | null; updated_at: Date; by_name: string | null }>>`
          SELECT m.path, m.title, m.notes, m.link_preview, m.thumbnail_url, m.updated_at, COALESCE(u.display_name, u.email) AS by_name
          FROM site_page_meta m LEFT JOIN users u ON u.id = m.updated_by WHERE m.org_id = ${orgId}
        `
      : Promise.resolve([]),
  ]);

  // ── theme ──
  const siteVars = themes.find((t) => t.page_key === '')?.vars ?? null;
  const colors: ThemeColors = { ...decl.theme.colors, ...colorsFrom(siteVars, decl, decl.theme.colors) };
  const exceptions = new Map<string, Partial<ThemeColors>>();
  for (const t of themes) {
    if (!t.page_key) continue;
    const c = colorsFrom(t.vars, decl, colors);
    if (Object.keys(c).length) exceptions.set(t.page_key, c);
  }

  const meta = new Map(metaRows.map((m) => [m.path, m]));
  const pages = new Map<string, SitePage>();

  // ── editor pages (Puck documents) ──
  const hidden = new Set(decl.hidden ?? []);
  for (const d of docs) {
    if (hidden.has(d.slug)) continue;
    const shared = decl.sharedLayouts?.find((l) => l.key === d.slug);
    const path = decl.pathOf?.[d.slug] ?? d.slug;
    const prev = pages.get(path);
    if (prev && prev.updatedAt && new Date(prev.updatedAt) >= new Date(d.updated_at)) continue;
    const m = meta.get(path);
    pages.set(path, {
      id: path,
      title: shared?.title ?? m?.title ?? d.title ?? titleFromPath(path),
      path,
      depth: path ? path.split('/').length : 1,
      kind: 'editor',
      thumbnailUrl: m?.thumbnail_url ?? null,
      updatedAt: iso(d.updated_at),
      updatedBy: m?.by_name ?? null,
      notes: hasMeta ? m?.notes ?? '' : null,
      linkPreview: m?.link_preview ?? null,
      sharedLayoutFor: shared?.draws ?? null,
      copySlots: [],
      exception: exceptions.get(path) ?? null,
    });
  }

  // ── template pages (app-declared layouts; copy in org_site_sections) ──
  const bySection = new Map(sections.map((s) => [s.section_key, s]));
  for (const t of decl.templatePages) {
    if (pages.has(t.path)) continue; // a stored document wins: the page is laid out in the editor now
    let updatedAt: Date | null = null;
    let updatedBy: string | null = null;
    const copySlots: CopySlot[] = t.slots.map((slot) => {
      const row = bySection.get(slot.section);
      if (row?.updated_at && (!updatedAt || row.updated_at > updatedAt)) {
        updatedAt = row.updated_at;
        updatedBy = row.by_name;
      }
      const v = row?.content?.[slot.field];
      return { ...slot, value: typeof v === 'string' ? v : v == null ? '' : String(v) };
    });
    const m = meta.get(t.path);
    pages.set(t.path, {
      id: t.path,
      title: t.title,
      path: t.path,
      depth: t.path ? t.path.split('/').length : 1,
      kind: 'template',
      thumbnailUrl: m?.thumbnail_url ?? null,
      updatedAt: iso(updatedAt),
      updatedBy,
      notes: hasMeta ? m?.notes ?? '' : null,
      linkPreview: null,
      sharedLayoutFor: t.sharedLayoutFor ?? null,
      copySlots,
      exception: exceptions.get(t.path) ?? null,
    });
  }

  // Site order: home first, then by address (a nested page follows its parent).
  const list = [...pages.values()].sort((a, b) => (a.path === '' ? -1 : b.path === '' ? 1 : a.path.localeCompare(b.path)));
  const lastEdited = list.reduce<SitePage | null>((best, p) => (!p.updatedAt ? best : !best?.updatedAt || p.updatedAt > best.updatedAt ? p : best), null);

  // ── identity (the org's identity users row, migration 099) ──
  let kindsOn = true;
  type IdRow = { display_name: string | null; headline: string | null; city: string | null; avatar_url: string | null; identity_kind?: OrgKind | null; identity_also_kinds?: OrgKind[] | null };
  let idRow: IdRow | undefined;
  try {
    [idRow] = await db<IdRow[]>`
      SELECT u.display_name, u.headline, u.city, u.avatar_url, u.identity_kind, u.identity_also_kinds
      FROM organizations o JOIN users u ON u.id = o.profile_user_id WHERE o.id = ${orgId}
    `;
  } catch (err) {
    if ((err as { code?: string })?.code !== '42703') throw err;
    kindsOn = false; // migration 260 not applied
    [idRow] = await db<IdRow[]>`
      SELECT u.display_name, u.headline, u.city, u.avatar_url
      FROM organizations o JOIN users u ON u.id = o.profile_user_id WHERE o.id = ${orgId}
    `;
  }
  const identity: OrgIdentity = {
    name: idRow?.display_name || site.name,
    line: idRow?.headline ?? '',
    where: idRow?.city ?? '',
    markUrl: idRow?.avatar_url ?? null,
    markName: idRow?.avatar_url ? decodeURIComponent(idRow.avatar_url.split('/').pop() ?? '') : null,
    primaryKind: kindsOn ? idRow?.identity_kind ?? null : null,
    alsoKinds: kindsOn ? idRow?.identity_also_kinds ?? [] : [],
  };

  const editor = viewer.role === 'owner' || viewer.role === 'guide';
  const can: SiteBuilderCan = {
    editPages: editor,
    createPages: editor,
    editTheme: editor,
    editIdentity: await canEditOrgIdentity(viewer.userId, orgId),
    notes: hasMeta && editor,
    savedTemplates: hasTemplates && editor,
    kinds: kindsOn,
  };

  return {
    decl,
    face: {
      org: { name: site.name, mark: site.mark, domain: site.domain },
      pages: list,
      lastEdited,
      theme: { look: decl.look, headingFont: decl.theme.headingFont, bodyFont: decl.theme.bodyFont, colors },
      identity,
      can,
    },
  };
}

export const siteBuilderServer = defineHubCardServer<SiteBuilderFaceData, SiteBuilderDetailData>({
  id: 'site',
  async load(site, viewer) {
    return (await build(site, viewer)).face;
  },
  async loadDetail(site, viewer) {
    const { face, decl } = await build(site, viewer);
    let savedTemplates: SavedTemplate[] = [];
    if (face.can.savedTemplates) {
      const rows = await db<Array<{ id: string; name: string; description: string; from_path: string | null; by_name: string | null; created_at: Date; block_count: number }>>`
        SELECT t.id::text AS id, t.name, t.description, t.from_path, COALESCE(u.display_name, u.email) AS by_name, t.created_at, t.block_count
        FROM site_page_templates t LEFT JOIN users u ON u.id = t.created_by
        WHERE t.org_id = ${site.orgId} ORDER BY t.created_at DESC
      `;
      savedTemplates = rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        fromPage: r.from_path ?? '',
        createdBy: r.by_name ?? '',
        createdAt: new Date(r.created_at).toISOString(),
        blockCount: r.block_count,
      }));
    }
    return { ...face, savedTemplates, pageStarts: decl.pageStarts };
  },
});
