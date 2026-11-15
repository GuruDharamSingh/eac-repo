/**
 * The chooser for one site's portfolio of a person (2026-11-11).
 *
 * Since migration 264 each org site keeps its own list (org_profiles.portfolio)
 * and users.portfolio is the person's home list on ArtDirect. A site's list is
 * chosen on that site, from the person's library: their home list and the
 * pictures in their own folder (EAC_Network/users/<folder>/Media/Images). An
 * upload here is filed in that folder, so it joins their library for every
 * other site too, and appears on this site only.
 * docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md
 *
 * One factory, mounted by each host at app/api/center/portfolio/route.ts:
 *
 *   const r = sitePortfolioRoutes({ orgId: siteConfig.orgId, who: async () => (await getViewer())?.userId ?? null });
 *   export const GET = r.GET; export const PUT = r.PUT; export const POST = r.POST;
 *
 *   GET  ?person=<slug>        the library, as { files: [{ url, name, source }] } (LibraryPicker)
 *   PUT  { person, items }     replace this site's list
 *   POST multipart file+person upload into the person's folder → { url, filename }
 *
 * Who may: the person, or a global admin (canEditProfile). The person must
 * have a row on this org; the list is never created for someone the site does
 * not list. Standard Response objects, no `next` dependency, like
 * connectionsHandlers.
 */

import { Buffer } from 'node:buffer';
import { db } from '@elkdonis/db';
import { validateUploadBuffer } from '@elkdonis/utils';
import { canEditProfile, setOrgPortfolio, type PortfolioItem } from './profiles';
import { getStorageSlug, listUserFiles, uploadUserFile } from './user-storage';

const MAX_ITEMS = 200;
const MAX_UPLOAD_MB = 25;
const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

interface Person {
  id: string;
  homeUrls: Set<string>;
  siteUrls: Set<string>;
  home: PortfolioItem[];
}

function urlsOf(value: unknown): PortfolioItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((w): w is Record<string, unknown> => Boolean(w) && typeof w === 'object' && typeof (w as Record<string, unknown>).url === 'string')
    .map((w) => ({ url: String(w.url), title: String(w.title ?? '') }));
}

export function sitePortfolioRoutes(opts: { orgId: string; who: () => Promise<string | null> }) {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

  /** The viewer, the person, and whether the viewer may choose for them on this org. */
  async function resolve(personSlug: unknown): Promise<{ viewerId: string; person: Person } | Response> {
    const viewerId = await opts.who().catch(() => null);
    if (!viewerId) return json({ error: 'Sign in first' }, 401);
    if (typeof personSlug !== 'string' || !SLUG.test(personSlug)) return json({ error: 'Bad request' }, 400);
    const [row] = await db<Array<{ id: string; home: unknown; site: unknown }>>`
      SELECT u.id, u.portfolio AS home, op.portfolio AS site
        FROM users u
        JOIN org_profiles op ON op.user_id = u.id AND op.org_id = ${opts.orgId}
       WHERE u.slug = ${personSlug}
       LIMIT 1
    `;
    // 404 for both "no such person here" and "not yours": a miss must not
    // confirm who is on the roster.
    if (!row || !(await canEditProfile(viewerId, row.id))) return json({ error: 'Not found' }, 404);
    const home = urlsOf(row.home);
    return {
      viewerId,
      person: {
        id: row.id,
        home,
        homeUrls: new Set(home.map((w) => w.url)),
        siteUrls: new Set(urlsOf(row.site).map((w) => w.url)),
      },
    };
  }

  return {
    async GET(request: Request) {
      const r = await resolve(new URL(request.url).searchParams.get('person'));
      if (r instanceof Response) return r;
      const files: Array<{ url: string; name: string; source: 'page' | 'user' }> = r.person.home.map((w) => ({
        url: w.url,
        name: w.title || w.url.split('/').pop() || 'Picture',
        source: 'page',
      }));
      const folder = await getStorageSlug(r.person.id);
      if (folder) {
        const own = await listUserFiles(folder, 'Media/Images').catch(() => []);
        for (const f of own) {
          if (f.isFolder || r.person.homeUrls.has(f.url)) continue;
          files.push({ url: f.url, name: f.name, source: 'user' });
        }
      }
      return json({ files });
    },

    async PUT(request: Request) {
      const body = (await request.json().catch(() => null)) as { person?: unknown; items?: unknown } | null;
      if (!body || !Array.isArray(body.items)) return json({ error: 'Bad request' }, 400);
      const r = await resolve(body.person);
      if (r instanceof Response) return r;
      if (body.items.length > MAX_ITEMS) return json({ error: `At most ${MAX_ITEMS} pictures` }, 400);
      // A picture comes from the person's library, as the picker offers it:
      // their own folder, their home list, or what this site already shows.
      // Anything else (another person's file, a stranger's URL typed into the
      // request) is refused.
      const folder = await getStorageSlug(r.person.id);
      const own = folder ? `/api/media/EAC_Network/users/${folder}/` : null;
      const items: PortfolioItem[] = [];
      for (const raw of body.items as unknown[]) {
        if (!raw || typeof raw !== 'object') return json({ error: 'Bad item' }, 400);
        const it = raw as Record<string, unknown>;
        const url = typeof it.url === 'string' ? it.url : '';
        const stored = Boolean(own) && url.startsWith(own as string) && !url.includes('..');
        if (!stored && !r.person.homeUrls.has(url) && !r.person.siteUrls.has(url)) {
          return json({ error: 'That picture is not in your library' }, 400);
        }
        const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
        items.push({
          url,
          title: typeof it.title === 'string' ? it.title.slice(0, 300) : '',
          id: typeof it.id === 'string' ? it.id.slice(0, 64) : undefined,
          x: num(it.x),
          y: num(it.y),
          w: num(it.w),
          h: num(it.h),
        });
      }
      const saved = await setOrgPortfolio(opts.orgId, r.person.id, items);
      if (!saved) return json({ error: 'Not found' }, 404);
      return json({ ok: true, count: items.length });
    },

    async POST(request: Request) {
      const form = await request.formData().catch(() => null);
      if (!form) return json({ error: 'Bad request' }, 400);
      const r = await resolve(form.get('person'));
      if (r instanceof Response) return r;
      const file = form.get('file');
      if (!file || typeof file === 'string') return json({ error: 'No file provided' }, 400);
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return json({ error: `Pictures must be under ${MAX_UPLOAD_MB} MB` }, 400);
      const buffer = Buffer.from(await file.arrayBuffer());
      // The client MIME type is attacker-controlled and SVG is scriptable:
      // decide from the bytes.
      const validation = validateUploadBuffer(buffer, ['image']);
      if ('reason' in validation) return json({ error: validation.reason }, 415);
      const folder = await getStorageSlug(r.person.id);
      if (!folder) return json({ error: 'No storage folder for this person yet' }, 409);
      const result = await uploadUserFile(folder, 'Images', file.name || 'picture', buffer, 'sniffed' in validation ? validation.sniffed.mime : file.type);
      if (!result.ok) return json({ error: result.error ?? 'Upload failed' }, 502);
      return json({ url: result.url, filename: file.name });
    },
  };
}
