import { db } from "@elkdonis/db";
import { revalidatePath } from "next/cache";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * Which optional sections a person shows on their own page.
 *
 * Self-only by construction: the row updated is always the viewer's own, and
 * no user id is read from the request. There is no admin override because
 * there is nothing here an admin would need to set — these are presentation
 * choices about someone's own page, not org-scoped publishing decisions
 * (which live in org_profiles and DO have an admin path).
 *
 * `jsonb ||` merges rather than replaces, so a later app adding a section key
 * doesn't wipe one this route doesn't know about.
 */
export const dynamic = "force-dynamic";

/** Sections this app knows how to render. Anything else is refused, not stored. */
const KNOWN_SECTIONS = ["elkdonisFeed", "store"] as const;

export async function PATCH(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const patch: Record<string, boolean> = {};
  for (const key of KNOWN_SECTIONS) {
    if (key in payload) patch[key] = Boolean(payload[key]);
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to change" }, { status: 400 });
  }

  const [row] = await db<Array<{ slug: string | null }>>`
    UPDATE users
    SET profile_sections = COALESCE(profile_sections, '{}'::jsonb) || ${db.json(
      patch as never
    )}
    WHERE id = ${viewer.userId}
    RETURNING slug
  `;

  // Their public page renders from this, so it has to be rebuilt or the
  // member toggles a section on and sees no change.
  if (row?.slug) {
    revalidatePath(`/artists/${row.slug}`);
    revalidatePath(`/dealers/${row.slug}`);
  }

  return Response.json({ ok: true, sections: patch });
}
