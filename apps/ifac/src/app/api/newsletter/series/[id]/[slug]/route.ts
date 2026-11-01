import { isValidNewsletterSlug } from "@elkdonis/newsletter";
import { deleteNewsletter, saveNewsletter } from "@elkdonis/newsletter/server";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { findIfacSeries } from "@/lib/series-letters-store";
import { seriesAudience } from "@/lib/series-letters-mailings";

/**
 * Save (PUT) or delete one mailing to a series' subscribers
 * (`site_config` `series-mail:<id>:<slug>`; lib/series-letters-mailings.ts).
 * Owner or guide only, re-checked here; the id must be an IFAC series.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; slug: string }> };

async function target(params: Params["params"]) {
  const { id, slug } = await params;
  if (!isValidNewsletterSlug(slug)) return { error: Response.json({ error: "Invalid name" }, { status: 400 }) };
  const series = await findIfacSeries(id);
  if (!series) return { error: Response.json({ error: "Not an IFAC series" }, { status: 404 }) };
  return { series, slug };
}

export async function PUT(req: Request, { params }: Params) {
  const viewer = await getApiEditor();
  if (!viewer) return Response.json({ error: "Forbidden" }, { status: 403 });
  const t = await target(params);
  if ("error" in t) return t.error;

  let body: { title?: unknown; project?: unknown; html?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const result = await saveNewsletter(siteConfig.orgId, t.slug, {
    title: typeof body.title === "string" ? body.title : t.slug,
    project: body.project ?? null,
    html: typeof body.html === "string" ? body.html : "",
    audience: seriesAudience(t.series.id),
  });
  // `=== false`, not `!result.ok`: strict is off, so the negation does not narrow.
  if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const viewer = await getApiEditor();
  if (!viewer) return Response.json({ error: "Forbidden" }, { status: 403 });
  const t = await target(params);
  if ("error" in t) return t.error;
  const ok = await deleteNewsletter(siteConfig.orgId, t.slug, seriesAudience(t.series.id));
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
