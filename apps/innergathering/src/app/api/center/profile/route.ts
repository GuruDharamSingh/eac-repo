import { NextResponse, type NextRequest } from "next/server";
import {
  canEditOrgIdentity,
  getOrgIdentity,
  getProfile,
  getProfileDetails,
  saveProfileDetails,
  updateProfile,
} from "@elkdonis/services";
import type { SurfaceProfile, SurfaceProfileInput } from "@elkdonis/cms-ui/surface";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

/**
 * The profile surface's read and write.
 *
 * Without `?org=`, it is the signed-in person's own network-wide identity —
 * the `users` row ArtDirect renders — so what they save here is what every
 * org site shows of them. With `?org=<id>` it is that organisation's own
 * identity row (migration 099): anyone signed in may read it, owners and
 * guides may write it. This is where an org gets its display image.
 */
export const dynamic = "force-dynamic";

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");
const NEXTCLOUD_PUBLIC_URL = (process.env.NEXTCLOUD_PUBLIC_URL ?? process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "");
const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_PROTO = NETWORK_HOST.includes("localhost") ? "http" : "https";

async function resolveTarget(userId: string, orgId: string | null) {
  if (!orgId) return { targetUserId: userId, kind: "person" as const, canEdit: true, pageHref: null as string | null };
  // Only this site's org can be edited from this site; the identity row is
  // looked up by slug, which is what getOrgIdentity takes.
  const [{ db }] = await Promise.all([import("@elkdonis/db")]);
  const [row] = await db<Array<{ slug: string; profile_user_id: string | null }>>`
    SELECT slug, profile_user_id FROM organizations WHERE id = ${orgId} LIMIT 1
  `;
  if (!row?.profile_user_id) return null;
  const identity = await getOrgIdentity(row.slug).catch(() => null);
  return {
    targetUserId: row.profile_user_id,
    kind: "organization" as const,
    canEdit: await canEditOrgIdentity(userId, orgId),
    pageHref: identity?.primaryDomain
      ? `https://${identity.primaryDomain}`
      : `${NETWORK_PROTO}://${row.slug}.${NETWORK_HOST}/profile`,
  };
}

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const orgId = request.nextUrl.searchParams.get("org");
  const target = await resolveTarget(viewer.userId, orgId);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const p = await getProfile(target.targetUserId);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // The Details tab: own profile only. Explicit columns (getProfileDetails),
  // so nothing like claimed_by/source_note can ride along to the browser.
  const details = target.kind === "person" ? await getProfileDetails(target.targetUserId) : null;

  const out: SurfaceProfile = {
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
      target.kind === "person"
        ? p.slug && ARTDIRECT_URL
          ? `${ARTDIRECT_URL}/${p.slug}`
          : null
        : target.pageHref,
    canEdit: target.canEdit,
    hrefs:
      target.kind === "person"
        ? { files: null, blog: null, store: process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? null }
        : undefined,
    details: details
      ? {
          postalCode: details.postalCode,
          portfolioUrl: details.portfolioUrl,
          commentColor: details.commentColor,
          pageBase: ARTDIRECT_URL ? `${ARTDIRECT_URL}/` : null,
          account: {
            email: details.email,
            createdAt: details.createdAt,
            cloud:
              details.nextcloudUserId && NEXTCLOUD_PUBLIC_URL
                ? { url: NEXTCLOUD_PUBLIC_URL, username: details.nextcloudUserId }
                : null,
            signOutEndpoint: "/api/auth/logout",
            signOutTo: "/",
          },
        }
      : undefined,
  };
  return NextResponse.json(out);
}

const DETAIL_ERRORS = {
  slug_taken: "Someone already has that page address.",
  invalid_slug: "A page address needs letters or numbers.",
  reserved_slug: "That page address is reserved by the network.",
  bad_color: "The comment colour must be a hex colour like #3a5f8c.",
  bad_url: "The portfolio link must start with http:// or https://.",
} as const;

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : v === null ? null : undefined;

export async function PATCH(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const orgId = request.nextUrl.searchParams.get("org");
  const target = await resolveTarget(viewer.userId, orgId);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!target.canEdit) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as SurfaceProfileInput | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : undefined;
  if (displayName !== undefined && !displayName) {
    return NextResponse.json({ error: "A name is required" }, { status: 400 });
  }
  const links = Array.isArray(body.socialLinks)
    ? body.socialLinks
        .filter((l) => l && typeof l.url === "string" && /^https?:\/\//i.test(l.url))
        .slice(0, 12)
        .map((l) => ({ label: typeof l.label === "string" ? l.label.slice(0, 40) : null, url: l.url.slice(0, 500) }))
    : undefined;
  const avatarUrl = str(body.avatarUrl, 1000);
  if (avatarUrl && !avatarUrl.startsWith("/api/media/") && !/^https?:\/\//i.test(avatarUrl)) {
    return NextResponse.json({ error: "That image location is not allowed" }, { status: 400 });
  }

  // Details-tab fields: a person's own row only, never an org identity.
  // First, because these are the ones that can be refused (a taken slug) and
  // a refusal should leave nothing half-saved.
  if (target.kind === "person") {
    const touched =
      body.postalCode !== undefined ||
      body.portfolioUrl !== undefined ||
      body.commentColor !== undefined ||
      typeof body.slug === "string";
    if (touched) {
      const result = await saveProfileDetails(target.targetUserId, {
        postalCode: str(body.postalCode, 20),
        portfolioUrl: str(body.portfolioUrl, 500),
        commentColor: str(body.commentColor, 7),
        slug: typeof body.slug === "string" ? body.slug.slice(0, 80) : undefined,
      }).catch((err) => {
        console.error("[center] profile details PATCH:", err);
        return null;
      });
      if (!result) return NextResponse.json({ error: "Could not save that." }, { status: 500 });
      if (result.ok === false) {
        return NextResponse.json({ error: DETAIL_ERRORS[result.error] }, { status: 400 });
      }
    }
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
    console.error("[center] profile PATCH:", err);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
