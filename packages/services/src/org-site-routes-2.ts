/**
 * Four more route handlers every single-org site copied byte for byte
 * (2026-11-16): the center layout, the profile surface, the hub documents and
 * the hub calendar window. Same shape as org-site-routes.ts: services owns the
 * handler, the app passes its org and who the viewer is. Kept in a sibling
 * file so the whole set can move into an org-site kit as one.
 */
import {
  CENTER_SECTION_IDS,
  resolveCenterLayout,
  saveCenterLayout,
  type CenterLayout,
} from './center-layout';
import { canEditOrgIdentity, getOrgIdentity } from './org-domains';
import { getProfile, updateProfile } from './profiles';
import { assignOrgDocument, createOrgDocument, listOrgDocuments } from './org-documents';
import { readOrgCalendarWindow } from './org-calendar';

const NETWORK_CONFIG_ORG = 'elkdonis';

const SECTION_LABELS: Record<string, string> = {
  profile: 'Your card',
  buttons: 'Your buttons',
  orgs: 'Where you are',
  promo: 'Promoted slot',
  you: 'Your account: payouts, where you show, details',
  journeys: 'What to do next',
  site: 'The site, scaled',
  org: "The org's card",
  pinned: 'Pinned',
  feed: 'Latest from the org',
  featured: 'Featured',
  network: 'Across the network',
};

/**
 * The center's definition, read and written from the arranging surface.
 * GET ?org=<id> resolves default <- network <- org; PATCH ?org=<id> saves that
 * org's row (owner/guide/admin) or the network default (`elkdonis`, admin only).
 * `isAdmin` is the auth-server check, passed in so services does not import it.
 */
export function centerLayoutRoutes(opts: {
  orgId: string;
  who: () => Promise<{ userId: string } | null>;
  isAdmin: (userId: string) => Promise<boolean>;
}) {
  async function orgName(orgId: string): Promise<string | null> {
    const { db } = await import('@elkdonis/db');
    const [row] = await db<Array<{ name: string }>>`SELECT name FROM organizations WHERE id = ${orgId} LIMIT 1`;
    return row?.name ?? null;
  }

  async function GET(request: Request) {
    const viewer = await opts.who();
    if (!viewer) return Response.json({ error: 'Sign in first' }, { status: 401 });
    const orgId = new URL(request.url).searchParams.get('org') ?? opts.orgId;
    const name = await orgName(orgId);
    if (!name) return Response.json({ error: 'Not found' }, { status: 404 });

    const [{ layout }, canEdit, admin] = await Promise.all([
      resolveCenterLayout(orgId),
      canEditOrgIdentity(viewer.userId, orgId),
      opts.isAdmin(viewer.userId).catch(() => false),
    ]);
    return Response.json({
      orgId,
      orgName: name,
      resolved: layout,
      sections: CENTER_SECTION_IDS.map((id) => ({ id, label: SECTION_LABELS[id] ?? id })),
      canEdit: canEdit || admin,
      networkOrgId: admin ? NETWORK_CONFIG_ORG : null,
    });
  }

  async function PATCH(request: Request) {
    const viewer = await opts.who();
    if (!viewer) return Response.json({ error: 'Sign in first' }, { status: 401 });
    const orgId = new URL(request.url).searchParams.get('org') ?? opts.orgId;
    if (!(await orgName(orgId))) return Response.json({ error: 'Not found' }, { status: 404 });

    const admin = await opts.isAdmin(viewer.userId).catch(() => false);
    const allowed =
      orgId === NETWORK_CONFIG_ORG ? admin : admin || (await canEditOrgIdentity(viewer.userId, orgId));
    if (!allowed) return Response.json({ error: 'Not allowed' }, { status: 403 });

    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== 'object') return Response.json({ error: 'Bad request' }, { status: 400 });

    try {
      // saveCenterLayout validates: unknown sections, voices and limits are dropped.
      const saved = await saveCenterLayout(orgId, body as Partial<CenterLayout>);
      return Response.json({ ok: true, layout: saved });
    } catch (err) {
      console.error('[center] layout PATCH:', err);
      return Response.json({ error: 'Could not save that.' }, { status: 500 });
    }
  }

  return { GET, PATCH };
}

interface SocialLinkIn {
  label?: unknown;
  url?: unknown;
}

/**
 * The profile surface's read and write. Without `?org=` it is the signed-in
 * person's own network-wide identity; with `?org=<id>` it is that
 * organisation's identity row (anyone signed in reads, owners and guides write).
 * This is the plain variant (no Details tab); `marketplaceUrl` is the app's
 * store link shown on the own profile.
 */
