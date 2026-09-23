import { NextResponse, type NextRequest } from "next/server";
import { createPostAnywhere, listOrgHomes, listPostTargets } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * "Post to…" from the network hub (Brief A slice 4): any org the viewer is
 * part of. Same shape as innergathering's /api/center/post, without "My blog"
 * (this app serves no member blog pages).
 *
 * GET lists the places; POST writes to ONE of them. The POST never trusts the
 * list — createPostAnywhere re-reads the viewer's roles and the forum's
 * createTopic refuses a feed they may not post in.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const viewer = user ? { userId: user.id } : null;
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const targets = await listPostTargets(viewer.userId);
  return NextResponse.json({ targets });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const viewer = user ? { userId: user.id } : null;
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { target?: unknown; title?: unknown; text?: unknown } | null;
  if (!body || typeof body.target !== "string" || typeof body.title !== "string" || typeof body.text !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (body.text.length > 20000) return NextResponse.json({ error: "That is too long for a post." }, { status: 400 });

  let result;
  try {
    result = await createPostAnywhere(viewer.userId, {
      target: body.target.slice(0, 120),
      title: body.title.slice(0, 200),
      text: body.text,
    });
  } catch (err) {
    console.error("[center] post:", err);
    return NextResponse.json({ error: "Could not post that." }, { status: 500 });
  }
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: 400 });

  // No member blogs are served here, so no blog target is ever listed.
  if (result.kind === "blog") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const [feed] = await (await import("@elkdonis/db")).db<Array<{ org_name: string; feed_name: string; org_slug: string }>>`
    SELECT o.name AS org_name, o.slug AS org_slug, f.name AS feed_name
      FROM org_feeds f JOIN organizations o ON o.id = f.org_id
     WHERE f.org_id = ${result.orgId} AND f.slug = ${result.feedSlug}
  `;
  let href: string | null = null;
  if (feed) {
    // Another org: link only when it has a domain of its own that answers
    // (*.arts-collective.com subdomains have no DNS in production).
    const homes = await listOrgHomes().catch(() => []);
    const domain = homes.find((h) => h.orgSlug === feed.org_slug)?.primaryDomain;
    href = domain ? `https://${domain}/forum/t/${result.threadId}/${result.slug}` : null;
  }
  return NextResponse.json({
    ok: true,
    label: feed ? `${feed.org_name} · ${feed.feed_name}` : result.orgId,
    href,
  });
}
