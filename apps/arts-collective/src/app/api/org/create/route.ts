import { NextResponse } from "next/server";
import { createOrganizationForUser } from "@elkdonis/services";
import { requireUser } from "@/lib/session";

/**
 * Start an organisation. The work is `createOrganizationForUser` in
 * @elkdonis/services (moved there 2026-10-18 so the Center's journey can call
 * it from any org site); this route supplies who is asking and the HTTP shape
 * the signup form already speaks. The tier is self-declared and confirmed by
 * an admin from /hub/admin after the intake conversation.
 */
export async function POST(req: Request) {
  const user = await requireUser();

  let body: { subdomain?: string; title?: string; tier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await createOrganizationForUser({
    userId: user.id,
    title: typeof body.title === "string" ? body.title : "",
    subdomain: typeof body.subdomain === "string" ? body.subdomain : "",
    tier: typeof body.tier === "string" ? body.tier : undefined,
  });

  if (result.ok === false) {
    const status = result.code === "taken" ? 409 : result.code === "invalid" ? 400 : 500;
    return NextResponse.json({ error: result.error, ...(result.code === "taken" ? { code: "taken" } : {}) }, { status });
  }
  return NextResponse.json({ ok: true, slug: result.slug, tier: result.tier });
}
