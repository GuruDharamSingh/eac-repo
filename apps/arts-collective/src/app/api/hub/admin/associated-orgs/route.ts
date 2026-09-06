import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@elkdonis/auth-server";
import { getCurrentUser } from "@/lib/session";
import {
  listAssociatedOrgs,
  createAssociatedOrg,
  updateAssociatedOrg,
  deleteAssociatedOrg,
  type AssociatedOrgInput,
} from "@/lib/associated-orgs";

/** Network-admin only — see /hub/admin/directory. Not org owner/guide: this
 *  console spans every org, mirroring /hub/admin's own gate. */
async function requireNetworkAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) } as const;
  if (!(await isAdmin(user.id))) {
    return { error: NextResponse.json({ error: "Admins only" }, { status: 403 }) } as const;
  }
  return { user } as const;
}

function parseInput(body: Record<string, unknown>): AssociatedOrgInput | { error: string } {
  const name = String(body.name ?? "").trim();
  if (!name) return { error: "Name is required." };
  const orgId = String(body.orgId ?? "").trim();
  if (!orgId) return { error: "Organisation is required." };

  const tags = Array.isArray(body.tags)
    ? body.tags.map(String).map((t) => t.trim()).filter(Boolean)
    : [];

  return {
    orgId,
    name,
    slug: String(body.slug ?? "").trim() || undefined,
    roleTitle: String(body.roleTitle ?? "").trim(),
    headline: String(body.headline ?? "").trim(),
    bio: String(body.bio ?? "").trim(),
    city: String(body.city ?? "").trim(),
    region: String(body.region ?? "").trim(),
    country: String(body.country ?? "").trim(),
    avatarUrl: String(body.avatarUrl ?? "").trim(),
    website: String(body.website ?? "").trim(),
    tags,
  };
}

function revalidate() {
  revalidatePath("/hub/admin/directory");
}

export async function GET() {
  const gate = await requireNetworkAdmin();
  if ("error" in gate) return gate.error;
  const rows = await listAssociatedOrgs();
  return NextResponse.json({ rows });
}

export async function POST(request: NextRequest) {
  const gate = await requireNetworkAdmin();
  if ("error" in gate) return gate.error;

  const body = await request.json().catch(() => ({}));
  const parsed = parseInput(body);
  if ("error" in parsed) return NextResponse.json(parsed, { status: 400 });

  const result = await createAssociatedOrg(parsed, gate.user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  revalidate();
  const rows = await listAssociatedOrgs();
  return NextResponse.json({ ok: true, rows });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireNetworkAdmin();
  if ("error" in gate) return gate.error;

  const body = await request.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  const currentOrgId = String(body.currentOrgId ?? "");
  if (!userId || !currentOrgId) {
    return NextResponse.json({ error: "userId and currentOrgId are required." }, { status: 400 });
  }
  const parsed = parseInput(body);
  if ("error" in parsed) return NextResponse.json(parsed, { status: 400 });

  // Moving orgs means unpublishing the old row rather than re-parenting it —
  // an associated org is published under exactly one sponsoring org.
  if (parsed.orgId !== currentOrgId) {
    await deleteAssociatedOrg(currentOrgId, userId);
  }
  try {
    await updateAssociatedOrg(userId, parsed.orgId, parsed);
  } catch (error) {
    // updateProfile refuses a slug that is a route or a network subdomain
    // (packages/utils reserved-slugs) — this is the one admin path that used
    // to write the slug raw.
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "reserved_slug" || msg === "invalid_slug") {
      return NextResponse.json(
        { error: `"${parsed.slug}" can't be used as a URL slug — it's reserved.` },
        { status: 400 }
      );
    }
    throw error;
  }

  revalidate();
  const rows = await listAssociatedOrgs();
  return NextResponse.json({ ok: true, rows });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireNetworkAdmin();
  if ("error" in gate) return gate.error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "";
  const orgId = searchParams.get("orgId") ?? "";
  if (!userId || !orgId) {
    return NextResponse.json({ error: "userId and orgId are required." }, { status: 400 });
  }

  const ok = await deleteAssociatedOrg(orgId, userId);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  revalidate();
  return NextResponse.json({ ok: true });
}
