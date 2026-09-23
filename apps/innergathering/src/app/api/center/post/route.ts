import { NextResponse, type NextRequest } from "next/server";
import { createPostAnywhere, listOrgHomes, listPostTargets } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

/**
 * "Post to…" from /center (Brief A slice 3): any org the viewer is part of,
 * or their own blog on this site.
 *
 * GET lists the places; POST writes to ONE of them. The POST never trusts the
 * list — createPostAnywhere re-reads the viewer's roles and the forum's
 * createTopic refuses a feed they may not post in.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const targets = await listPostTargets(viewer.userId, { blogOrgId: siteConfig.orgId });
  return NextResponse.json({ targets });
}

export async function POST(request: NextRequest) {
  const viewer = await getViewer();
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
      blogOrgId: siteConfig.orgId,
    });
  } catch (err) {
    console.error("[center] post:", err);
    return NextResponse.json({ error: "Could not post that." }, { status: 500 });
  }
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: 400 });

  if (result.kind === "blog") {
    const { db } = await import("@elkdonis/db");
    const [me] = await db<Array<{ slug: string | null; blog_on: boolean }>>`
      SELECT slug, COALESCE((profile_sections->>'blog')::boolean, false) AS blog_on
        FROM users WHERE id = ${viewer.userId}
    `;
    // The piece page 404s while the writing section is off, so no link to it
    // then — say where the switch is instead.
    return NextResponse.json({
      ok: true,
      label: me?.blog_on
        ? "your blog"
        : "your blog. It stays hidden until you turn on Your writing under Where you show",
      href: me?.slug && me.blog_on ? `/artists/${me.slug}/writing/${result.slug}` : null,
    });
  }

  const [feed] = await (await import("@elkdonis/db")).db<Array<{ org_name: string; feed_name: string; org_slug: string }>>`
    SELECT o.name AS org_name, o.slug AS org_slug, f.name AS feed_name
      FROM org_feeds f JOIN organizations o ON o.id = f.org_id
     WHERE f.org_id = ${result.orgId} AND f.slug = ${result.feedSlug}
  `;
  let href: string | null = null;
  if (result.orgId === siteConfig.orgId) {
    href = `/forum/t/${result.threadId}/${result.slug}`;
  } else if (feed) {
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
