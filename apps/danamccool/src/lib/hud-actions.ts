'use server';

import { db } from '@elkdonis/db';
import { davListDeep, getStorageSlug } from '@elkdonis/services';
import { getSiteOwnerUserId, getViewer } from './auth';
import { siteConfig } from '@/config/site';

// ============================================================================
// The site's HUD: its pages, and a catalogue of every file it has.
//
// Server actions behind the Pages and Media panels — the same panels appear in
// the editor's left rail and on /hub. Editors only.
//
// THE CATALOGUE joins three things that did not know about each other:
//
//   files      what is in storage — her own folder (users/<slug>: uploads and
//              gallery folders) and the site folder (EAC_Network/danamccool:
//              her old site's media, page by page)
//   usages     who points at each file — a published page, an artwork's
//              pictures, a gallery's items
//   missing    addresses that something points at but storage no longer has
//              (a file renamed or moved in Nextcloud) — the broken pictures
//
// Nothing is moved or rewritten here. It is a map, read fresh each time.
// ============================================================================

const NOT_ALLOWED = 'Sign in as someone who can edit this site.';
type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function editor(): Promise<boolean> {
  const viewer = await getViewer();
  return Boolean(viewer?.canEdit);
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export interface HudPage {
  /** Stored key without the `puck:` prefix — also its address. */
  slug: string;
  title: string;
  href: string;
  updatedAt: string;
  /** The gallery linked to this page, if any. */
  gallery: { id: string; title: string; itemCount: number } | null;
}

export async function listPagesForHud(): Promise<Result<{ pages: HudPage[] }>> {
  if (!(await editor())) return { ok: false, error: NOT_ALLOWED };
  const owner = await getSiteOwnerUserId();
  const rows = await db<
    Array<{ slug: string; title: string | null; updated_at: string; g_id: string | null; g_title: string | null; g_n: number | null }>
  >`
    SELECT substr(c.key, 6) AS slug,
           c.value->'root'->'props'->>'title' AS title,
           c.updated_at,
           g.id AS g_id, g.title AS g_title, jsonb_array_length(g.items) AS g_n
    FROM site_config c
    LEFT JOIN user_galleries g
      ON g.user_id = ${owner} AND g.page_path = substr(c.key, 6)
    WHERE c.org_id = ${siteConfig.orgId} AND c.key LIKE 'puck:%'
    ORDER BY substr(c.key, 6)
  `;
  return {
    ok: true,
    pages: rows.map((r) => ({
      slug: r.slug,
      title: r.title?.trim() || r.slug.split('/').pop()!.replace(/-/g, ' '),
      href: r.slug === 'home' ? '/' : `/${r.slug}`,
      updatedAt: String(r.updated_at),
      gallery: r.g_id ? { id: r.g_id, title: r.g_title ?? '', itemCount: Number(r.g_n) || 0 } : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Media catalogue
// ---------------------------------------------------------------------------

export interface Usage {
  kind: 'page' | 'artwork' | 'gallery';
  label: string;
  /** Where to go to see or change it. */
  href: string;
}

export interface CatalogFile {
  path: string;
  url: string;
  name: string;
  /** The folder, relative to its root, for grouping. */
  folder: string;
  /** Which root it lives under. */
  root: 'mine' | 'site';
  size: number;
  kind: 'image' | 'document' | 'other';
  used: Usage[];
}

export interface Catalog {
  files: CatalogFile[];
  /** Pointed at, but not in storage. */
  missing: Array<{ path: string; used: Usage[] }>;
  roots: { mine: string | null; site: string };
}

const IMAGE = /\.(jpe?g|png|gif|webp|avif|heic)$/i;
const DOC = /\.(pdf|docx?|txt|md)$/i;
/** Storage paths inside a JSON document or a URL. */
const MEDIA_REF = /\/api\/media\/([^"'?#\\]+)/g;

function norm(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export async function loadMediaCatalog(): Promise<Result<{ catalog: Catalog }>> {
  if (!(await editor())) return { ok: false, error: NOT_ALLOWED };
  const owner = await getSiteOwnerUserId();
  const slug = owner ? await getStorageSlug(owner) : null;
  const mineRoot = slug ? `EAC_Network/users/${slug}` : null;
  const siteRoot = `EAC_Network/${siteConfig.orgId}`;

  // 1. What is in storage. Private folders are nobody's business here.
  const [mine, site] = await Promise.all([
    mineRoot ? davListDeep(mineRoot) : Promise.resolve([]),
    davListDeep(siteRoot),
  ]);
  const stored = [...mine, ...site].filter(
    (f) => !f.path.includes('/Private/') && !/\/\.DS_Store$/.test(f.path) && !/\.zip$/i.test(f.path)
  );

  // 2. Who points at what.
  const used = new Map<string, Usage[]>();
  const add = (path: string, u: Usage) => {
    const key = norm(path);
    const list = used.get(key) ?? [];
    if (!list.some((x) => x.kind === u.kind && x.label === u.label)) list.push(u);
    used.set(key, list);
  };

  const pages = await db<Array<{ slug: string; title: string | null; body: string }>>`
    SELECT substr(key, 6) AS slug, value->'root'->'props'->>'title' AS title, value::text AS body
    FROM site_config WHERE org_id = ${siteConfig.orgId} AND key LIKE 'puck:%'
  `;
  for (const p of pages) {
    const label = p.title?.trim() || p.slug;
    for (const m of p.body.matchAll(MEDIA_REF)) {
      add(m[1], { kind: 'page', label, href: `/studio/${p.slug}` });
    }
  }

  if (owner) {
    const art = await db<Array<{ path: string | null; url: string; title: string }>>`
      SELECT m.nextcloud_path AS path, m.url, a.title
      FROM artwork_media m JOIN artwork a ON a.id = m.artwork_id
      WHERE a.artist_user_id = ${owner}
    `;
    for (const a of art) {
      const path = a.path ?? a.url.replace(/^\/api\/media\//, '');
      add(path, { kind: 'artwork', label: a.title, href: '/manage/artworks' });
    }

    const galleries = await db<Array<{ slug: string; title: string; items: unknown }>>`
      SELECT slug, title, items FROM user_galleries WHERE user_id = ${owner} AND NOT is_backing
    `;
    for (const g of galleries) {
      if (!Array.isArray(g.items)) continue;
      for (const i of g.items as Array<{ url?: string }>) {
        if (typeof i.url === 'string' && i.url.startsWith('/api/media/')) {
          add(i.url.slice('/api/media/'.length), { kind: 'gallery', label: g.title, href: `/gallery/${g.slug}` });
        }
      }
    }
  }

  // 3. Join.
  const storedPaths = new Set(stored.map((f) => f.path));
  const files: CatalogFile[] = stored.map((f) => {
    const root: 'mine' | 'site' = mineRoot && f.path.startsWith(mineRoot + '/') ? 'mine' : 'site';
    const base = root === 'mine' ? mineRoot! : siteRoot;
    const rel = f.path.slice(base.length + 1);
    const folder = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    return {
      path: f.path,
      url: f.url,
      name: f.name,
      folder,
      root,
      size: f.size,
      kind: IMAGE.test(f.name) ? 'image' : DOC.test(f.name) ? 'document' : 'other',
      used: used.get(f.path) ?? [],
    };
  });
  const missing = [...used.entries()]
    .filter(([path]) => !storedPaths.has(path) && (path.startsWith(siteRoot + '/') || (mineRoot && path.startsWith(mineRoot + '/'))))
    .map(([path, u]) => ({ path, used: u }));

  return { ok: true, catalog: { files, missing, roots: { mine: mineRoot, site: siteRoot } } };
}
