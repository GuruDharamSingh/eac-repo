import { NextResponse } from "next/server";
import {
  MAX_PSEUDONYMS,
  createPseudonym,
  listActingIdentities,
  restorePseudonym,
  retirePseudonym,
} from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

// ============================================================================
// The names this person writes under.
//
// Every handler is scoped to the SIGNED-IN account and takes no account
// parameter — there is no form of this route that answers "who is behind this
// name". The service layer holds one function that can (accountForIdentity),
// and it is not reachable from here.
//
// 401 rather than a redirect: this is read by a surface, not a page.
// ============================================================================

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const identities = await listActingIdentities(user.id);
  return NextResponse.json({
    identities: identities.map((i) => ({
      id: i.id,
      relation: i.relation,
      displayName: i.displayName,
      slug: i.slug,
      avatarUrl: i.avatarUrl,
      label: i.label ?? null,
      retiredAt: i.retiredAt ? i.retiredAt.toISOString() : null,
      orgId: i.orgId ?? null,
    })),
    maxPseudonyms: MAX_PSEUDONYMS,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { displayName?: unknown; slug?: unknown; label?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const displayName = typeof body.displayName === "string" ? body.displayName : "";
  const result = await createPseudonym(user.id, {
    displayName,
    slug: typeof body.slug === "string" ? body.slug : undefined,
    label: typeof body.label === "string" ? body.label : undefined,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    identity: {
      id: result.identityId,
      relation: "pseudonym",
      displayName: displayName.trim().replace(/\s+/g, " "),
      slug: result.slug,
      avatarUrl: null,
      label: typeof body.label === "string" ? body.label : null,
      retiredAt: null,
    },
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { identityId?: unknown; retired?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const identityId = typeof body.identityId === "string" ? body.identityId : "";
  if (!identityId) return NextResponse.json({ error: "Which name?" }, { status: 400 });

  // Both calls are scoped to this account inside the service, so a forged id
  // matches nothing and comes back as "No such name" rather than touching
  // someone else's row.
  const result = body.retired === true
    ? await retirePseudonym(user.id, identityId)
    : await restorePseudonym(user.id, identityId);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
