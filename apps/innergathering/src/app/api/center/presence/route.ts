import { NextResponse, type NextRequest } from "next/server";
import { listOrgHomes, loadPresence, setPresence, type PresenceRowKey } from "@elkdonis/services";
import type { SurfacePresence } from "@elkdonis/cms-ui/surface";
import { getViewer } from "@/lib/auth";

/**
 * "Where you show" — the signed-in person's own switches (Brief A slice 2).
 *
 * Self only: the viewer's id is the only user this route ever touches, and
 * `setPresence` re-reads the matrix and refuses anything it did not offer.
 * Hrefs are added here because only the host knows the network's addresses.
 */
export const dynamic = "force-dynamic";

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");
const MARKET_URL = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? null;

const ROWS: PresenceRowKey[] = ["you", "blog", "store", "galleries"];

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const [presence, homes, slug] = await Promise.all([
    loadPresence(viewer.userId),
    listOrgHomes().catch(() => []),
    import("@elkdonis/db").then(({ db }) =>
      db<Array<{ slug: string | null }>>`SELECT slug FROM users WHERE id = ${viewer.userId}`.then((r) => r[0]?.slug ?? null)
    ),
  ]);
  const home = new Map(homes.map((h) => [h.orgSlug, h.primaryDomain] as const));

  const out: SurfacePresence = {
    rows: presence.rows,
    columns: presence.columns.map((c) => {
      let href: string | null = null;
      if (c.kind === "directory") href = ARTDIRECT_URL || null;
      else if (c.kind === "page") href = slug && ARTDIRECT_URL ? `${ARTDIRECT_URL}/${slug}` : null;
      else if (c.kind === "market") href = MARKET_URL;
      else if (c.kind === "org" && c.orgSlug) {
        // Only an org with its own domain gets a link: *.arts-collective.com
        // subdomains have no DNS in production (memory: Edge & Domains).
        const domain = home.get(c.orgSlug);
        href = domain ? `https://${domain}` : null;
      }
      return { key: c.key, label: c.label, kind: c.kind, orgId: c.orgId, href };
    }),
  };
  return NextResponse.json(out);
}

export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { row?: unknown; column?: unknown; on?: unknown } | null;
  if (
    !body ||
    !ROWS.includes(body.row as PresenceRowKey) ||
    typeof body.column !== "string" ||
    body.column.length > 80 ||
    typeof body.on !== "boolean"
  ) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const result = await setPresence(viewer.userId, {
      row: body.row as PresenceRowKey,
      column: body.column,
      on: body.on,
    });
    if (result.ok === false) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[center] presence POST:", err);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }
}