export function profileRoutes(opts: {
  who: () => Promise<{ userId: string } | null>;
  marketplaceUrl: string | null;
}) {
  const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? '').replace(/\/$/, '');
  const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? 'arts-collective.com';
  const NETWORK_PROTO = NETWORK_HOST.includes('localhost') ? 'http' : 'https';

  async function resolveTarget(userId: string, orgId: string | null) {
    if (!orgId) return { targetUserId: userId, kind: 'person' as const, canEdit: true, pageHref: null as string | null };
    const { db } = await import('@elkdonis/db');
    const [row] = await db<Array<{ slug: string; profile_user_id: string | null }>>`
      SELECT slug, profile_user_id FROM organizations WHERE id = ${orgId} LIMIT 1
    `;
    if (!row?.profile_user_id) return null;
    const identity = await getOrgIdentity(row.slug).catch(() => null);
    return {
      targetUserId: row.profile_user_id,
      kind: 'organization' as const,
      canEdit: await canEditOrgIdentity(userId, orgId),
      pageHref: identity?.primaryDomain
        ? `https://${identity.primaryDomain}`
        : `${NETWORK_PROTO}://${row.slug}.${NETWORK_HOST}/profile`,
    };
  }

  async function GET(request: Request) {
    const viewer = await opts.who();
    if (!viewer) return Response.json({ error: 'Sign in first' }, { status: 401 });
    const orgId = new URL(request.url).searchParams.get('org');
    const target = await resolveTarget(viewer.userId, orgId);
    if (!target) return Response.json({ error: 'Not found' }, { status: 404 });

    const p = await getProfile(target.targetUserId);
    if (!p) return Response.json({ error: 'Not found' }, { status: 404 });

    return Response.json({
      kind: target.kind,
      displayName: p.displayName,
      headline: p.headline,
      bio: p.bio,
      avatarUrl: p.avatarUrl,
      pronouns: p.pronouns,
      city: p.city,
      region: p.region,
      country: p.country,
      socialLinks: p.socialLinks,
      slug: p.slug,
      pageHref:
        target.kind === 'person'
          ? p.slug && ARTDIRECT_URL
            ? `${ARTDIRECT_URL}/${p.slug}`
            : null
          : target.pageHref,
      canEdit: target.canEdit,
      hrefs: target.kind === 'person' ? { files: null, blog: null, store: opts.marketplaceUrl } : undefined,
    });
  }

  const str = (v: unknown, max: number) =>
    typeof v === 'string' ? v.slice(0, max) : v === null ? null : undefined;

  async function PATCH(request: Request) {
    const viewer = await opts.who();
    if (!viewer) return Response.json({ error: 'Sign in first' }, { status: 401 });
    const orgId = new URL(request.url).searchParams.get('org');
    const target = await resolveTarget(viewer.userId, orgId);
    if (!target) return Response.json({ error: 'Not found' }, { status: 404 });
    if (!target.canEdit) return Response.json({ error: 'Not allowed' }, { status: 403 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return Response.json({ error: 'Bad request' }, { status: 400 });

    const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 120) : undefined;
    if (displayName !== undefined && !displayName) {
      return Response.json({ error: 'A name is required' }, { status: 400 });
    }
    const links = Array.isArray(body.socialLinks)
      ? (body.socialLinks as SocialLinkIn[])
          .filter((l) => l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url))
          .slice(0, 12)
          .map((l) => ({
            label: typeof l.label === 'string' ? l.label.slice(0, 40) : null,
            url: (l.url as string).slice(0, 500),
          }))
      : undefined;
    const avatarUrl = str(body.avatarUrl, 1000);
    if (avatarUrl && !avatarUrl.startsWith('/api/media/') && !/^https?:\/\//i.test(avatarUrl)) {
      return Response.json({ error: 'That image location is not allowed' }, { status: 400 });
    }

    try {
      await updateProfile(target.targetUserId, {
        displayName,
        headline: str(body.headline, 200),
        bio: str(body.bio, 4000),
        pronouns: str(body.pronouns, 40),
        city: str(body.city, 80),
        region: str(body.region, 80),
        country: str(body.country, 80),
        avatarUrl,
        socialLinks: links,
      });
    } catch (err) {
      console.error('[center] profile PATCH:', err);
      return Response.json({ error: 'Could not save that.' }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  return { GET, PATCH };
}

/**
 * The group's living documents. Every read and write is behind membership: the
 * route hands out a public WRITABLE share link, so the link is the permission.
 */
export function hubDocumentRoutes(opts: {
  orgId: string;
  who: () => Promise<{ userId: string; email: string } | null>;
}) {
  const forbidden = () => Response.json({ error: 'Members only' }, { status: 403 });

  async function GET() {
    if (!(await opts.who())) return forbidden();
    // One snippet: each one costs a WebDAV round trip.
    return Response.json({ documents: await listOrgDocuments(opts.orgId, { withSnippets: 1 }) });
  }

  async function POST(request: Request) {
    const viewer = await opts.who();
    if (!viewer) return forbidden();
    let payload: { title?: string; ideaId?: string };
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: 'Expected JSON' }, { status: 400 });
    }
    // No title is not an error: it asks for a scrap doc, named by date.
    const document = await createOrgDocument(opts.orgId, {
      title: payload.title,
      authorId: viewer.userId,
      authorName: viewer.email,
      ideaId: payload.ideaId ?? null,
    });
    if (!document) return Response.json({ error: 'Nextcloud would not create the document' }, { status: 502 });
    return Response.json({ ok: true, document });
  }

  async function PATCH(request: Request) {
    if (!(await opts.who())) return forbidden();
    let payload: { documentId?: string; ideaId?: string | null };
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: 'Expected JSON' }, { status: 400 });
    }
    if (!payload.documentId) return Response.json({ error: 'documentId is required' }, { status: 400 });
    const ok = await assignOrgDocument(opts.orgId, payload.documentId, payload.ideaId ?? null);
    if (!ok) return Response.json({ error: 'No such document' }, { status: 404 });
    return Response.json({ ok: true });
  }

  return { GET, POST, PATCH };
}

/** Events for a window, so the calendar dialog can page between months. Members only; reads Postgres. */
export function hubCalendarRoutes<V extends { userId: string }>(opts: {
  orgId: string;
  who: () => Promise<V | null>;
}) {
  async function GET(request: Request) {
    const viewer = await opts.who();
    if (!viewer) return Response.json({ error: 'Members only' }, { status: 403 });
    const result = await readOrgCalendarWindow(opts.orgId, new URL(request.url).searchParams, viewer as never);
    // `=== false`, not `!result.ok`: the union does not narrow through negation in this repo's TS config.
    if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
    return Response.json({
      from: result.from.toISOString(),
      to: result.to.toISOString(),
      events: result.events,
    });
  }
  return { GET };
}
