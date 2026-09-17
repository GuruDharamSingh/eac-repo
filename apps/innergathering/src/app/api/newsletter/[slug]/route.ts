import { isValidNewsletterSlug } from "@elkdonis/newsletter";
import { saveNewsletter, deleteNewsletter } from "@elkdonis/newsletter/server";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/** Save (or delete) one letter. Owner/guide only — re-checked, not inherited. */
export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const viewer = await getApiEditor();
  if (!viewer) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  if (!isValidNewsletterSlug(slug)) {
    return Response.json({ error: "Invalid name" }, { status: 400 });
  }

  let body: { title?: unknown; project?: unknown; html?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const result = await saveNewsletter(siteConfig.orgId, slug, {
    title: typeof body.title === "string" ? body.title : slug,
    project: body.project ?? null,
    html: typeof body.html === "string" ? body.html : "",
  });
  // `=== false`, not `!result.ok`: this union does not narrow through the
  // negation in this repo's TS config.
  if (result.ok === false) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const viewer = await getApiEditor();
  if (!viewer) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { slug } = await params;
  const ok = await deleteNewsletter(siteConfig.orgId, slug);
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
